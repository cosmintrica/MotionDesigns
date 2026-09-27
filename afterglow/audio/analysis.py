"""Report + spectrogram/envelope images for the AFTERGLOW mix (PIL only)."""
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import signal

from cues import SR, N_SAMPLES, SECTIONS, CUES, DURATION
import dsp

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def _font(size, bold=False):
    try:
        return ImageFont.truetype(FONT_B if bold else FONT, size)
    except Exception:
        return ImageFont.load_default()


# ------------------------------------------------------------------ colour map (magma-like)
_CM = np.array([[0, 0, 4], [28, 16, 68], [79, 18, 123], [129, 37, 129], [181, 54, 122],
                [229, 80, 100], [251, 135, 97], [254, 194, 135], [252, 253, 191]], dtype=float)


def cmap(v):
    v = np.clip(v, 0, 1) * (len(_CM) - 1)
    i = np.floor(v).astype(int)
    i = np.clip(i, 0, len(_CM) - 2)
    f = (v - i)[..., None]
    return (_CM[i] * (1 - f) + _CM[i + 1] * f).astype(np.uint8)


# ------------------------------------------------------------------ measurements

def section_table(x, targets=None):
    t, st = dsp.short_term_lufs(x, 0.1)
    tm, mo = dsp.momentary_lufs(x, 0.1)
    rows = []
    for key, label, a, b in SECTIONS:
        sel = (t >= a + 1.5) & (t <= b - 1.5) if b - a >= 3.5 else (t >= a) & (t <= b)
        if not np.any(sel):
            sel = (t >= a) & (t <= b)
        vals = st[sel]
        p = 10 ** (vals / 10)
        mean = 10 * np.log10(p.mean()) if len(p) else -99
        selm = (tm >= a) & (tm <= b)
        rows.append(dict(key=key, label=label, a=a, b=b, st_mean=mean, st_min=float(vals.min()),
                         st_max=float(vals.max()), mom_max=float(mo[selm].max()) if np.any(selm) else -99,
                         target=(targets or {}).get(key)))
    return rows


def loudness_range(x):
    t, st = dsp.short_term_lufs(x, 0.1)
    z = st[st > -70]
    rel = 10 * np.log10(np.mean(10 ** (z / 10))) - 20
    z = z[z > rel]
    return float(np.percentile(z, 95) - np.percentile(z, 10))


def write_report(path, mix, buses, info, targets=None, events=None):
    L = []
    n = len(mix)
    L.append("AFTERGLOW - soundtrack master report")
    L.append("=" * 72)
    L.append(f"file            : {info['path']}")
    L.append(f"format          : WAV, PCM 24-bit, {info['sr']} Hz, {info['channels']} ch")
    L.append(f"length          : {n} samples = {n / SR:.6f} s  (target {N_SAMPLES} = {DURATION:.1f} s)  "
             f"{'OK' if n == N_SAMPLES else 'MISMATCH'}")
    li = dsp.integrated_lufs(mix)
    try:
        import pyloudnorm as pyln
        li_pyln = pyln.Meter(SR).integrated_loudness(mix)
        L.append(f"integrated      : {li:.2f} LUFS  (pyloudnorm cross-check {li_pyln:.2f} LUFS)")
    except Exception:
        L.append(f"integrated      : {li:.2f} LUFS")
    tp = dsp.true_peak_db(mix)
    L.append(f"true peak (4x)  : {tp:.2f} dBTP   (ceiling -1.0 dBTP: {'OK' if tp <= -1.0 else 'OVER'})")
    L.append(f"sample peak     : {dsp.peak_db(mix):.2f} dBFS")
    L.append(f"loudness range  : {loudness_range(mix):.1f} LU")
    dc = np.mean(mix, axis=0)
    L.append(f"DC offset       : L {dc[0]:+.2e}  R {dc[1]:+.2e}")
    corr = np.corrcoef(mix[:, 0], mix[:, 1])[0, 1]
    L.append(f"L/R correlation : {corr:.2f}")
    L.append(f"clipped samples : {int(np.sum(np.abs(mix) >= 0.9999))}")
    L.append("")
    L.append("Per-section loudness (short-term = 3 s window; mean is the power average of the")
    L.append("short-term curve inside the section; music/sfx/amb = gated loudness of each bus")
    L.append("in the section after the master trim)")
    L.append("-" * 104)
    L.append(f"{'section':22s} {'time (s)':>13s} {'ST mean':>8s} {'ST min':>7s} {'ST max':>7s} {'M max':>6s}"
             f" {'music':>6s} {'sfx':>6s} {'amb':>6s}")
    rows = section_table(mix, targets)
    for r in rows:
        bl = []
        for k in ("music", "sfx", "amb"):
            v = dsp.integrated_lufs(buses[k][dsp.secs(r['a']):dsp.secs(r['b'])]) if k in buses else -99
            bl.append(v if v > -69 else float("nan"))
        L.append(f"{r['label']:22s} {r['a']:6.1f}-{r['b']:6.1f} {r['st_mean']:8.1f} {r['st_min']:7.1f} {r['st_max']:7.1f}"
                 f" {r['mom_max']:6.1f} {bl[0]:6.1f} {bl[1]:6.1f} {bl[2]:6.1f}")
    L.append("")
    if "notes" in info:
        L.append("Notes")
        L.append("-" * 72)
        for s in info["notes"]:
            L.append(s)
        L.append("")
    if events:
        L.append("SFX events placed (name, start, end in s)")
        L.append("-" * 72)
        for name, a, b in sorted(events, key=lambda e: e[1]):
            L.append(f"  {a:8.3f} - {b:8.3f}  {name}")
    with open(path, "w") as f:
        f.write("\n".join(L) + "\n")
    return rows


