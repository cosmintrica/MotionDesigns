"""AFTERGLOW sound effects - all synthesised (modal/FM/noise), all original.

Each generator returns a stereo array normalised to 0 dBFS peak; the mixer sets
the level.  `build_sfx()` places everything at the times in cues.CUES.
"""
import numpy as np

from cues import SR, N_SAMPLES, CUES
import dsp
import synth as sy

# ------------------------------------------------------------------ helpers


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) + 1e-12
    return x * (peak / m)


def st(x, p=0.0, w=0.0, rng=None):
    """Mono -> stereo with pan p and optional micro-delay decorrelation w (ms)."""
    y = dsp.pan(x, p)
    if w > 0:
        d = dsp.secs(w / 1000.0)
        y[d:, 1] = y[:-d, 1].copy() if d > 0 else y[:, 1]
    return y


def plastic_click(rng, size=1.0, bright=1.0, dur=0.08):
    """Hard-plastic click: a few bright modes + a body mode."""
    k = rng.integers(5, 9)
    fr = rng.uniform(1300, 6800, k) * (0.8 + 0.4 * bright)
    dc = rng.uniform(0.004, 0.018, k) * size
    am = rng.uniform(0.3, 1.0, k)
    body = [rng.uniform(380, 700) / size, rng.uniform(900, 1500)]
    y = sy.modal(list(fr) + body, list(dc) + [0.02 * size, 0.012 * size], list(am) + [0.9, 0.5],
                 dur, rng, exc=0.0006)
    return norm(y)


def thump(f0=110.0, f1=70.0, dur=0.25, decay=0.06):
    n = dsp.secs(dur)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.02)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-t / decay)
    y[:24] *= np.linspace(0, 1, 24)
    return norm(y)


def band_noise(dur, lo, hi, rng, order=2):
    n = dsp.secs(dur)
    x = rng.standard_normal(n)
    return dsp.filt(x, dsp.butter("band", [lo, hi], order))


