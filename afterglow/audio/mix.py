"""AFTERGLOW - mixing and mastering.

Signal flow
  soundfont renders + numpy synth parts  -> per-stem EQ / level / pan
  -> sends into three synthetic convolution reverbs (plate, hall, room)
  -> MUSIC bus = dry + returns -> 'memory colour' (tape saturation, high roll-off,
     wow & flutter) -> section level fit (dynamics arc)
  -> bus effects: beat cut, earbud, reality -> memory bloom, tape stop
  SFX bus (+ small room) and AMBIENCE bus are built separately.
  MASTER = music + sfx + ambience -> glue compression -> loudness trim -> true-peak
  limiter -> final fade -> 24-bit.
All times come from cues.py.
"""
import numpy as np

from cues import SR, N_SAMPLES, CUES, SECTIONS, section_bounds
from compose import T
import dsp
import synth as sy
import ambience as amb

# ------------------------------------------------------------------ targets
# Short-term loudness targets per section for the MUSIC bus before the bus effects
# (earbud / reality / tape stop are applied after the fit and lower their sections).
MUSIC_TARGET = {
    "intro": -21.8, "courtyard": -18.6, "tv": -18.2, "village": -19.8, "dialup": -22.5,
    "y2k": -14.0, "earbud": -14.0, "y2010": -13.4, "question": -20.5, "reality": -17.6,
    "first": -16.8, "who": -15.4, "people": -12.8, "imagined": -19.6, "today": -17.4,
    "rec": -12.8,
}
# ramp (s) used when moving between neighbouring section gains; the ramp ends at the
# boundary so a new scene starts at its own level ("cut" boundaries use short ramps)
FIT_RAMP = {"intro": 0.3, "courtyard": 1.5, "tv": 0.4, "village": 0.8, "dialup": 1.0, "y2k": 0.05,
            "earbud": 1.0, "y2010": 1.0, "question": 0.05, "reality": 0.05, "first": 1.0, "who": 1.5,
            "people": 1.5, "imagined": 1.5, "today": 0.5, "rec": 0.3}

MASTER_TARGET_LUFS = -15.0     # integrated
TRUE_PEAK_CEILING = -1.3       # dBTP (limiter ceiling; report checks <= -1.0)
STEM_REF = -20.0               # every stem is normalised to this active loudness first

# stem balance (dB relative to STEM_REF) and reverb sends (dB, None = off)
STEMS = {
    #  name          level  plate  hall   room
    "piano":        (0.0,  -13.0, -7.0,  None),
    "piano_bright": (-12.0, -14.0, -11.0, None),
    "musicbox":     (-13.0, -8.0,  -1.0,  None),
    "celesta":      (-10.5, -9.0,  -2.0,  None),
    "bells":        (-10.0, -10.0, -3.0,  None),
    "strings":      (-4.5,  None,  -5.0,  None),
    "cello":        (-5.0,  None,  -7.0,  None),
    "choir":        (-11.0, None,  -3.0,  None),
    "ep":           (-4.0,  -11.0, -16.0, None),
    "dr_kick":      (-5.0,  None,  None,  -18.0),
    "dr_snare":     (-7.0,  -16.0, None,  -12.0),
    "dr_hats":      (-14.0, None,  None,  -16.0),
    "dr_perc":      (-15.0, -18.0, None,  -14.0),
    "dr_brush":     (-15.0, -12.0, -12.0, None),
    "sub":          (-10.0, None,  None,  None),
    "pad":          (-11.0, None,  -6.0,  None),
    "shimmer":      (-17.0, None,  0.0,   None),
    "pluck":        (-10.5, -9.0,  -14.0, None),
    "chip":         (-9.5,  None,  None,  -10.0),
}