# ------------------------------------------------------------------ images

def _axes(draw, box, x0, x1, y0, y1, xlabel, ylabel, yticks, ylog=False, fnt=None):
    l, t, r, b = box
    draw.rectangle(box, outline=(90, 90, 100))
    for xv in range(int(x0), int(x1) + 1, 10):
        X = l + (xv - x0) / (x1 - x0) * (r - l)
        draw.line([(X, b), (X, b + 5)], fill=(160, 160, 170))
        draw.text((X - 8, b + 7), f"{xv}", fill=(200, 200, 210), font=fnt)
    for yv, lab in yticks:
        if ylog:
            Y = b - (np.log10(yv) - np.log10(y0)) / (np.log10(y1) - np.log10(y0)) * (b - t)
        else:
            Y = b - (yv - y0) / (y1 - y0) * (b - t)
        draw.line([(l - 5, Y), (l, Y)], fill=(160, 160, 170))
        draw.text((l - 48, Y - 7), lab, fill=(200, 200, 210), font=fnt)
    draw.text(((l + r) / 2 - 30, b + 24), xlabel, fill=(220, 220, 230), font=fnt)
    draw.text((8, t - 22), ylabel, fill=(220, 220, 230), font=fnt)


def _sections(draw, box, x0, x1, fnt, label=True):
    l, t, r, b = box
    for i, (key, lab, a, bb) in enumerate(SECTIONS):
        X = l + (a - x0) / (x1 - x0) * (r - l)
        draw.line([(X, t), (X, b)], fill=(120, 200, 255), width=1)
        if label:
            yy = t + 4 + (i % 3) * 14
            draw.text((X + 3, yy), lab, fill=(150, 215, 255), font=fnt)


def spectrogram_png(path, x, title="AFTERGLOW - spectrogram"):
    m = dsp.mono(x)
    nfft, hop = 4096, 480
    f, t, Z = signal.stft(m, fs=SR, nperseg=nfft, noverlap=nfft - hop, window="hann", boundary=None,
                          padded=False)
    P = 20 * np.log10(np.abs(Z) + 1e-9)
    W, H = 1820, 560
    ml, mt, mr, mb = 70, 40, 20, 60
    img = Image.new("RGB", (W + ml + mr, H + mt + mb), (14, 14, 20))
    # columns: max over frames per pixel
    cols = np.linspace(0, P.shape[1], W + 1).astype(int)
    fr = np.geomspace(25, 20000, H)
    idx = np.clip(np.searchsorted(f, fr), 1, len(f) - 1)
    Pc = np.stack([P[:, cols[i]:max(cols[i] + 1, cols[i + 1])].max(axis=1) for i in range(W)], axis=1)
    Pr = Pc[idx, :]
    vmax = np.percentile(Pr, 99.7)
    v = (Pr - (vmax - 90)) / 90.0
    rgb = cmap(v[::-1, :])
    img.paste(Image.fromarray(rgb, "RGB"), (ml, mt))
    d = ImageDraw.Draw(img)
    fnt = _font(12)
    box = (ml, mt, ml + W, mt + H)
    _axes(d, box, 0, DURATION, 25, 20000, "time (s)", "Hz", [(50, "50"), (100, "100"), (200, "200"),
          (500, "500"), (1000, "1k"), (2000, "2k"), (5000, "5k"), (10000, "10k"), (20000, "20k")],
          ylog=True, fnt=fnt)
    _sections(d, box, 0, DURATION, _font(10), label=True)
    d.text((ml, 10), title + "  (mono downmix, 90 dB range)", fill=(235, 235, 240), font=_font(15, True))
    img.save(path)


