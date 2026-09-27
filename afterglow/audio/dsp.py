"""Core DSP utilities for the AFTERGLOW soundtrack (numpy/scipy only).

Conventions: audio arrays are float64, shape (n,) mono or (n, 2) stereo, 48 kHz.
"""
import numpy as np
from scipy import signal
from scipy.ndimage import minimum_filter1d, maximum_filter1d

from cues import SR, N_SAMPLES

# ------------------------------------------------------------------ basics

def db2lin(db):
    return 10.0 ** (np.asarray(db, dtype=float) / 20.0)


def lin2db(x):
    return 20.0 * np.log10(np.maximum(np.abs(x), 1e-12))


def secs(t):
    return int(round(t * SR))


def zeros(n=N_SAMPLES, ch=2):
    return np.zeros((n, ch)) if ch > 1 else np.zeros(n)


def to_stereo(x):
    if x.ndim == 1:
        return np.stack([x, x], axis=1)
    return x


def mono(x):
    return x.mean(axis=1) if x.ndim == 2 else x


def rms_db(x):
    return lin2db(np.sqrt(np.mean(np.square(x)) + 1e-24))


def peak_db(x):
    return lin2db(np.max(np.abs(x)) + 1e-24)


def fit_length(x, n=N_SAMPLES):
    if len(x) >= n:
        return x[:n]
    pad = [(0, n - len(x))] + [(0, 0)] * (x.ndim - 1)
    return np.pad(x, pad)


def place(bus, sig, t, gain=1.0):
    """Add sig into bus starting at time t (seconds); clips at bus edges."""
    start = secs(t)
    sig = np.asarray(sig)
    if bus.ndim == 2 and sig.ndim == 1:
        sig = to_stereo(sig)
    a, b = start, start + len(sig)
    sa = 0
    if a < 0:
        sa = -a
        a = 0
    b = min(b, len(bus))
    if b <= a:
        return bus
    bus[a:b] += gain * sig[sa:sa + (b - a)]
    return bus


def fade(x, fin=0.005, fout=0.005):
    """Raised-cosine fade in/out (seconds) applied in place on a copy."""
    y = np.array(x, dtype=float, copy=True)
    n = len(y)
    ni, no = min(secs(fin), n), min(secs(fout), n)
    if ni > 0:
        w = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, ni))
        y[:ni] *= w[:, None] if y.ndim == 2 else w
    if no > 0:
        w = 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, no))
        y[n - no:] *= w[:, None] if y.ndim == 2 else w
    return y


def pan(x, p):
    """Equal-power pan of a mono signal; p in [-1, 1] (scalar or per-sample)."""
    th = (np.asarray(p) + 1.0) * np.pi / 4.0
    return np.stack([x * np.cos(th), x * np.sin(th)], axis=1) * np.sqrt(2.0)


def width(x, w):
    """M/S stereo width. w=0 mono, 1 unchanged, >1 wider. w may be per-sample."""
    m = 0.5 * (x[:, 0] + x[:, 1])
    s = 0.5 * (x[:, 0] - x[:, 1]) * w
    return np.stack([m + s, m - s], axis=1)


# ------------------------------------------------------------------ automation

def curve(points, n=N_SAMPLES, t0=0.0, smooth=True, ctrl=32):
    """Piecewise automation curve sampled at SR.

    points: list of (t, value) sorted by t.  Held constant outside the range.
    smooth: cosine interpolation between breakpoints (no corners).
    Evaluated on a control grid of `ctrl` samples and linearly interpolated.
    """
    pts = sorted(points, key=lambda p: p[0])
    ts = np.array([p[0] for p in pts], dtype=float)
    vs = np.array([p[1] for p in pts], dtype=float)
    if len(pts) == 1:
        return np.full(n, vs[0])
    m = n // ctrl + 2
    t = t0 + np.arange(m) * ctrl / SR
    idx = np.clip(np.searchsorted(ts, t, side="right") - 1, 0, len(ts) - 2)
    ta, tb = ts[idx], ts[idx + 1]
    va, vb = vs[idx], vs[idx + 1]
    span = np.maximum(tb - ta, 1e-9)
    u = np.clip((t - ta) / span, 0.0, 1.0)
    if smooth:
        u = 0.5 - 0.5 * np.cos(np.pi * u)
    out = va + (vb - va) * u
    out[t < ts[0]] = vs[0]
    out[t >= ts[-1]] = vs[-1]
    return np.interp(np.arange(n), np.arange(m) * ctrl, out)