# per-stem level automation (dB offsets) as (time, dB) breakpoints
AUTO = {
    "piano": [(0, 0), (66, 0), (66.2, -1.5), (101.9, -1.5), (102.1, 0.5), (137, 0.5), (138, 1.5),
              (146, 1.0), (147, 0), (168, 1.0)],
    "pad": [(0, 0), (60, 0), (60.5, 2.0), (65.5, 2.0), (66, 0)],
    "strings": [(0, 0), (137.5, 0), (138.5, 1.0), (146.5, 0)],
}
# piano hall-send automation (dB offsets on the send)
PIANO_HALL = [(0, 3.0), (20.5, 3.0), (21.5, 0.0), (59.5, 0.0), (60.5, 2.0), (65.8, 2.0), (66.2, -9.0),
              (101.9, -9.0), (102.1, 4.0), (107.9, 4.0), (108.1, 0.0), (146.5, 0.0), (147.5, 2.5),
              (161.5, 0), (167.5, 0), (168.5, -2.0)]

# wow (cents) / flutter (cents) / high roll-off (Hz) of the 'memory colour' per time
WOW = [(0, 4.0), (60, 4.0), (66, 3.0), (89.5, 3.0), (90.5, 1.2), (101.9, 1.2), (102.1, 2.5), (110.8, 3.5),
       (120, 3.5), (147, 4.5), (156, 4.5), (162, 3.0), (168, 2.2)]
FLUTTER = [(0, 0.9), (66, 0.7), (90, 0.3), (102, 0.6), (162, 0.6), (168, 0.5)]
ROLLOFF = [(0, 9500), (21, 10500), (60, 10500), (66, 11000), (89.5, 11000), (90.5, 22000), (101.9, 22000),
           (102.1, 12500), (126, 12500), (147, 10000), (156, 10000), (162, 13000), (168, 22000)]

SFX_REVERB_SEND = -14.0   # dB into the room reverb for the SFX bus
AMB = {  # ambience levels (dBFS RMS)
    "hiss_open": -47.0, "hiss_bed": -60.0, "hiss_end": -50.0,
    "swallows": -39.0, "crickets": -35.0, "rain": -33.0, "crackle": -41.0,
}


def log_default(*a):
    print(*a, flush=True)


# ------------------------------------------------------------------ helpers

def active_lufs(x):
    try:
        return dsp.integrated_lufs(x)
    except Exception:
        return -70.0


def section_lufs(x, a, b):
    """Gated loudness of x within [a, b] seconds."""
    seg = x[dsp.secs(a):dsp.secs(b)]
    if len(seg) < dsp.secs(0.5):
        return -70.0
    return active_lufs(seg)


def mono_bass(x, fc=140.0):
    """Collapse the low end to mono (clean sub)."""
    lo = dsp.filt(x, dsp.butter("low", fc, 2), zero_phase=True)
    hi = x - lo
    lm = lo.mean(axis=1, keepdims=True)
    return hi + np.repeat(lm, 2, axis=1)


def sidechain_duck(x, key, depth_db=3.0, attack=0.005, release=0.18):
    env = np.abs(dsp.mono(key))
    lvl = dsp.filt(env, dsp.butter("low", 30, 1))
    lvl = lvl / (np.max(lvl) + 1e-12)
    g = dsp.db2lin(-depth_db * np.clip(lvl * 3.0, 0, 1))
    # smooth with attack/release on a hop grid
    gdb = dsp.lin2db(g)
    hop = 32
    gs = dsp._smooth_gain(gdb[::hop], attack, release, hop)
    gi = dsp.db2lin(np.interp(np.arange(len(x)), np.arange(0, len(x), hop), gs))
    return x * gi[:, None]


def sub_kick_layer(kick_part):
    """A soft sine 'thump' under each acoustic kick for weight."""
    y = np.zeros(N_SAMPLES)
    n = dsp.secs(0.35)
    t = np.arange(n) / SR
    f = 50 + 45 * np.exp(-t / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.13)
    body[:48] *= np.linspace(0, 1, 48)
    for d in kick_part.performed():
        dsp.place(y, body * (d["v"] / 100.0), d["t"])
    return dsp.to_stereo(y)


# ------------------------------------------------------------------ stems