def motor(dur, rng, f_run=48.0, spinup=0.35, level_curve=None):
    """Small DC motor + capstan: hum spinning up, harmonics, faint whirr."""
    n = dsp.secs(dur)
    t = np.arange(n) / SR
    f = f_run * (1 - np.exp(-t / (spinup / 3)))
    f *= 1 + 0.004 * np.sin(2 * np.pi * 0.9 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    hum = sum(a * np.sin(k * ph + rng.random() * 6) for k, a in ((1, 0.5), (2, 1.0), (3, 0.45), (4, 0.3), (6, 0.15)))
    whirr = band_noise(dur, 1800, 5500, rng) * 0.25
    whirr *= 1 + 0.4 * np.sin(2 * np.pi * (f * 0.5) * t)
    y = hum * 0.6 + whirr
    if level_curve is not None:
        y *= level_curve
    return y


# ------------------------------------------------------------------ cold open

def case_open(rng):
    out = np.zeros(dsp.secs(0.4))
    latch = plastic_click(rng, size=0.6, bright=1.2, dur=0.06) * 0.55
    slide = band_noise(0.05, 900, 3500, rng) * np.hanning(dsp.secs(0.05)) * 0.12
    stop = plastic_click(rng, size=1.3, bright=0.9, dur=0.12)
    dsp.place(out, latch, 0.0)
    dsp.place(out, slide, 0.03)
    dsp.place(out, stop, 0.10)
    dsp.place(out, plastic_click(rng, 0.5, 1.0, 0.04) * 0.2, 0.135)          # tiny bounce
    return st(norm(out), -0.15, 0.25)


def cassette_desk(rng):
    out = np.zeros(dsp.secs(0.35))
    dsp.place(out, thump(170, 120, 0.25, 0.045) * 0.8, 0.0)
    dsp.place(out, plastic_click(rng, size=1.6, bright=0.6, dur=0.15) * 0.8, 0.002)
    for k in range(4):                                                     # loose reels rattle
        dsp.place(out, plastic_click(rng, 0.35, 1.3, 0.03) * rng.uniform(0.08, 0.18),
                  0.03 + k * rng.uniform(0.012, 0.025))
    return st(norm(out), 0.1, 0.2)


def pencil_rewind(dur, rng):
    """Pencil in the hub: ratchet clicks in hand strokes, speeding up then slowing."""
    n = dsp.secs(dur)
    t = np.arange(n) / SR
    u = t / dur
    arc = np.sin(np.pi * np.clip(u, 0, 1)) ** 0.7                          # speed up, then slow down
    stroke_len = 0.46 - 0.12 * arc                                         # quicker strokes mid-way
    sp = np.cumsum(1.0 / stroke_len) / SR
    stroke = np.sin(np.pi * (sp % 1.0)) ** 2                               # each twist accelerates/decelerates
    speed = (0.25 + 0.75 * arc) * (0.15 + 0.85 * stroke)
    rate = 34.0 * speed                                                    # hub teeth per second
    phase = np.cumsum(rate) / SR
    ticks = np.nonzero(np.diff(np.floor(phase)) > 0)[0]
    out = np.zeros(n + dsp.secs(0.1))
    for i in ticks:
        a = (0.35 + 0.65 * speed[i]) * rng.uniform(0.6, 1.0)
        c = plastic_click(rng, size=rng.uniform(0.35, 0.55), bright=1.1, dur=0.03)
        out[i:i + len(c)] += c * a * 0.5
    # reel/tape friction + pencil rubbing, following the speed
    fr1 = band_noise(dur, 700, 2600, rng) * speed * 0.10
    fr2 = band_noise(dur, 250, 700, rng) * speed * 0.06
    tape = band_noise(dur, 3000, 9000, rng) * (speed ** 1.5) * 0.035
    wh = np.sin(2 * np.pi * np.cumsum(90 + 140 * speed) / SR) * speed * 0.02  # spinning reel tone
    out[:n] += fr1 + fr2 + tape + wh
    out = dsp.fade(out, 0.05, 0.08)
    return st(norm(out), -0.05, 0.3)


def cassette_in(rng):
    out = np.zeros(dsp.secs(0.5))
    sl = band_noise(0.10, 600, 4000, rng)
    sl *= np.linspace(0.2, 1.0, len(sl)) ** 1.5
    dsp.place(out, sl * 0.25, 0.0)                                         # slide into the well
    dsp.place(out, plastic_click(rng, 1.1, 0.9, 0.1), 0.10)                # seats (cue time)
    dsp.place(out, thump(140, 90, 0.2, 0.03) * 0.5, 0.10)
    dsp.place(out, plastic_click(rng, 1.4, 0.7, 0.12) * 0.8, 0.27)         # door closes
    dsp.place(out, thump(120, 80, 0.2, 0.04) * 0.6, 0.27)
    return st(norm(out), 0.05, 0.3)


def key_clunk(rng, heavy=1.0):
    """Cassette-deck key: travel click, lever clunk, metal ring."""
    out = np.zeros(dsp.secs(0.5))
    dsp.place(out, plastic_click(rng, 0.6, 1.2, 0.04) * 0.35, 0.0)           # key travel
    t0 = 0.03
    dsp.place(out, thump(120 * heavy ** -0.3, 75, 0.3, 0.05 + 0.02 * heavy) * (0.9 + 0.3 * heavy), t0)
    knock = sy.modal([310, 540, 790, 1150, 1720], [0.03, 0.025, 0.02, 0.015, 0.012],
                     [1.0, 0.8, 0.6, 0.45, 0.3], 0.2, rng, exc=0.001)
    dsp.place(out, norm(knock) * 0.8, t0)
    latch = sy.modal([2600, 3900, 5300, 7100], [0.012, 0.01, 0.008, 0.006], [1, .8, .5, .3], 0.06, rng,
                     exc=0.0004)
    dsp.place(out, norm(latch) * 0.5, t0 + 0.004)
    ring = sy.modal([3150, 4720], [0.12, 0.09], [1, 0.6], 0.3, rng, exc=0.0003)
    dsp.place(out, norm(ring) * 0.07, t0 + 0.002)
    dsp.place(out, plastic_click(rng, 0.8, 0.9, 0.06) * 0.3, t0 + 0.035)   # settle
    if heavy > 1.0:                                                         # second key (REC+PLAY)
        dsp.place(out, norm(knock) * 0.55, t0 + 0.016)
        dsp.place(out, thump(95, 60, 0.3, 0.07) * 0.8, t0 + 0.016)
    return norm(out)


def play_clunk(rng, motor_dur=3.2):
    clunk = key_clunk(rng, 1.0)
    n = dsp.secs(motor_dur)
    lv = np.ones(n)
    lv[:dsp.secs(0.05)] = 0
    fo = dsp.secs(1.8)
    lv[-fo:] *= np.linspace(1, 0, fo) ** 2
    m = motor(motor_dur, rng, level_curve=lv) * 0.06
    out = np.zeros(max(len(clunk), n) + 10)
    dsp.place(out, clunk, 0.0)
    dsp.place(out, m, 0.05)
    return st(out, 0.0, 0.2)


# ------------------------------------------------------------------ '90s courtyard

def ball_stop(rng):
    out = np.zeros(dsp.secs(0.4))
    dsp.place(out, thump(230, 150, 0.2, 0.035) * 0.9, 0.0)                 # ball compresses
    sc = band_noise(0.09, 900, 3800, rng) * np.hanning(dsp.secs(0.09)) ** 0.5
    dsp.place(out, sc * 0.35, 0.005)                                       # sole scuffs on asphalt
    grit = band_noise(0.05, 3000, 8000, rng) * np.exp(-np.arange(dsp.secs(0.05)) / SR / 0.01)
    dsp.place(out, grit * 0.2, 0.004)
    return st(norm(out), 0.12, 0.2)


def streetlight(rng):
    """Ballast/starter ticks, then the lamp strikes with a 100 Hz hum that settles."""
    dur = 1.5
    n = dsp.secs(dur)
    out = np.zeros(n)
    for tk, a in ((0.0, 1.0), (0.13, 0.7), (0.31, 0.9)):
        c = sy.modal([1900, 3100, 4600], [0.006, 0.005, 0.004], [1, .7, .4], 0.03, rng, exc=0.0004)
        dsp.place(out, norm(c) * a * 0.8, tk)
        bz = np.sin(2 * np.pi * 100 * np.arange(dsp.secs(0.05)) / SR)
        bz = np.sign(bz) * np.abs(bz) ** 0.3 * np.hanning(len(bz)) * 0.15
        dsp.place(out, bz, tk + 0.004)
    t = np.arange(n) / SR
    env = np.clip((t - 0.34) / 0.05, 0, 1) * (0.6 + 0.4 * np.exp(-np.maximum(t - 0.34, 0) / 0.2))
    env *= np.clip((dur - t) / 0.7, 0, 1) ** 1.5
    hum = sum(a * np.sin(2 * np.pi * 100 * k * t + k) for k, a in ((1, 1), (2, .5), (3, .35), (5, .2), (7, .12)))
    buzz = band_noise(dur, 2000, 6000, rng) * (0.5 + 0.5 * np.sin(2 * np.pi * 100 * t)) * 0.08
    out += (hum * 0.12 + buzz) * env
    return st(norm(out), 0.35, 0.3)


# ------------------------------------------------------------------ TV / console

def crt_on(rng):
    dur = 3.4
    n = dsp.secs(dur)
    t = np.arange(n) / SR
    out = np.zeros(n)
    rel = sy.modal([2300, 3400], [0.008, 0.006], [1, .6], 0.03, rng, exc=0.0004)
    dsp.place(out, norm(rel) * 0.4, 0.0)                                    # relay
    # degauss: 50 Hz coil current decaying + shadow-mask buzz, and a thunk
    e = np.exp(-t / 0.28) * np.clip(t / 0.01, 0, 1)
    coil = np.sin(2 * np.pi * 50 * t)
    mask = np.tanh(3 * coil) * 0.5 + 0.25 * np.sin(2 * np.pi * 100 * t + 0.5)
    mask_hi = band_noise(dur, 400, 2500, rng) * (np.abs(coil) ** 4) * 0.35
    out += (mask + mask_hi) * e * 0.55
    dsp.place(out, thump(90, 45, 0.5, 0.12) * 0.9, 0.01)
    # static crackle on the glass
    for k in range(34):
        tk = 0.04 + rng.exponential(0.22)
        if tk > 1.3:
            continue
        c = dsp.filt(rng.standard_normal(dsp.secs(0.004)), dsp.butter("high", 2500, 2))
        c *= np.exp(-np.arange(len(c)) / SR / 0.0008) * rng.uniform(0.2, 1.0) * np.exp(-tk / 0.6)
        dsp.place(out, c * 0.9, tk)
    # picture-tube whoosh
    wh = band_noise(0.5, 1500, 7000, rng) * np.hanning(dsp.secs(0.5)) * 0.18
    dsp.place(out, wh, 0.05)
    # faint flyback whine (PAL line frequency), fades in and slowly out
    wenv = np.clip((t - 0.15) / 0.4, 0, 1) * np.clip((dur - t) / 1.6, 0, 1)
    out += np.sin(2 * np.pi * 15625 * t) * wenv * 0.012
    return st(norm(out), 0.0, 0.4)


def chip_blip(kind, rng):
    """8-bit game sounds (original): 'jump' = rising pulse sweep, 'coin' = D-major triad pickup."""
    if kind == "jump":
        dur = 0.22
        n = dsp.secs(dur)
        t = np.arange(n) / SR
        f = 280 * 2 ** (2.2 * t / dur) * (1 + 0.02 * np.sin(2 * np.pi * 40 * t))
        ph = np.cumsum(f) / SR
        x = np.where((ph % 1.0) < 0.25, 1.0, -1.0) * 0.8
        env = np.round(np.exp(-t / 0.12) * 15) / 15
        y = x * env
    else:
        notes = [(0.0, 0.045, 1175), (0.045, 0.045, 1480), (0.09, 0.22, 1760)]
        y = np.zeros(dsp.secs(0.33))
        for t0, d, f in notes:
            nn = dsp.secs(d)
            tt = np.arange(nn) / SR
            x = np.where(((f * tt) % 1.0) < 0.5, 1.0, -1.0)
            env = np.round(np.exp(-tt / (0.08 if d > 0.1 else 0.2)) * 15) / 15
            dsp.place(y, x * env * 0.6, t0)
    y = dsp.filt(y, dsp.butter("low", 7000, 2))
    y = dsp.fade(y, 0.001, 0.005)
    return st(norm(y), 0.0)


def tv_freeze_buzz(dur, rng):
    n = dsp.secs(dur)
    t = np.arange(n) / SR
    x = np.sign(np.sin(2 * np.pi * 60 * t)) * 0.5 + band_noise(dur, 800, 3000, rng) * 0.3
    x *= (0.6 + 0.4 * (np.sin(2 * np.pi * 7 * t) > 0))
    x = dsp.filt(x, dsp.butter("band", [150, 3500], 2))
    return st(norm(dsp.fade(x, 0.004, 0.01)), 0.0)


# ------------------------------------------------------------------ dial-up

def _tone(freqs, dur, amps=None, phase=None):
    n = dsp.secs(dur)
    t = np.arange(n) / SR
    amps = amps or [1.0] * len(freqs)
    y = sum(a * np.sin(2 * np.pi * f * t) for f, a in zip(freqs, amps))
    return dsp.fade(y, 0.004, 0.004)


def _fsk(dur, f_mark, f_space, baud, rng):
    n = dsp.secs(dur)
    nb = int(np.ceil(dur * baud)) + 1
    bits = rng.integers(0, 2, nb)
    f = np.where(bits[(np.arange(n) * baud / SR).astype(int)] > 0, f_mark, f_space)
    return dsp.fade(np.sin(2 * np.pi * np.cumsum(f) / SR), 0.004, 0.004)


def modem(dur, rng):
    """Compressed dial-up handshake, heard through a small PC speaker."""
    n = dsp.secs(dur)
    y = np.zeros(n)
    # off-hook click + line
    c = sy.modal([1700, 2900], [0.006, 0.004], [1, .5], 0.02, rng)
    dsp.place(y, norm(c) * 0.5, 0.0)
    dsp.place(y, _tone([350, 440], 0.52) * 0.30, 0.05)                        # dial tone
    digits = {"1": (697, 1209), "2": (697, 1336), "4": (770, 1209), "5": (770, 1336), "6": (770, 1477),
              "8": (852, 1336), "9": (852, 1477), "0": (941, 1336), "3": (697, 1477), "7": (852, 1209)}
    t = 0.62
    for d in "4862915":
        dsp.place(y, _tone(digits[d], 0.068) * 0.32, t)                       # DTMF
        t += 0.103
    dsp.place(y, _tone([440, 480], 0.36) * 0.26, 1.40)                        # ringback
    c2 = sy.modal([1500, 2600], [0.005, 0.004], [1, .5], 0.02, rng)
    dsp.place(y, norm(c2) * 0.3, 1.80)                                        # line picks up
    # ANSam: 2100 Hz, 15 Hz AM, phase reversal every 450 ms
    na = dsp.secs(0.55)
    ta = np.arange(na) / SR
    ph = np.pi * np.floor(ta / 0.45)
    ans = np.sin(2 * np.pi * 2100 * ta + ph) * (1 + 0.2 * np.sin(2 * np.pi * 15 * ta))
    dsp.place(y, dsp.fade(ans, 0.005, 0.005) * 0.30, 1.86)
    # V.8 CM/JM exchange (V.21 FSK, 300 bps), partially overlapping
    dsp.place(y, _fsk(0.24, 980, 1180, 300, rng) * 0.22, 2.42)
    dsp.place(y, _fsk(0.26, 1650, 1850, 300, rng) * 0.22, 2.50)
    # line probing: the 'bong' (150 Hz-periodic multitone), L1 louder then L2
    nb = dsp.secs(0.62)
    tb = np.arange(nb) / SR
    ks = [k for k in range(1, 26) if k not in (6, 11, 13)]
    probe = sum(np.cos(2 * np.pi * 150 * k * tb + np.pi * k * k / len(ks)) for k in ks) / len(ks) ** 0.5
    env = np.where(tb < 0.16, 1.0, 0.55)
    env[dsp.secs(0.16):dsp.secs(0.19)] = 0.0                                  # the gap between the 'bongs'
    dsp.place(y, dsp.fade(probe * env, 0.004, 0.01) * 0.16, 2.80)
    # scrambled training / data: noisy hiss with shifting texture
    tr_dur = dur - 3.50 - 0.22
    nt = dsp.secs(tr_dur)
    tt = np.arange(nt) / SR
    a = band_noise(tr_dur, 400, 3300, rng)
    b = band_noise(tr_dur, 1000, 2600, rng) * (1 + 0.8 * np.sin(2 * np.pi * 37 * tt))
    sw = np.clip((tt - 0.55) / 0.08, 0, 1)
    tr = a * (1 - 0.5 * sw) + b * 0.8 * sw
    # brief tonal chirps (echo-canceller training)
    for k in range(5):
        t0 = rng.uniform(0.0, 0.5)
        f0 = rng.choice([1200, 1800, 2400])
        cn = dsp.secs(0.05)
        dsp.place(tr, np.sin(2 * np.pi * f0 * np.arange(cn) / SR) * np.hanning(cn) * 1.2, t0)
    tr *= 0.2 * (0.85 + 0.15 * dsp.smooth_random(nt, 6, rng))
    dsp.place(y, dsp.fade(tr, 0.01, 0.015), 3.50)                             # ...then silence
    # small speaker: band-limited, a little resonant and saturated
    y = dsp.filt(y, dsp.eq(dsp.butter("high", 330, 2), dsp.butter("low", 4200, 2),
                           dsp.rbj("peak", 1800, 1.1, 4.0)))
    y = np.tanh(2.2 * y / (np.max(np.abs(y)) + 1e-9)) / np.tanh(2.2)
    return st(norm(y), -0.1, 0.15)


# ------------------------------------------------------------------ transitions

def reverse_cymbal(dur, rng, bright=1.0):
    n = dsp.secs(dur + 1.5)
    t = np.arange(n) / SR
    k = 90
    fr = np.exp(rng.uniform(np.log(2500), np.log(12500 * bright), k))
    cym = np.zeros(n)
    for f in fr:
        cym += np.sin(2 * np.pi * f * t + rng.random() * 6.28) * rng.uniform(0.2, 1.0)
    cym = cym / np.sqrt(k) * 0.6 + dsp.filt(rng.standard_normal(n), dsp.butter("high", 3500, 2)) * 0.5
    cym *= np.exp(-t / 0.9)
    cym = dsp.filt(cym, dsp.butter("low", 11000, 2))
    rev = cym[::-1][-dsp.secs(dur):]
    rev *= np.linspace(0, 1, len(rev)) ** 1.6
    rev = dsp.fade(rev, 0.02, 0.004)
    L = rev
    R = np.roll(rev, 7)
    return norm(np.stack([L, R], axis=1))


def riser(dur, rng, f0=300.0, f1=6500.0):
    """Filtered-noise riser with a rising tonal whistle; ends exactly at `dur`."""
    def mag(t, f):
        u = np.clip(t / dur, 0, 1)
        fc = f0 * (f1 / f0) ** (u ** 1.3)
        return np.exp(-0.5 * ((np.log(np.maximum(f, 20)) - np.log(fc)) / 0.45) ** 2) * (0.1 + u ** 2)
    L = dsp.shaped_noise(dur, mag, rng)
    R = dsp.shaped_noise(dur, mag, rng)
    n = len(L)
    t = np.arange(n) / SR
    u = t / dur
    tone = np.sin(2 * np.pi * np.cumsum(220 * 2 ** (2.0 * u ** 1.5)) / SR) * (u ** 2) * 0.12
    y = np.stack([L + tone, R + tone], axis=1)
    y *= np.clip((dur - t) / 0.01, 0, 1)[:, None]
    return norm(dsp.fade(y, 0.05, 0.003))


def whoosh(rng, dur=1.0, peak_at=0.4, f_lo=300, f_hi=2600, pan_from=-0.7, pan_to=0.7):
    def mag(t, f):
        u = np.clip(t / dur, 0, 1)
        up = np.clip(t / peak_at, 0, 1)
        fc = np.where(t < peak_at, f_lo * (f_hi / f_lo) ** up,
                      f_hi * (0.35) ** np.clip((t - peak_at) / (dur - peak_at), 0, 1))
        env = np.where(t < peak_at, (np.clip(t / peak_at, 0, 1)) ** 2.2,
                       np.exp(-np.maximum(t - peak_at, 0) / (0.28 * (dur - peak_at))))
        return env * np.exp(-0.5 * ((np.log(np.maximum(f, 20)) - np.log(fc)) / 0.8) ** 2)
    m = dsp.shaped_noise(dur, mag, rng)
    n = len(m)
    p = np.linspace(pan_from, pan_to, n)
    y = dsp.pan(m, p)
    return norm(dsp.fade(y, 0.01, 0.05))


def shimmer_swell(dur, rng):
    """Airy rising shimmer (noise + bell partials), peaks at the end."""
    n = dsp.secs(dur)
    t = np.arange(n) / SR
    u = t / dur
    out = np.zeros((n, 2))
    for f in (1760.0, 2217.5, 2637.0, 3520.0, 4434.9):
        for c in (0, 1):
            ph = rng.random() * 6.28
            out[:, c] += np.sin(2 * np.pi * f * (1 + 0.002 * (c - 0.5)) * t + ph) * (0.5 + 0.5 * np.sin(
                2 * np.pi * rng.uniform(4, 7) * t + ph))
    air = np.stack([band_noise(dur, 3000, 12000, rng), band_noise(dur, 3000, 12000, rng)], axis=1)
    out = out * 0.08 + air * 0.15
    out *= (u ** 2.0)[:, None]
    return norm(dsp.fade(out, 0.05, 0.25))


# ------------------------------------------------------------------ 2000s

def chime(rng):
    """'Contact online': two soft glassy FM bell notes (A5 -> D6)."""
    y = np.zeros(dsp.secs(1.6))
    for t0, f, a in ((0.0, 880.0, 0.8), (0.13, 1174.66, 1.0)):
        b = sy.fm_tone(f, 1.4, ratio=2.0, index=1.2, idecay=0.12, adecay=0.45, attack=0.004)
        b += 0.25 * sy.fm_tone(f * 2, 1.4, ratio=3.5, index=0.6, idecay=0.08, adecay=0.25)
        dsp.place(y, b * a, t0)
    return st(norm(y), 0.1, 0.35)


def buzz(dur, rng):
    """BUZZ!: vibration motor + plastic rattle, punchy onset."""
    n = dsp.secs(dur + 0.08)
    t = np.arange(n) / SR
    f = 168 + 6 * np.sin(2 * np.pi * 3 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    motor_ = np.tanh(2.5 * np.sin(ph)) + 0.3 * np.sin(2 * ph)
    rattle = np.zeros(n)
    k = 0
    per = SR / 84.0
    while k * per < n - 400:
        i = int(k * per + rng.uniform(-20, 20))
        c = plastic_click(rng, size=0.5, bright=0.8, dur=0.02) * rng.uniform(0.4, 1.0)
        rattle[max(i, 0):max(i, 0) + len(c)] += c[:len(rattle[max(i, 0):max(i, 0) + len(c)])]
        k += 1
    env = np.clip(t / 0.004, 0, 1) * (0.75 + 0.25 * np.exp(-t / 0.08))
    env *= np.clip((dur - t) / 0.06, 0, 1) ** 1.2
    y = (motor_ * 0.6 + rattle * 0.5) * env
    y = dsp.filt(y, dsp.eq(dsp.butter("high", 70, 2), dsp.rbj("peak", 2200, 1.0, 3.0)))
    L = y
    R = np.roll(y, 23)
    return norm(np.stack([L, R], axis=1))


def msg_pop(rng, f0=1100.0):
    n = dsp.secs(0.14)
    t = np.arange(n) / SR
    f = f0 * (0.55 + 0.45 * np.exp(-t / 0.012))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.03)
    y[:48] *= np.linspace(0, 1, 48)
    c = plastic_click(rng, 0.3, 1.0, 0.02)
    y[:len(c)] += c * 0.08
    return st(norm(dsp.fade(y, 0.001, 0.02)), 0.05)


def t9_beeps(dur, rng):
    """Multi-tap typing on a candybar phone: short beeps (F#6-ish) + rubber key clicks."""
    y = np.zeros(dsp.secs(dur + 0.2))
    t = 0.0
    times = []
    while t < dur - 0.05:
        taps = rng.choice([1, 1, 2, 2, 3])
        for k in range(taps):
            if t < dur - 0.05:
                times.append(t)
            t += rng.uniform(0.10, 0.14)
        t += rng.uniform(0.07, 0.24)
    for tk in times:
        nb = dsp.secs(0.048)
        tt = np.arange(nb) / SR
        b = np.sin(2 * np.pi * 1480 * tt) + 0.18 * np.sin(2 * np.pi * 4440 * tt)
        b *= np.clip(tt / 0.002, 0, 1) * np.clip((0.048 - tt) / 0.008, 0, 1)
        dsp.place(y, b * 0.5, tk)
        dsp.place(y, plastic_click(rng, 0.3, 0.7, 0.02) * 0.12, tk - 0.004)
    y = dsp.filt(y, dsp.eq(dsp.butter("high", 500, 2), dsp.butter("low", 7000, 2)))
    return st(norm(y), 0.15, 0.1), times


def phone_vibe(dur, rng):
    n = dsp.secs(dur + 0.05)
    t = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(158 + 4 * np.sin(2 * np.pi * 2 * t)) / SR
    m = np.tanh(2.0 * np.sin(ph))
    table = band_noise(dur + 0.05, 90, 400, rng) * 0.3
    env = np.clip(t / 0.02, 0, 1) * np.clip((dur - t) / 0.04, 0, 1)
    y = (m * 0.7 + table) * env
    y = dsp.filt(y, dsp.eq(dsp.butter("high", 60, 2), dsp.rbj("peak", 160, 2.0, 4.0)))
    return st(norm(y), -0.1, 0.2)


# ------------------------------------------------------------------ 2010s

def shutter(rng):
    out = np.zeros(dsp.secs(0.25))
    for tk, a in ((0.0, 1.0), (0.055, 0.8)):
        c = sy.modal(list(rng.uniform(2000, 7000, 6)), [0.006] * 6, [1, .8, .7, .6, .5, .4], 0.04, rng,
                     exc=0.0005)
        dsp.place(out, norm(c) * a, tk)
        dsp.place(out, band_noise(0.02, 1500, 6000, rng) * np.hanning(dsp.secs(0.02)) * 0.3 * a, tk)
    return st(norm(out), 0.0, 0.2)


def like_pop(rng):
    n = dsp.secs(0.6)
    t = np.arange(n) / SR
    f = 620 * (1 + 0.9 * (1 - np.exp(-t / 0.02)))
    pop = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.035)
    pop[:48] *= np.linspace(0, 1, 48)
    ding = sy.fm_tone(2349.3, 0.6, ratio=2.0, index=0.5, idecay=0.05, adecay=0.18) * 0.25
    y = pop + np.pad(ding, (dsp.secs(0.02), 0))[:n]
    return st(norm(dsp.fade(y, 0.001, 0.05)), 0.1, 0.3)