def envelope_png(path, mix, buses=None, targets=None, title="AFTERGLOW - level over time"):
    W, H = 1820, 520
    ml, mt, mr, mb = 70, 40, 20, 60
    img = Image.new("RGB", (W + ml + mr, H + mt + mb), (14, 14, 20))
    d = ImageDraw.Draw(img)
    fnt = _font(12)
    box = (ml, mt, ml + W, mt + H)
    y0, y1 = -60.0, 0.0

    def X(tv):
        return ml + tv / DURATION * W

    def Y(v):
        return mt + H - (np.clip(v, y0, y1) - y0) / (y1 - y0) * H

    for yv in range(-60, 1, 6):
        d.line([(ml, Y(yv)), (ml + W, Y(yv))], fill=(34, 34, 44))
    _axes(d, box, 0, DURATION, y0, y1, "time (s)", "dB / LUFS",
          [(v, f"{v}") for v in range(-60, 1, 6)], fnt=fnt)
    _sections(d, box, 0, DURATION, _font(10), label=True)
    # peak envelope (grey band) and RMS (400 ms)
    m = mix
    w = dsp.secs(0.1)
    k = len(m) // w
    pk = np.abs(m[:k * w]).max(axis=1).reshape(k, w).max(axis=1)
    rm = np.sqrt((m[:k * w] ** 2).mean(axis=1).reshape(k, w).mean(axis=1))
    rm4 = np.sqrt(np.convolve(rm ** 2, np.ones(4) / 4, mode="same"))
    tt = (np.arange(k) + 0.5) * 0.1
    for i in range(k):
        d.line([(X(tt[i]), Y(-60)), (X(tt[i]), Y(dsp.lin2db(pk[i])))], fill=(52, 52, 70))
    pts = [(X(a), Y(dsp.lin2db(b))) for a, b in zip(tt, rm4)]
    d.line(pts, fill=(120, 190, 120), width=2)
    # short-term loudness
    t, st = dsp.short_term_lufs(mix, 0.1)
    d.line([(X(a), Y(b)) for a, b in zip(t, st)], fill=(255, 190, 90), width=2)
    if buses is not None:
        colors = {"music": (230, 120, 200), "sfx": (110, 170, 255), "amb": (150, 150, 150)}
        for kk, c in colors.items():
            if kk in buses:
                t2, s2 = dsp.short_term_lufs(buses[kk], 0.2)
                d.line([(X(a), Y(b)) for a, b in zip(t2, s2)], fill=c, width=1)
    if targets:
        for key, lab, a, b in SECTIONS:
            if key in targets:
                d.line([(X(a), Y(targets[key])), (X(b), Y(targets[key]))], fill=(255, 255, 255), width=1)
    # legend
    lx = ml + 10
    ly = mt + H - 90
    for c, s in (((52, 52, 70), "sample peak"), ((120, 190, 120), "RMS 400 ms (dBFS)"),
                 ((255, 190, 90), "short-term loudness (LUFS)"), ((230, 120, 200), "music bus ST"),
                 ((110, 170, 255), "sfx bus ST"), ((150, 150, 150), "ambience bus ST"),
                 ((255, 255, 255), "section target (arc)")):
        d.rectangle([lx, ly, lx + 14, ly + 8], fill=c)
        d.text((lx + 20, ly - 4), s, fill=(220, 220, 230), font=_font(11))
        ly += 12
    d.text((ml, 10), title, fill=(235, 235, 240), font=_font(15, True))
    img.save(path)


def zoom_png(path, x, t0, t1, title):
    """Detail spectrogram of a short window (for checking transitions)."""
    seg = dsp.mono(x[dsp.secs(t0):dsp.secs(t1)])
    nfft, hop = 2048, 128
    f, t, Z = signal.stft(seg, fs=SR, nperseg=nfft, noverlap=nfft - hop, window="hann")
    P = 20 * np.log10(np.abs(Z) + 1e-9)
    W, H = 1200, 420
    ml, mt, mr, mb = 60, 36, 20, 50
    img = Image.new("RGB", (W + ml + mr, H + mt + mb), (14, 14, 20))
    cols = np.linspace(0, P.shape[1], W + 1).astype(int)
    fr = np.geomspace(30, 20000, H)
    idx = np.clip(np.searchsorted(f, fr), 1, len(f) - 1)
    Pc = np.stack([P[:, cols[i]:max(cols[i] + 1, cols[i + 1])].max(axis=1) for i in range(W)], axis=1)
    Pr = Pc[idx, :]
    vmax = np.percentile(Pr, 99.7)
    rgb = cmap(((Pr - (vmax - 90)) / 90.0)[::-1, :])
    img.paste(Image.fromarray(rgb, "RGB"), (ml, mt))
    d = ImageDraw.Draw(img)
    fnt = _font(11)
    for k in range(int(np.ceil(t0)), int(t1) + 1):
        Xp = ml + (k - t0) / (t1 - t0) * W
        d.line([(Xp, mt + H), (Xp, mt + H + 5)], fill=(160, 160, 170))
        d.text((Xp - 8, mt + H + 7), f"{k}", fill=(200, 200, 210), font=fnt)
    for fv, lab in ((100, "100"), (1000, "1k"), (10000, "10k")):
        Yp = mt + H - (np.log10(fv) - np.log10(30)) / (np.log10(20000) - np.log10(30)) * H
        d.text((10, Yp - 6), lab, fill=(200, 200, 210), font=fnt)
    # RMS overlay
    w = dsp.secs(0.02)
    k = len(seg) // w
    r = 20 * np.log10(np.sqrt((seg[:k * w] ** 2).reshape(k, w).mean(axis=1)) + 1e-9)
    pts = [(ml + (i + 0.5) / k * W, mt + H - (np.clip(v, -70, 0) + 70) / 70 * H) for i, v in enumerate(r)]
    d.line(pts, fill=(120, 255, 120), width=1)
    d.text((ml, 10), title, fill=(235, 235, 240), font=_font(14, True))
    img.save(path)