def prepare_stems(R, Y, S, log=log_default):
    """Per-stem EQ/processing, loudness normalisation and level automation."""
    stems = {}
    raw = dict(R)
    raw.update(Y)
    # kick: add the sub layer
    raw["dr_kick"] = raw["dr_kick"] / (np.max(np.abs(raw["dr_kick"])) + 1e-12) + 0.30 * sub_kick_layer(S["dr_kick"])
    EQ = {
        "piano": dsp.eq(dsp.butter("high", 32, 2), dsp.rbj("peak", 260, 1.0, -1.5), dsp.rbj("peak", 2600, 0.9, 1.5),
                        dsp.rbj("highshelf", 7000, 0.7, -2.0)),
        "piano_bright": dsp.eq(dsp.butter("high", 120, 2), dsp.rbj("highshelf", 5000, 0.7, 1.0)),
        "musicbox": dsp.eq(dsp.butter("high", 350, 2), dsp.butter("low", 9000, 2)),
        "celesta": dsp.eq(dsp.butter("high", 250, 2), dsp.butter("low", 10000, 2)),
        "bells": dsp.eq(dsp.butter("high", 220, 2), dsp.rbj("highshelf", 6000, 0.7, -2.0)),
        "strings": dsp.eq(dsp.butter("high", 38, 2), dsp.rbj("peak", 2800, 0.9, -2.5), dsp.rbj("peak", 220, 0.8, 1.0),
                          dsp.butter("low", 11000, 2)),
        "cello": dsp.eq(dsp.butter("high", 55, 2), dsp.rbj("peak", 240, 0.9, 1.5), dsp.rbj("peak", 3000, 1.0, -2.0)),
        "choir": dsp.eq(dsp.butter("high", 160, 2), dsp.butter("low", 8500, 2), dsp.rbj("peak", 3000, 1.0, -2.0)),
        "ep": dsp.eq(dsp.butter("high", 90, 2), dsp.butter("low", 6500, 2), dsp.rbj("peak", 320, 1.0, -1.5)),
        "dr_kick": dsp.eq(dsp.butter("high", 42, 2), dsp.butter("low", 4000, 2), dsp.rbj("peak", 2500, 1.0, 2.0)),
        "dr_snare": dsp.eq(dsp.butter("high", 130, 2), dsp.butter("low", 8500, 2), dsp.rbj("peak", 900, 1.0, 1.5)),
        "dr_hats": dsp.eq(dsp.butter("high", 4000, 2), dsp.butter("low", 10500, 2)),
        "dr_perc": dsp.eq(dsp.butter("high", 1500, 2), dsp.butter("low", 11000, 2)),
        "dr_brush": dsp.eq(dsp.butter("high", 400, 2), dsp.butter("low", 9000, 2)),
        "sub": dsp.eq(dsp.butter("high", 28, 2), dsp.butter("low", 220, 2)),
        "pad": dsp.eq(dsp.butter("high", 90, 2), dsp.butter("low", 7000, 2)),
        "shimmer": dsp.eq(dsp.butter("high", 900, 2), dsp.butter("low", 12000, 2)),
        "pluck": dsp.eq(dsp.butter("high", 220, 2), dsp.butter("low", 12000, 2)),
        "chip": dsp.eq(dsp.butter("high", 170, 2), dsp.butter("low", 7500, 2), dsp.rbj("peak", 2000, 1.0, 2.0)),
    }
    for name, (lvl, _, _, _) in STEMS.items():
        x = raw[name]
        x = dsp.filt(x, EQ[name]) if name in EQ else x
        if name == "ep":
            x = dsp.tape_sat(x / (np.max(np.abs(x)) + 1e-12) * 0.5, 4.0) * 2.0
            x = sidechain_duck(x, raw["dr_kick"], depth_db=2.5)
        if name == "sub":
            x = sidechain_duck(x, raw["dr_kick"], depth_db=3.0, release=0.12)
        if name == "dr_snare":
            x = dsp.tape_sat(x / (np.max(np.abs(x)) + 1e-12) * 0.8, 6.0)
        l0 = active_lufs(x)
        g = STEM_REF - l0 + lvl
        x = x * dsp.db2lin(g)
        if name in AUTO:
            x = x * dsp.db_curve(AUTO[name])[:, None]
        stems[name] = x
    return stems