# ------------------------------------------------------------------ the people / projector

def clock_ticks(t0, t1, rng):
    out = np.zeros(dsp.secs(t1 - t0 + 0.3))
    k = 0
    t = 0.0
    while t <= (t1 - t0) + 1e-6:
        fr = [3600, 5200, 900] if k % 2 == 0 else [2800, 4300, 800]
        c = sy.modal(fr, [0.004, 0.003, 0.012], [1, .6, .5], 0.04, rng, exc=0.0003)
        dsp.place(out, norm(c) * (1.0 if k % 2 == 0 else 0.85), t + rng.normal(0, 0.002))
        t += 1.0
        k += 1
    return st(norm(out), 0.45, 0.2)


def projector(dur, rng):
    """24 fps claw/shutter clatter + motor/fan."""
    n = dsp.secs(dur)
    t = np.arange(n) / SR
    out = np.zeros(n + dsp.secs(0.05))
    k = 0
    while True:
        tk = k / 24.0 + rng.normal(0, 0.0012)
        if tk >= dur - 0.02:
            break
        c = sy.modal([1150 * rng.uniform(.95, 1.05), 2350, 3800, 5200], [0.006, 0.004, 0.003, 0.002],
                     [1, .6, .4, .2], 0.02, rng, exc=0.0004)
        a = 0.6 + 0.25 * (k % 2) + rng.uniform(-0.1, 0.1)
        i = max(0, dsp.secs(tk))
        out[i:i + len(c)] += norm(c) * a
        k += 1
    out = out[:n]
    shutter_ = band_noise(dur, 300, 3000, rng) * (0.5 + 0.5 * np.sin(2 * np.pi * 48 * t)) * 0.18
    fan = dsp.filt(rng.standard_normal(n), dsp.butter("low", 900, 2)) * 0.25
    hum = (np.sin(2 * np.pi * 100 * t) * 0.3 + np.sin(2 * np.pi * 200 * t) * 0.15) * 0.4
    wob = 1 + 0.15 * np.sin(2 * np.pi * 0.7 * t)
    y = (out * 0.8 + shutter_ + fan + hum) * wob
    y = dsp.fade(y, 0.5, 0.6)
    return st(norm(y), -0.25, 0.4)


