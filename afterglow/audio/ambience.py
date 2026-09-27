"""Ambience beds: tape hiss, swallows + wind, crickets + night air, rain, vinyl crackle."""
import numpy as np

from cues import SR, N_SAMPLES, CUES
import dsp
import synth as sy


def tape_hiss(n, rng):
    """Cassette hiss: broadband with a gentle 2-8 kHz lift, rolled off at ~13 kHz; stereo."""
    def one():
        x = rng.standard_normal(n)
        x = dsp.filt(x, dsp.eq(dsp.butter("high", 250, 1), dsp.rbj("peak", 4500, 0.6, 5.0),
                               dsp.butter("low", 13000, 2)))
        return x
    L, R = one(), one()
    y = np.stack([L, R], axis=1)
    y *= (1 + 0.04 * dsp.smooth_random(n, 0.5, rng))[:, None]
    return y / (np.sqrt(np.mean(y ** 2)) + 1e-12)       # unit RMS


def swallow_phrase(rng):
    """A short twittering phrase: fast FM chirps 3-8 kHz."""
    k = rng.integers(3, 9)
    out = np.zeros(dsp.secs(1.2))
    t = 0.0
    for _ in range(k):
        d = rng.uniform(0.018, 0.055)
        n = dsp.secs(d)
        tt = np.arange(n) / SR
        f_a, f_b = rng.uniform(3200, 5200), rng.uniform(4500, 8200)
        shape = rng.integers(0, 3)
        if shape == 0:
            f = f_a + (f_b - f_a) * (tt / d)
        elif shape == 1:
            f = f_b + (f_a - f_b) * (tt / d)
        else:
            f = f_a + (f_b - f_a) * np.sin(np.pi * tt / d)
        f = f * (1 + 0.03 * np.sin(2 * np.pi * rng.uniform(60, 140) * tt))
        ph = 2 * np.pi * np.cumsum(f) / SR
        y = (np.sin(ph) + 0.12 * np.sin(2 * ph)) * np.sin(np.pi * tt / d) ** 1.5
        dsp.place(out, y * rng.uniform(0.5, 1.0), t)
        t += d + rng.uniform(0.02, 0.09)
        if t > 1.0:
            break
    return out


def swallows_and_wind(t0, t1, rng):
    dur = t1 - t0 + 1.0
    n = dsp.secs(dur)
    out = np.zeros((n, 2))
    # birds fly past: phrases with moving pans, distance filtering
    t = rng.uniform(0.1, 0.5)
    while t < dur - 1.5:
        ph = swallow_phrase(rng)
        dist = rng.uniform(0.3, 1.0)
        ph = dsp.filt(ph, dsp.butter("low", 9000 - 4000 * dist, 2)) * (1.0 - 0.6 * dist)
        p0 = rng.uniform(-0.9, 0.9)
        pans = np.clip(p0 + np.linspace(0, rng.uniform(-0.6, 0.6), len(ph)), -1, 1)
        dsp.place(out, dsp.pan(ph, pans), t)
        t += rng.exponential(0.55) + 0.15
    # soft evening wind: slowly moving band of noise, stereo decorrelated
    def mag(tt, f):
        g = 0.55 + 0.45 * np.sin(2 * np.pi * tt / 6.5 + 1.0) * np.sin(2 * np.pi * tt / 2.9)
        fc = 380 + 220 * np.sin(2 * np.pi * tt / 5.3)
        return np.clip(g, 0.1, 1) * np.exp(-0.5 * ((np.log(np.maximum(f, 20)) - np.log(fc)) / 0.9) ** 2)
    wl = dsp.shaped_noise(dur, mag, rng)
    wr = dsp.shaped_noise(dur, mag, rng)
    wind = np.stack([wl, wr], axis=1)
    wind /= np.sqrt(np.mean(wind ** 2)) + 1e-12
    birds_rms = np.sqrt(np.mean(out ** 2)) + 1e-12
    out = out / birds_rms * 0.5 + wind * 0.55
    out = dsp.fade(out, 1.5, 2.0)
    return out


def cricket(dur, rng, f_c, chirp_rate, pulses, pulse_rate):
    n = dsp.secs(dur)
    y = np.zeros(n + dsp.secs(0.3))
    t = rng.uniform(0, 1.0 / chirp_rate)
    pdur = 0.55 / pulse_rate
    npul = dsp.secs(pdur)
    tt = np.arange(npul) / SR
    while t < dur:
        k = pulses + rng.integers(-1, 2)
        for j in range(max(2, k)):
            f = f_c * (1 + 0.004 * rng.standard_normal())
            p = np.sin(2 * np.pi * f * tt) * np.sin(np.pi * tt / pdur) ** 2
            p *= (0.75 + 0.25 * np.sin(np.pi * (j + 0.5) / max(2, k)))
            i = dsp.secs(t + j / pulse_rate)
            if i + npul < len(y):
                y[i:i + npul] += p
        t += (1.0 / chirp_rate) * rng.uniform(0.85, 1.2)
    return y[:n]