# ------------------------------------------------------------------ reverbs

_IRS = {}


def irs():
    if not _IRS:
        _IRS["plate"] = dsp.make_ir(rt60=2.1, predelay=0.022, rt_low=1.1, rt_high=0.55, f_high=4500,
                                    hf_cut=11000, lf_cut=120, build=0.008, er_taps=6, er_level=0.2, seed=11)
        _IRS["hall"] = dsp.make_ir(rt60=3.4, predelay=0.036, rt_low=1.2, rt_high=0.38, f_high=3500,
                                   hf_cut=7500, lf_cut=90, build=0.06, er_taps=12, er_level=0.35, seed=23)
        _IRS["room"] = dsp.make_ir(rt60=0.55, predelay=0.008, rt_low=0.9, rt_high=0.6, f_high=4000,
                                   hf_cut=9000, lf_cut=150, build=0.004, er_taps=10, er_level=0.5, seed=31)
    return _IRS


def reverb_returns(stems, log=log_default):
    sends = {"plate": dsp.zeros(), "hall": dsp.zeros(), "room": dsp.zeros()}
    for name, (lvl, sp, sh, sr_) in STEMS.items():
        x = stems[name]
        for bus, db in (("plate", sp), ("hall", sh), ("room", sr_)):
            if db is None:
                continue
            g = dsp.db2lin(db)
            if name == "piano" and bus == "hall":
                sends[bus] += x * (g * dsp.db_curve(PIANO_HALL))[:, None]
            else:
                sends[bus] += x * g
    rets = {}
    for bus, x in sends.items():
        pre = dsp.filt(x, dsp.eq(dsp.butter("high", 140 if bus != "room" else 180, 2)))
        rets[bus] = dsp.convolve_reverb(pre, irs()[bus])
    return rets


# ------------------------------------------------------------------ bus effects

def beat_cut(stems, t_cut):
    """Hard stop of the beat stems at the cut (their reverb tails keep ringing)."""
    n = dsp.secs(t_cut)
    f = dsp.secs(0.004)
    for name in ("dr_kick", "dr_snare", "dr_hats", "dr_perc", "sub", "ep", "pluck", "piano_bright", "pad"):
        x = stems[name]
        if name == "pad":
            # only the 2010s pad is cut; later pads start after 108 s anyway
            pass
        seg_end = dsp.secs(t_cut + 5.5)
        w = np.ones(N_SAMPLES)
        w[n - f:n] = np.linspace(1, 0, f)
        w[n:seg_end] = 0.0
        if name in ("dr_kick", "dr_snare", "dr_hats", "dr_perc"):
            w[n:] = np.where(np.arange(n, N_SAMPLES) < dsp.secs(165.0), 0.0, 1.0)  # REC drums come back
        stems[name] = x * w[:, None]


def colour(x, rng, t0=0.0):
    """'Memory colour': tape saturation, time-varying high roll-off, wow & flutter."""
    n = len(x)
    y = dsp.tape_sat(x, drive_db=3.0, asym=0.05)
    fc = dsp.curve(ROLLOFF, n, t0)
    y = dsp.tv_lowpass(y, fc)
    y = dsp.wow_flutter(y, dsp.curve(WOW, n, t0), dsp.curve(FLUTTER, n, t0), rng, t0=t0)
    return y