def wind_down(dur, rng):
    """Deck motor running down with the tape stop."""
    n = dsp.secs(dur)
    t = np.arange(n) / SR
    u = t / dur
    f = 96 * (1 - u) ** 1.35 + 1
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = (np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.3 * np.sin(3 * ph)) * (1 - u) ** 0.7
    y += band_noise(dur, 800, 3000, rng) * 0.08 * (1 - u) ** 2
    return st(norm(dsp.fade(y, 0.02, 0.05)), 0.0)


def key_popup(rng):
    out = np.zeros(dsp.secs(0.5))
    c = sy.modal([2400, 3700, 5100, 1300], [0.01, 0.008, 0.006, 0.02], [1, .8, .5, .6], 0.1, rng, exc=0.0004)
    dsp.place(out, norm(c), 0.0)
    ring = sy.modal([2950, 4410], [0.09, 0.06], [1, .5], 0.3, rng)
    dsp.place(out, norm(ring) * 0.12, 0.001)
    dsp.place(out, thump(160, 110, 0.12, 0.02) * 0.45, 0.0)
    dsp.place(out, plastic_click(rng, 0.6, 1.0, 0.04) * 0.35, 0.045)        # key bounces up
    return st(norm(out), 0.0, 0.25)


def rec_clunk(rng, motor_dur=3.0):
    clunk = key_clunk(rng, 1.6)
    n = dsp.secs(motor_dur)
    lv = np.ones(n)
    lv[:dsp.secs(0.05)] = 0
    fo = dsp.secs(2.0)
    lv[-fo:] *= np.linspace(1, 0, fo) ** 2
    m = motor(motor_dur, rng, level_curve=lv) * 0.07
    out = np.zeros(max(len(clunk), n) + 10)
    dsp.place(out, clunk, 0.0)
    dsp.place(out, m, 0.05)
    return st(out, 0.0, 0.2)