def db_curve(points, n=N_SAMPLES, t0=0.0, smooth=True):
    return db2lin(curve(points, n, t0, smooth))


def gate_curve(regions, n=N_SAMPLES, ramp=0.01):
    """1.0 inside the (start, end) regions, 0 outside, with cosine ramps."""
    pts = [(0.0, 0.0)]
    for a, b in regions:
        pts += [(a - ramp, 0.0), (a, 1.0), (b, 1.0), (b + ramp, 0.0)]
    pts.append((1e6, 0.0))
    return curve(pts, n)


# ------------------------------------------------------------------ filters

def butter(kind, fc, order=2):
    return signal.butter(order, fc, btype=kind, fs=SR, output="sos")


def rbj(kind, f0, q=0.707, gain_db=0.0):
    """RBJ cookbook biquad as a single SOS row."""
    A = 10 ** (gain_db / 40.0)
    w0 = 2 * np.pi * f0 / SR
    cw, sw = np.cos(w0), np.sin(w0)
    alpha = sw / (2 * q)
    if kind == "peak":
        b = [1 + alpha * A, -2 * cw, 1 - alpha * A]
        a = [1 + alpha / A, -2 * cw, 1 - alpha / A]
    elif kind == "lowshelf":
        sa = 2 * np.sqrt(A) * alpha
        b = [A * ((A + 1) - (A - 1) * cw + sa), 2 * A * ((A - 1) - (A + 1) * cw),
             A * ((A + 1) - (A - 1) * cw - sa)]
        a = [(A + 1) + (A - 1) * cw + sa, -2 * ((A - 1) + (A + 1) * cw),
             (A + 1) + (A - 1) * cw - sa]
    elif kind == "highshelf":
        sa = 2 * np.sqrt(A) * alpha
        b = [A * ((A + 1) + (A - 1) * cw + sa), -2 * A * ((A - 1) + (A + 1) * cw),
             A * ((A + 1) + (A - 1) * cw - sa)]
        a = [(A + 1) - (A - 1) * cw + sa, 2 * ((A - 1) - (A + 1) * cw),
             (A + 1) - (A - 1) * cw - sa]
    elif kind == "lp":
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "hp":
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "bp":
        b = [alpha, 0.0, -alpha]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    else:
        raise ValueError(kind)
    b = np.array(b) / a[0]
    a = np.array(a) / a[0]
    return np.concatenate([b, a])[None, :]


def eq(*rows):
    """Stack SOS rows/arrays into one SOS cascade."""
    return np.vstack(rows)


def filt(x, sos, zero_phase=False):
    if zero_phase:
        return signal.sosfiltfilt(sos, x, axis=0)
    return signal.sosfilt(sos, x, axis=0)


def xfade_filters(x, versions, weights):
    """Blend pre-filtered versions of x with per-sample weight curves (sum ~1)."""
    out = np.zeros_like(x)
    for v, w in zip(versions, weights):
        out += v * (w[:, None] if x.ndim == 2 else w)
    return out


def tv_lowpass(x, fc_curve, grid=(700, 1000, 1400, 2000, 2800, 4000, 5600, 8000, 11000, 16000, 22000), order=2):
    """Time-varying low-pass by interpolating between a bank of fixed filters.

    fc_curve: per-sample cutoff (Hz). Values >= the last grid point mean 'bypass'.
    Zero-phase filters are used so that blending never comb-filters.
    """
    grid = list(grid)
    lf = np.log(np.clip(fc_curve, grid[0], grid[-1]))
    lg = np.log(np.array(grid, dtype=float))
    out = np.zeros_like(x)
    for i, fc in enumerate(grid):
        # triangular weight in log-frequency
        if i == 0:
            w = np.clip((lg[1] - lf) / (lg[1] - lg[0]), 0, 1)
        elif i == len(grid) - 1:
            w = np.clip((lf - lg[-2]) / (lg[-1] - lg[-2]), 0, 1)
        else:
            w = np.minimum(np.clip((lf - lg[i - 1]) / (lg[i] - lg[i - 1]), 0, 1),
                           np.clip((lg[i + 1] - lf) / (lg[i + 1] - lg[i]), 0, 1))
        if not np.any(w > 1e-6):
            continue
        nz = np.nonzero(w > 1e-6)[0]
        a, b = max(nz[0] - SR, 0), min(nz[-1] + SR, len(x))
        seg = x[a:b]
        if fc >= 22000:
            y = seg
        else:
            y = filt(seg, butter("low", fc, order), zero_phase=True)
        ww = w[a:b]
        out[a:b] += y * (ww[:, None] if x.ndim == 2 else ww)
    return out