def crickets_night(t0, t1, rng):
    dur = t1 - t0 + 0.6
    n = dsp.secs(dur)
    out = np.zeros((n, 2))
    specs = []
    for i in range(9):
        specs.append(dict(f_c=rng.uniform(4100, 5200), chirp_rate=rng.uniform(1.3, 3.2),
                          pulses=int(rng.integers(3, 6)), pulse_rate=rng.uniform(26, 36),
                          pan=rng.uniform(-0.95, 0.95), dist=rng.uniform(0.2, 1.0)))
    for s in specs:
        c = cricket(dur, rng, s["f_c"], s["chirp_rate"], s["pulses"], s["pulse_rate"])
        c = dsp.filt(c, dsp.butter("low", 9000 - 3500 * s["dist"], 2)) * (1.0 - 0.65 * s["dist"])
        out += dsp.pan(c, s["pan"])
    # distant chorus: dense AM trill band + a tree-cricket trill
    tt = np.arange(n) / SR

    def mag(t, f):
        return np.exp(-0.5 * ((f - 4600) / 450) ** 2) + 0.6 * np.exp(-0.5 * ((f - 2900) / 180) ** 2)
    ch_l = dsp.shaped_noise(dur, mag, rng) * (0.6 + 0.4 * np.sin(2 * np.pi * 31 * tt))
    ch_r = dsp.shaped_noise(dur, mag, rng) * (0.6 + 0.4 * np.sin(2 * np.pi * 33 * tt + 1))
    chorus = np.stack([ch_l, ch_r], axis=1)
    chorus /= np.sqrt(np.mean(chorus ** 2)) + 1e-12
    out /= np.sqrt(np.mean(out ** 2)) + 1e-12
    # night air: very soft low wind
    air = np.stack([dsp.filt(rng.standard_normal(n), dsp.butter("low", 700, 2)),
                    dsp.filt(rng.standard_normal(n), dsp.butter("low", 700, 2))], axis=1)
    air *= (0.7 + 0.3 * dsp.smooth_random(n, 0.2, rng))[:, None]
    air /= np.sqrt(np.mean(air ** 2)) + 1e-12
    y = out * 0.75 + chorus * 0.22 + air * 0.35
    y = dsp.fade(y, 0.35, 0.5)
    return y


def rain(dur, rng):
    n = dsp.secs(dur)
    L = dsp.pink(n, rng)
    R = dsp.pink(n, rng)
    bed = np.stack([L, R], axis=1)
    bed = dsp.filt(bed, dsp.eq(dsp.butter("high", 500, 2), dsp.butter("low", 9000, 2)))
    bed /= np.sqrt(np.mean(bed ** 2)) + 1e-12
    drops = np.zeros((n, 2))
    k = int(dur * 260)
    for _ in range(k):
        i = rng.integers(0, n - 400)
        f = rng.uniform(1800, 7500)
        d = rng.uniform(0.0015, 0.006)
        nn = dsp.secs(d)
        tt = np.arange(nn) / SR
        s = np.sin(2 * np.pi * f * tt) * np.exp(-tt / (d / 3)) * rng.pareto(3.0) * 0.3
        p = rng.uniform(-1, 1)
        drops[i:i + nn, 0] += s * np.cos((p + 1) * np.pi / 4)
        drops[i:i + nn, 1] += s * np.sin((p + 1) * np.pi / 4)
    drops /= np.sqrt(np.mean(drops ** 2)) + 1e-12
    return bed * 0.7 + drops * 0.45


def vinyl_crackle(n, rng, density=14.0):
    """Surface noise + crackle (Poisson clicks with heavy-tailed amplitudes)."""
    y = np.zeros((n, 2))
    k = int(n / SR * density)
    idx = rng.integers(0, n - 200, k)
    amps = rng.pareto(2.2, k) * 0.15
    for i, a in zip(idx, amps):
        w = rng.integers(3, 30)
        c = rng.standard_normal(w) * np.hanning(w) * a
        if rng.random() < 0.5:
            y[i:i + w, 0] += c
            y[i:i + w, 1] += c * rng.uniform(0.3, 1.0)
        else:
            y[i:i + w, 1] += c
            y[i:i + w, 0] += c * rng.uniform(0.3, 1.0)
    y = dsp.filt(y, dsp.eq(dsp.butter("high", 700, 2), dsp.butter("low", 9000, 2)))
    # occasional soft low pops
    for _ in range(int(n / SR * 0.6)):
        i = rng.integers(0, n - 2000)
        w = rng.integers(200, 900)
        c = rng.standard_normal(w) * np.hanning(w) * 0.02
        c = dsp.filt(c, dsp.butter("low", 1500, 2))
        y[i:i + w] += c[:, None]
    surf = np.stack([dsp.pink(n, rng), dsp.pink(n, rng)], axis=1)
    surf = dsp.filt(surf, dsp.eq(dsp.butter("high", 300, 1), dsp.butter("low", 6000, 2))) * 0.03
    rumble = np.sin(2 * np.pi * 0.555 * np.arange(n) / SR)[:, None] * 0.0
    return y + surf + rumble