def earbud(x):
    """84.0-89.0: through one earbud (narrow, 200 Hz-3.5 kHz, quieter); opens 89-90."""
    a, b, c = CUES["earbud"]
    n0, n1 = dsp.secs(a - 0.1), dsp.secs(c + 0.1)
    seg = x[n0:n1]
    bud = dsp.filt(seg, dsp.eq(dsp.butter("high", 200, 2), dsp.butter("low", 3500, 2),
                               dsp.rbj("peak", 2400, 1.2, 2.5), dsp.rbj("peak", 900, 0.8, 1.5)), zero_phase=True)
    bud = dsp.width(bud, 0.12) * dsp.db2lin(-3.0)
    w = dsp.curve([(a - 0.08, 0.0), (a, 1.0), (b, 1.0), (c, 0.0)], len(seg), a - 0.1)
    w = np.clip(w, 0, 1)
    out = x.copy()
    out[n0:n1] = seg * np.sqrt(1 - w)[:, None] + bud * np.sqrt(w)[:, None]
    return out


def reality_memory(dry, full, rng):
    """108.0-110.8 reality (dry, dull, mono, wobbly) -> bloom into memory by 111.8."""
    a, b = CUES["reality"]
    b0, b1 = CUES["bloom"]
    n0, n1 = dsp.secs(a - 0.5), dsp.secs(b1 + 0.5)
    seg = dry[n0:n1]
    m = dsp.mono(seg)
    m = dsp.filt(m, dsp.eq(dsp.butter("low", 1800, 4), dsp.butter("high", 150, 2), dsp.rbj("peak", 900, 1.0, 2.0)))
    nn = len(m)
    tt = np.arange(nn) / SR
    wob = 16.0 * np.sin(2 * np.pi * 0.83 * tt + 0.3) + 7.0 * np.sin(2 * np.pi * 1.9 * tt) + 5.0 * dsp.smooth_random(nn, 1.5, rng)
    ratio = 2.0 ** ((wob - 9.0) / 1200.0)          # slightly flat and wobbly
    drift = np.cumsum(ratio - 1.0)
    drift -= np.linspace(0, drift[-1], nn)
    m = dsp.read_at(m, np.arange(nn) + drift)
    real = dsp.to_stereo(m) * dsp.db2lin(-1.5)
    w = np.clip(dsp.curve([(a - 0.03, 0.0), (a, 1.0), (b0, 1.0), (b1, 0.0)], nn, a - 0.5), 0, 1)
    out = full.copy()
    out[n0:n1] = full[n0:n1] * np.sqrt(1 - w)[:, None] + real * np.sqrt(w)[:, None]
    return out


def reverse_swell(R, rng):
    """8.2-9.0: reversed reverb of the m0 chord, sucking into the downbeat at 9.0."""
    a, b = CUES["reverse_swell"]
    x = R["piano_swell"]
    n0 = dsp.secs(b)
    src = x[n0:n0 + dsp.secs(5.0)]
    wet = dsp.convolve_reverb_full(src, irs()["hall"])[:dsp.secs(4.0)]
    wet = dsp.filt(wet, dsp.eq(dsp.butter("high", 120, 2), dsp.butter("low", 7000, 2)))
    rev = wet[::-1]
    L = len(rev)
    lead = b - a
    t = np.arange(L) / SR - (L / SR - lead)       # 0 at the start of the audible swell
    env = np.clip(t / lead, 0, 1) ** 2.2
    rev = rev * env[:, None]
    rev = dsp.fade(rev, 0.0, 0.006)
    out = dsp.zeros()
    dsp.place(out, rev, b - L / SR)
    return out


# ------------------------------------------------------------------ music bus