# ------------------------------------------------------------------ noise helpers

def pink(n, rng):
    """Pink-ish noise (1/f) via FFT shaping; unit RMS."""
    X = rng.standard_normal(n // 2 + 1) + 1j * rng.standard_normal(n // 2 + 1)
    f = np.fft.rfftfreq(n, 1 / SR)
    f[0] = f[1]
    X /= np.sqrt(f)
    y = np.fft.irfft(X, n)
    return y / (np.std(y) + 1e-12)


def brown(n, rng):
    X = rng.standard_normal(n // 2 + 1) + 1j * rng.standard_normal(n // 2 + 1)
    f = np.fft.rfftfreq(n, 1 / SR)
    f[0] = f[1]
    X /= f
    y = np.fft.irfft(X, n)
    return y / (np.std(y) + 1e-12)


def shaped_noise(dur, mag_fn, rng, nfft=2048, hop=256):
    """Noise whose time-frequency magnitude follows mag_fn(t[frames], f[bins]).

    Built by STFT synthesis (random complex spectra, inverse STFT). Returns a
    mono signal of length dur normalised so that a flat mag of 1 gives ~unit RMS.
    """
    n = secs(dur)
    n_frames = int(np.ceil(n / hop)) + nfft // hop + 1
    t = (np.arange(n_frames) * hop - nfft / 2) / SR
    f = np.fft.rfftfreq(nfft, 1 / SR)
    M = mag_fn(t[:, None], f[None, :])          # (frames, bins)
    Z = (rng.standard_normal(M.shape) + 1j * rng.standard_normal(M.shape)) * M
    _, y = signal.istft(Z.T, fs=SR, window="hann", nperseg=nfft, noverlap=nfft - hop,
                        boundary=True)
    y = y[:n] if len(y) >= n else np.pad(y, (0, n - len(y)))
    # scale so flat magnitude ~ unit RMS
    return y * np.sqrt(nfft / 2.0) / np.sqrt(1.5)


# ------------------------------------------------------------------ reverb

def make_ir(rt60=2.4, predelay=0.03, length=None, rt_low=1.25, rt_high=0.45,
            f_low=250.0, f_high=5000.0, hf_cut=9000.0, lf_cut=90.0, build=0.02,
            er_taps=10, er_level=0.35, seed=1, true_stereo=True):
    """Synthetic stereo reverb IR (decorrelated, exponentially decaying noise).

    rt60 is the mid-band decay; rt_low/rt_high are multipliers below f_low and
    above f_high (high damping over time). Returns (n, 4) = LL, LR, RL, RR
    (true stereo) normalised to unit energy per output channel.
    """
    rng = np.random.default_rng(seed)
    if length is None:
        length = predelay + rt60 * max(1.0, rt_low) * 1.15
    n = secs(length)
    nfft, hop = 1024, 128

    def rt_of_f(f):
        lf = np.log(np.maximum(f, 20.0))
        a = np.clip((lf - np.log(f_low)) / (np.log(f_high) - np.log(f_low)), 0, 1)
        mult = np.where(f < f_low, rt_low,
                        np.where(f > f_high, rt_high, rt_low + (rt_high - rt_low) * a))
        # extra roll-off above f_high
        mult = mult * np.where(f > f_high, (f_high / np.maximum(f, 1)) ** 0.35, 1.0)
        return rt60 * mult

    def mag(t, f):
        tt = np.maximum(t - predelay, 0.0)
        env = np.exp(-6.9078 * tt / rt_of_f(f))
        ramp = np.clip((t - predelay) / max(build, 1e-3), 0, 1)
        spec = 1.0 / np.sqrt(1 + (f / hf_cut) ** 4) * (1.0 / np.sqrt(1 + (lf_cut / np.maximum(f, 1)) ** 4))
        return env * ramp * spec

    chans = 4 if true_stereo else 2
    irs = []
    for c in range(chans):
        y = shaped_noise(length, mag, rng, nfft=nfft, hop=hop)
        # early reflections: sparse taps after the predelay
        er = np.zeros(n)
        taps = np.sort(rng.uniform(0.004, 0.075, er_taps))
        for i, tt in enumerate(taps):
            k = secs(predelay * 0.6 + tt)
            if k < n:
                er[k] += er_level * rng.choice([-1, 1]) * np.exp(-tt / 0.05) * (0.6 + 0.4 * rng.random())
        er = filt(er, butter("low", 6000, 2))
        y = y[:n] + er * np.std(y[secs(predelay):secs(predelay) + secs(0.2)]) * 6.0
        irs.append(y)
    ir = np.stack(irs, axis=1)
    if true_stereo:
        # LL/RR direct, LR/RL cross terms slightly lower
        ir[:, 1] *= 0.7
        ir[:, 2] *= 0.7
        for pair in ((0, 2), (1, 3)):
            e = np.sqrt(np.sum(ir[:, pair[0]] ** 2) + np.sum(ir[:, pair[1]] ** 2))
            ir[:, pair[0]] /= e
            ir[:, pair[1]] /= e
    else:
        ir /= np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True))
    # tiny fade at the end
    fl = min(secs(0.2), n)
    ir[-fl:] *= np.linspace(1, 0, fl)[:, None]
    return ir