# ------------------------------------------------------------------ build

# level of each cue in dBFS peak (before the SFX bus reverb); edit to taste
SFX_LEVEL = {
    "case_open": -17, "cassette_desk": -16, "pencil_rewind": -19, "cassette_in": -16, "play_clunk": -13,
    "ball_stop": -21, "streetlight": -25, "crt_on": -17, "jump": -26, "coin": -27, "freeze_buzz": -34,
    "modem": -20, "reverse_riser": -24, "chime": -24, "buzz": -9, "msg_pop": -25, "t9": -26,
    "vibe": -20, "shutter": -20, "like_pop": -24, "whoosh": -25, "clock": -31, "projector": -26,
    "wind_down": -30, "key_popup": -15, "riser": -25, "rec_clunk": -10, "shimmer_swell": -30,
}


def build_sfx(seed=2024):
    """Returns (sfx_bus (N,2), events list[(name, t0, t1)])."""
    rng = np.random.default_rng(seed)
    bus = dsp.zeros()
    ev = []
    C = CUES

    def put(name, sig, t, level_key=None):
        g = dsp.db2lin(SFX_LEVEL[level_key or name])
        dsp.place(bus, sig * g, t)
        ev.append((name, t, t + len(sig) / SR))

    put("case_open", case_open(rng), C["case_open"])
    put("cassette_desk", cassette_desk(rng), C["cassette_desk"])
    a, b = C["pencil_rewind"]
    put("pencil_rewind", pencil_rewind(b - a, rng), a)
    put("cassette_in", cassette_in(rng), C["cassette_in"] - 0.10)
    put("play_clunk", play_clunk(rng), C["play_clunk"] - 0.03)
    put("ball_stop", ball_stop(rng), C["ball_stop"])
    put("streetlight", streetlight(rng), C["streetlight"][0])
    put("crt_on", crt_on(rng), C["crt_on"])
    for t in C["jump_blips"]:
        put("jump", chip_blip("jump", rng), t)
    put("coin", chip_blip("coin", rng), C["coin"])
    a, b = C["freeze"]
    put("freeze_buzz", tv_freeze_buzz(b - a, rng), a)
    a, b = C["modem"]
    put("modem", modem(b - a, rng), a)
    a, b = C["reverse_riser"]
    put("reverse_riser", reverse_cymbal(b - a, rng), a)
    put("chime", chime(rng), C["online_chime"])
    a, b = C["buzz"]
    put("buzz", buzz(b - a, rng), a)
    for i, t in enumerate(C["msg_pops"]):
        put("msg_pop", msg_pop(rng, 1100 if i == 0 else 1250), t)
    a, b = C["t9"]
    sig, _ = t9_beeps(b - a, rng)
    put("t9", sig, a)
    for a, b in C["vibrations"]:
        put("vibe", phone_vibe(b - a, rng), a)
    for t in C["shutters"]:
        put("shutter", shutter(rng), t)
    put("like_pop", like_pop(rng), C["like_pop"])
    a, b = C["bloom"]
    put("shimmer_swell", shimmer_swell(b - a + 0.25, rng), a)
    for i, t in enumerate(C["whooshes"]):
        pf, pt = (-0.7, 0.7) if i % 2 == 0 else (0.7, -0.7)
        put("whoosh", whoosh(rng, 1.0, 0.45, pan_from=pf, pan_to=pt), t - 0.3)
    a, b = C["clock"]
    put("clock", clock_ticks(a, b, rng), a)
    a, b = C["projector"]
    put("projector", projector(b - a, rng), a)
    a, b = C["tape_stop"]
    put("wind_down", wind_down(b - a, rng), a)
    put("key_popup", key_popup(rng), C["key_popup"])
    a, b = C["riser"]
    put("riser", riser(b - a, rng), a)
    put("rec_clunk", rec_clunk(rng), C["rec_clunk"] - 0.03)
    return bus, ev