def build_music(R, Y, S, log=log_default):
    rng = np.random.default_rng(77)
    log("  stems: EQ / level")
    stems = prepare_stems(R, Y, S, log)
    beat_cut(stems, CUES["beat_cut"])
    ts0, ts1 = CUES["tape_stop"]
    sil = dsp.curve([(0, 1), (ts1 + 0.05, 1), (ts1 + 0.1, 0), (T(51) - 0.5, 0), (T(51) - 0.45, 1)], smooth=True)
    for k in stems:
        stems[k] = stems[k] * sil[:, None]
    log("  reverbs (plate / hall / room)")
    rets = reverb_returns(stems, log)
    dry = sum(stems.values())
    # vinyl crackle on the music bus in the 2000s (lighter in the 2010s)
    crk = amb.vinyl_crackle(dsp.secs(38.0), np.random.default_rng(5))
    crk /= np.sqrt(np.mean(crk ** 2)) + 1e-12
    crk_bus = dsp.zeros()
    dsp.place(crk_bus, crk, 65.8)
    crk_env = dsp.db_curve([(0, -80), (65.8, -80), (66.0, 0), (89.5, 0), (90.5, -8), (101.8, -8), (102.0, -80)])
    crk_bus *= crk_env[:, None] * dsp.db2lin(AMB["crackle"])
    swell = reverse_swell(R, rng)
    # level the swell against the first piano chord it leads into
    ref = np.max(np.abs(stems["piano"][dsp.secs(9.0):dsp.secs(10.5)]))
    swell *= 0.9 * ref / (np.max(np.abs(swell)) + 1e-12)
    wet = rets["plate"] + rets["hall"] + rets["room"]
    full = dry + wet + swell
    full = mono_bass(full)
    log("  memory colour (tape saturation, roll-off, wow & flutter)")
    full = colour(full, np.random.default_rng(1))
    w0, w1 = CUES["reality"][0] - 1.5, CUES["bloom"][1] + 1.5
    dry_c = dsp.zeros()
    dry_c[dsp.secs(w0):dsp.secs(w1)] = colour(dry[dsp.secs(w0):dsp.secs(w1)], np.random.default_rng(1), t0=w0)
    # section level fit (dynamics arc)
    gains = fit_arc(full, log)
    gcurve = gain_curve(gains)
    full = full * gcurve[:, None]
    dry_c = dry_c * gcurve[:, None]
    full = full + crk_bus
    log("  bus effects: earbud, reality->memory, tape stop")
    full = earbud(full)
    full = reality_memory(dry_c, full, np.random.default_rng(3))
    a, b = CUES["tape_stop"]
    full = dsp.tape_stop(full, a, b - a, resume_at=T(51) - 0.3)
    # the music fades a little ahead of the master so the film ends on tape hiss
    fo0, fo1 = CUES["fade_out"]
    full *= dsp.db_curve([(0, 0), (fo0 - 0.4, 0), (fo1 - 0.6, -80)])[:, None]
    return full, stems, rets, gains


def fit_arc(x, log=log_default):
    gains = {}
    for key, label, a, b in SECTIONS:
        if key not in MUSIC_TARGET:
            continue
        l = section_lufs(x, a + 0.2, b - 0.2)
        g = float(np.clip(MUSIC_TARGET[key] - l, -9.0, 9.0)) if l > -65 else 0.0
        gains[key] = g
    log("  arc fit (dB): " + ", ".join(f"{k} {v:+.1f}" for k, v in gains.items()))
    return gains


def gain_curve(gains):
    """Hold each section's fitted gain; ramp into the next one over FIT_RAMP[next] s."""
    keys = [(k, a, b) for k, _, a, b in SECTIONS if k in gains]
    pts = []
    for i, (k, a, b) in enumerate(keys):
        g = gains[k]
        if i == 0:
            pts.append((0.0, g))
        pts.append((a, g))
        if i + 1 < len(keys):
            nk, na, nb = keys[i + 1]
            pts.append((na - FIT_RAMP.get(nk, 0.5), g))
        else:
            pts.append((b, g))
    return dsp.db_curve(pts)


# ------------------------------------------------------------------ ambience & sfx buses