def _fftconv_pair(x, ir, full=False):
    """True-stereo FFT convolution with one big multithreaded FFT."""
    from scipy import fft as sfft
    x = to_stereo(x)
    n, m = len(x), len(ir)
    L = sfft.next_fast_len(n + m - 1, real=True)
    X = sfft.rfft(x, L, axis=0, workers=4)
    H = sfft.rfft(ir, L, axis=0, workers=4)
    YL = X[:, 0] * H[:, 0] + X[:, 1] * H[:, 2]
    YR = X[:, 0] * H[:, 1] + X[:, 1] * H[:, 3]
    del X, H
    out = sfft.irfft(np.stack([YL, YR], axis=1), L, axis=0, workers=4)
    return out[:n + m - 1] if full else out[:n]


def convolve_reverb(x, ir):
    """True-stereo convolution. x (n,2), ir (m,4). Output length n (tail cut)."""
    return _fftconv_pair(x, ir, full=False)


def convolve_reverb_full(x, ir):
    """Like convolve_reverb but keeps the full tail (n + m - 1)."""
    return _fftconv_pair(x, ir, full=True)


# ------------------------------------------------------------------ interpolation / time warps

def read_at(x, pos):
    """Cubic (Catmull-Rom) read of x at fractional sample positions pos."""
    n = len(x)
    i = np.floor(pos).astype(np.int64)
    f = pos - i
    if x.ndim == 2:
        f = f[:, None]

    def g(k):
        return x[np.clip(k, 0, n - 1)]

    p0, p1, p2, p3 = g(i - 1), g(i), g(i + 1), g(i + 2)
    a = -0.5 * p0 + 1.5 * p1 - 1.5 * p2 + 0.5 * p3
    b = p0 - 2.5 * p1 + 2 * p2 - 0.5 * p3
    c = -0.5 * p0 + 0.5 * p2
    return ((a * f + b) * f + c) * f + p1