def build_ambience(log=log_default):
    rng = np.random.default_rng(99)
    bus = dsp.zeros()
    hiss = amb.tape_hiss(N_SAMPLES, rng)
    ho = CUES["hiss_open"]
    he = CUES["hiss_tape_end"]
    fo = CUES["fade_out"]
    bed, opn, end = AMB["hiss_bed"], AMB["hiss_open"], AMB["hiss_end"]
    hiss_env = dsp.db_curve([
        (0.0, opn), (ho[1] - 0.4, opn), (ho[1] + 1.2, bed), (60.0, bed), (61.0, -80), (156.3, -80),
        (he[0] - 0.05, -80), (he[0] + 0.05, end), (he[1] - 1.0, end), (he[1] + 1.0, bed - 2),
        (168.0, bed - 2), (168.3, bed + 3), (fo[0], bed + 3), (fo[1], -90)], smooth=True)
    hiss_env[:dsp.secs(0.05)] *= np.linspace(0, 1, dsp.secs(0.05))
    bus += hiss * hiss_env[:, None]
    a, b = CUES["swallows"]
    sw = amb.swallows_and_wind(a, b, rng)
    dsp.place(bus, sw * dsp.db2lin(AMB["swallows"]) / (np.sqrt(np.mean(sw ** 2)) + 1e-12), a)
    a, b = CUES["crickets"]
    cr = amb.crickets_night(a, b, rng)
    cr = cr / (np.sqrt(np.mean(cr ** 2)) + 1e-12) * dsp.db2lin(AMB["crickets"])
    dsp.place(bus, cr, a - 0.2)
    a, b = CUES["rain"]
    b1 = CUES["bloom"][1]
    rn = amb.rain(b1 - a + 0.3, rng)
    rn = rn / (np.sqrt(np.mean(rn ** 2)) + 1e-12) * dsp.db2lin(AMB["rain"])
    tt = np.arange(len(rn)) / SR + a
    renv = np.clip((tt - a) / 0.08, 0, 1) * np.clip((b1 - tt) / (b1 - b), 0, 1) ** 1.5
    dsp.place(bus, rn * renv[:, None], a)
    return bus


def build_sfx_bus(log=log_default):
    import sfx
    bus, ev = sfx.build_sfx()
    wet = dsp.convolve_reverb(dsp.filt(bus, dsp.butter("high", 200, 2)), irs()["room"]) * dsp.db2lin(SFX_REVERB_SEND)
    return bus + wet, ev


# ------------------------------------------------------------------ master

def master(music, sfx_bus, amb_bus, log=log_default):
    mix = music + sfx_bus + amb_bus
    mix -= np.mean(mix, axis=0, keepdims=True)                      # no DC
    mix = dsp.filt(mix, dsp.butter("high", 22, 2))
    # gentle glue compression
    mix = dsp.compressor(mix, thr_db=-20.0, ratio=1.6, attack=0.03, release=0.35, knee_db=8.0)
    # loudness trim to target (measured before limiting, then re-checked)
    li = dsp.integrated_lufs(mix)
    trim = MASTER_TARGET_LUFS - li
    mix *= dsp.db2lin(trim)
    log(f"  master: pre-limit integrated {li:.2f} LUFS, trim {trim:+.2f} dB")
    # true-peak limiter; re-trim until the integrated loudness sits on target
    for it in range(4):
        y, g = dsp.limiter(mix, ceiling_db=TRUE_PEAK_CEILING, lookahead=0.003, release=0.15)
        li2 = dsp.integrated_lufs(y)
        if abs(li2 - MASTER_TARGET_LUFS) < 0.08:
            break
        mix *= dsp.db2lin(MASTER_TARGET_LUFS - li2)
        trim += MASTER_TARGET_LUFS - li2
    fo0, fo1 = CUES["fade_out"]
    y = y * dsp.db_curve([(0, 0), (fo1 - 1.0, 0), (fo1, -90)])[:, None]
    y[:dsp.secs(0.002)] *= np.linspace(0, 1, dsp.secs(0.002))[:, None]
    tp = dsp.true_peak_db(y)
    if tp > TRUE_PEAK_CEILING + 0.05:
        y *= dsp.db2lin(TRUE_PEAK_CEILING - tp)
    log(f"  master: integrated {dsp.integrated_lufs(y):.2f} LUFS, true peak {dsp.true_peak_db(y):.2f} dBTP, "
        f"max GR {-dsp.lin2db(np.min(g)):.2f} dB")
    return y, trim