def smooth_random(n, rate_hz, rng, dec=480):
    """Band-limited random signal (unit-ish std) with ~rate_hz bandwidth."""
    k = max(1, int(SR / dec / rate_hz))
    m = max(n // dec + 4, 2 * k + 2)
    r = rng.standard_normal(m + 2 * k)
    r = np.convolve(r, np.hanning(2 * k + 1), mode="valid")[:m]
    r /= (np.std(r) + 1e-12)
    return np.interp(np.arange(n) / dec, np.arange(m), r)


def wow_flutter(x, wow_cents, flutter_cents, rng, wow_rate=0.62, flutter_rate=7.3, t0=0.0):
    """Tape wow & flutter as a modulated fractional delay.

    wow_cents / flutter_cents: scalars or per-sample arrays (peak deviation).
    """
    n = len(x)
    t = t0 + np.arange(n) / SR
    wow = 0.7 * np.sin(2 * np.pi * wow_rate * t + rng.uniform(0, 6.28)) \
        + 0.3 * smooth_random(n, 0.4, rng)
    flut = 0.6 * np.sin(2 * np.pi * flutter_rate * t + rng.uniform(0, 6.28)) \
        + 0.4 * np.sin(2 * np.pi * (flutter_rate * 1.37) * t + rng.uniform(0, 6.28))
    cents = np.asarray(wow_cents) * wow + np.asarray(flutter_cents) * flut
    ratio = 2.0 ** (cents / 1200.0)
    drift = np.cumsum(ratio - 1.0)
    drift -= np.linspace(drift[0], drift[-1], n)     # keep long-term sync exact
    pos = np.arange(n) + drift
    return read_at(x, pos)


def tape_stop(x, t_start, dur, power=1.35, resume_at=None):
    """Tape stop: playback speed ramps 1 -> 0 over dur; silence until resume_at (s)."""
    y = np.array(x, copy=True)
    n0, nd = secs(t_start), secs(dur)
    u = np.arange(nd) / nd
    speed = (1.0 - u) ** power
    pos = n0 + np.concatenate([[0.0], np.cumsum(speed[:-1])])
    seg = read_at(x, pos)
    gain = np.clip(speed, 0, 1) ** 0.55
    gain *= np.clip((1.0 - u) / 0.06, 0, 1)            # no click at the very end
    # progressive darkening (head losses at low speed)
    dark = filt(seg, butter("low", 900, 2))
    mixw = np.clip((u - 0.25) / 0.6, 0, 1)
    if seg.ndim == 2:
        seg = seg * (1 - mixw[:, None]) + dark * mixw[:, None]
        seg *= gain[:, None]
    else:
        seg = seg * (1 - mixw) + dark * mixw
        seg *= gain
    y[n0:n0 + nd] = seg[:len(y) - n0]
    n_res = len(y) if resume_at is None else secs(resume_at)
    y[n0 + nd:n_res] = 0.0
    return y


# ------------------------------------------------------------------ nonlinear

def tape_sat(x, drive_db=4.0, asym=0.08):
    """Gentle tape-style saturation, unity small-signal gain."""
    g = db2lin(drive_db)
    y = np.tanh(g * x + asym) - np.tanh(asym)
    return y / (g * (1 - np.tanh(asym) ** 2))


def soft_clip(x, knee=0.9):
    """Transparent below `knee`, smoothly limits to 1.0."""
    y = np.array(x, copy=True)
    a = np.abs(x)
    over = a > knee
    r = 1.0 - knee
    y[over] = np.sign(x[over]) * (knee + r * np.tanh((a[over] - knee) / r))
    return y


def bitcrush(x, bits=8, down=1):
    q = 2.0 ** (bits - 1)
    y = np.round(x * q) / q
    if down > 1:
        idx = (np.arange(len(y)) // down) * down
        y = y[idx]
    return y


# ------------------------------------------------------------------ dynamics

def _smooth_gain(target_db, attack_s, release_s, hop):
    """Attack/release smoothing of a gain-reduction curve (dB, <=0) on a hop grid."""
    aa = np.exp(-hop / (attack_s * SR))
    ar = np.exp(-hop / (release_s * SR))
    out = np.empty_like(target_db)
    g = 0.0
    for i, v in enumerate(target_db):
        if v < g:
            g = aa * g + (1 - aa) * v
        else:
            g = ar * g + (1 - ar) * v
        out[i] = g
    return out


def compressor(x, thr_db=-20.0, ratio=2.0, attack=0.02, release=0.25, knee_db=6.0,
               makeup_db=0.0, rms_win=0.01, sidechain=None, hop=32, return_gain=False):
    """Feed-forward RMS compressor (stereo-linked)."""
    sc = x if sidechain is None else sidechain
    p = np.square(sc)
    if p.ndim == 2:
        p = p.mean(axis=1)
    w = max(1, secs(rms_win))
    c = np.concatenate([[0.0], np.cumsum(p)])
    idx = np.arange(0, len(p), hop)
    lo = np.maximum(idx - w, 0)
    lvl = (c[idx + 1] - c[lo]) / np.maximum(idx + 1 - lo, 1)
    lvl_db = 10 * np.log10(lvl + 1e-20)
    over = lvl_db - thr_db
    gr = np.where(over <= -knee_db / 2, 0.0,
                  np.where(over >= knee_db / 2, -over * (1 - 1 / ratio),
                           -(1 - 1 / ratio) * (over + knee_db / 2) ** 2 / (2 * knee_db)))
    gr = _smooth_gain(gr, attack, release, hop)
    g = db2lin(np.interp(np.arange(len(p)), idx, gr) + makeup_db)
    y = x * (g[:, None] if x.ndim == 2 else g)
    return (y, g) if return_gain else y


def true_peak_env(x, os=4, floor_db=-9.0, chunk=48000):
    """Per-sample true-peak estimate (max over channels of the 4x oversampled |x|).

    Chunks whose sample peak is below floor_db are returned as sample peaks (their
    inter-sample overs cannot reach the limiter ceiling)."""
    a = np.abs(x)
    if a.ndim == 2:
        a = a.max(axis=1)
    out = a.copy()
    thr = db2lin(floor_db)
    n = len(x)
    pad = 64
    for s in range(0, n, chunk):
        e = min(n, s + chunk)
        if a[s:e].max() < thr:
            continue
        s0, e0 = max(0, s - pad), min(n, e + pad)
        y = signal.resample_poly(x[s0:e0], os, 1, axis=0)
        ya = np.abs(y)
        if ya.ndim == 2:
            ya = ya.max(axis=1)
        k = e0 - s0
        ya = ya[:k * os].reshape(k, os).max(axis=1)
        out[s:e] = np.maximum(a[s:e], ya[s - s0:s - s0 + (e - s)])
    return out


def true_peak_db(x, os=4):
    return lin2db(np.max(true_peak_env(x, os)))


def limiter(x, ceiling_db=-1.2, lookahead=0.0025, release=0.12, os=4, hop=16):
    """Look-ahead true-peak limiter (offline, no latency)."""
    pk = true_peak_env(x, os)
    ceil = db2lin(ceiling_db)
    g_req = np.minimum(1.0, ceil / np.maximum(pk, 1e-12))
    L = max(2, secs(lookahead))
    m = minimum_filter1d(g_req, size=L, origin=-(L // 2), mode="nearest")
    # m[n] = min over [n, n+L-1]; box-average over the past L samples
    c = np.concatenate([[0.0], np.cumsum(m)])
    idx = np.arange(len(m))
    lo = np.maximum(idx + 1 - L, 0)
    s = (c[idx + 1] - c[lo]) / (idx + 1 - lo)
    # release smoothing on a hop grid
    nb = int(np.ceil(len(s) / hop))
    sp = np.pad(s, (0, nb * hop - len(s)), constant_values=1.0).reshape(nb, hop).min(axis=1)
    ar = np.exp(-hop / (release * SR))
    gb = np.empty(nb)
    g = 1.0
    for i, v in enumerate(sp):
        g = v if v < g else ar * g + (1 - ar) * v
        gb[i] = g
    centers = np.arange(nb) * hop + hop / 2
    gi = np.interp(idx, centers, gb)
    gfin = np.minimum(s, gi)
    y = x * (gfin[:, None] if x.ndim == 2 else gfin)
    return y, gfin


# ------------------------------------------------------------------ loudness (BS.1770-4)

_K1 = np.array([[1.53512485958697, -2.69169618940638, 1.19839281085285,
                 1.0, -1.69065929318241, 0.73248077421585]])
_K2 = np.array([[1.0, -2.0, 1.0, 1.0, -1.99004745483398, 0.99007225036621]])


def k_weight(x):
    y = signal.sosfilt(_K1, x, axis=0)
    return signal.sosfilt(_K2, y, axis=0)


def _block_power(x, win, hop):
    y = k_weight(to_stereo(x))
    p = np.square(y).sum(axis=1)
    c = np.concatenate([[0.0], np.cumsum(p)])
    w, h = secs(win), secs(hop)
    starts = np.arange(0, len(p) - w + 1, h)
    return starts, (c[starts + w] - c[starts]) / w


def integrated_lufs(x):
    _, z = _block_power(x, 0.4, 0.1)
    l = -0.691 + 10 * np.log10(z + 1e-20)
    z1 = z[l > -70]
    if len(z1) == 0:
        return -70.0
    rel = -0.691 + 10 * np.log10(z1.mean()) - 10
    z2 = z1[(-0.691 + 10 * np.log10(z1 + 1e-20)) > rel]
    return -0.691 + 10 * np.log10(z2.mean())


def short_term_lufs(x, hop=0.1):
    """Short-term loudness (3 s window) sampled every hop; returns (times, lufs).

    times are window CENTRES.
    """
    starts, z = _block_power(x, 3.0, hop)
    return (starts / SR + 1.5), -0.691 + 10 * np.log10(z + 1e-20)


def momentary_lufs(x, hop=0.1):
    starts, z = _block_power(x, 0.4, hop)
    return (starts / SR + 0.2), -0.691 + 10 * np.log10(z + 1e-20)
