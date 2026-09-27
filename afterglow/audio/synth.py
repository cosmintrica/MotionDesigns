"""Numpy synthesis building blocks (all original sounds)."""
import numpy as np

from cues import SR
import dsp

TABLE_N = 4096


def mtof(p):
    return 440.0 * 2.0 ** ((np.asarray(p, dtype=float) - 69.0) / 12.0)


# ------------------------------------------------------------------ wavetables

def table_from_harmonics(amps, phases=None):
    """Single-cycle table from harmonic amplitudes (index 0 = fundamental)."""
    K = len(amps)
    spec = np.zeros(TABLE_N // 2 + 1, dtype=complex)
    ph = np.zeros(K) if phases is None else phases
    spec[1:K + 1] = np.asarray(amps) * np.exp(1j * (ph - np.pi / 2)) * (TABLE_N / 2)
    return np.fft.irfft(spec, TABLE_N)


def saw_table(f0, fc, q=0.707, fmax=17000.0):
    K = max(1, int(fmax / f0))
    k = np.arange(1, K + 1)
    f = k * f0
    h = 1.0 / np.sqrt((1 - (f / fc) ** 2) ** 2 + (f / (fc * q)) ** 2)
    return table_from_harmonics(h / k)


def pulse_table(f0, duty, fmax=15000.0):
    K = max(1, int(fmax / f0))
    k = np.arange(1, K + 1)
    a = (2.0 / (k * np.pi)) * np.sin(k * np.pi * duty)
    # pulse = sum a_k cos(k w t - k pi d)  -> use phases
    ph = -k * np.pi * duty + np.pi / 2
    return table_from_harmonics(a, ph)


def nes_triangle_table(f0, fmax=16000.0):
    """4-bit stepped triangle (32 steps), band-limited for this pitch."""
    n = 32 * 64
    steps = np.concatenate([np.arange(16), np.arange(15, -1, -1)])
    raw = np.repeat(steps, 64).astype(float)
    raw = (raw - raw.mean()) / 7.5
    X = np.fft.rfft(raw) / (n / 2)
    K = max(1, int(fmax / f0))
    amps = np.abs(X[1:K + 1])
    ph = np.angle(X[1:K + 1]) + np.pi / 2
    return table_from_harmonics(amps, ph)


def osc(table, freq, phase0=0.0):
    """Wavetable oscillator; freq scalar or per-sample array (Hz). Returns (n,)."""
    freq = np.asarray(freq, dtype=float)
    ph = phase0 + np.cumsum(freq) / SR
    ph -= np.floor(ph)
    x = ph * TABLE_N
    i0 = x.astype(np.int64)
    fr = x - i0
    return table[i0 % TABLE_N] * (1 - fr) + table[(i0 + 1) % TABLE_N] * fr


# ------------------------------------------------------------------ envelopes

def adsr(dur_on, a=0.01, d=0.1, s=0.8, r=0.2, curve=3.0):
    """Envelope for a note held dur_on seconds then released (length dur_on + r)."""
    n_on = max(1, dsp.secs(dur_on))
    n_r = max(1, dsp.secs(r))
    t = np.arange(n_on) / SR
    env = np.where(t < a, (t / max(a, 1e-4)) ** 1.0,
                   s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4) * curve / 3.0))
    if a > 0:
        env[t < a] = 0.5 - 0.5 * np.cos(np.pi * t[t < a] / a)
    last = env[-1]
    rel = last * np.exp(-np.arange(n_r) / SR / (r / 5.0))
    rel *= np.linspace(1, 0, n_r) ** 0.5
    return np.concatenate([env, rel])


def exp_env(n, tau, attack=0.002):
    t = np.arange(n) / SR
    e = np.exp(-t / tau)
    na = dsp.secs(attack)
    if na > 0:
        e[:na] *= 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, na))
    return e


# ------------------------------------------------------------------ instruments

def pad_note(pitch, dur, vel, rng, bright=0.3, attack=1.1, release=1.6, detune=(-8.0, 0.0, 7.0)):
    """Warm analog-style pad voice (3 detuned band-limited saws, filter morph)."""
    f0 = float(mtof(pitch))
    env = adsr(dur, a=attack, d=0.8, s=0.85, r=release)
    n = len(env)
    fc_hi = 300.0 + 2600.0 * bright
    fc_lo = fc_hi * 0.55
    t_dark = saw_table(f0, fc_lo)
    t_brt = saw_table(f0, fc_hi)
    # filter morph follows the attack, then relaxes slightly
    tt = np.arange(n) / SR
    morph = np.clip(tt / (attack * 1.3 + 1e-3), 0, 1) * (0.85 + 0.15 * np.exp(-tt / 3.0))
    outL = np.zeros(n)
    outR = np.zeros(n)
    pans = (-0.55, 0.0, 0.55)
    for dc, pn in zip(detune, pans):
        drift = 2.5 * dsp.smooth_random(n, 0.25, rng)            # cents
        fr = f0 * 2.0 ** ((dc + drift) / 1200.0)
        ph = rng.random()
        v = osc(t_dark, fr, ph) * (1 - morph) + osc(t_brt, fr, ph) * morph
        th = (pn + 1) * np.pi / 4
        outL += v * np.cos(th)
        outR += v * np.sin(th)
    g = vel * env / 3.0
    return np.stack([outL * g, outR * g], axis=1)


def pulse_note(pitch, dur, vel, duty=0.25, decay=None, vibrato=0.0, release=0.012, rng=None):
    f0 = float(mtof(pitch))
    n = dsp.secs(dur + release)
    t = np.arange(n) / SR
    fr = np.full(n, f0)
    if vibrato > 0:
        vib = np.clip((t - 0.22) / 0.15, 0, 1) * vibrato * np.sin(2 * np.pi * 5.8 * t)
        fr = f0 * 2.0 ** (vib / 1200.0)
    x = osc(pulse_table(f0, duty), fr)
    if decay is None:
        env = np.ones(n) * (0.82 + 0.18 * np.exp(-t / 0.05))
    else:
        env = np.exp(-t / decay)
    env = np.round(env * 15) / 15.0                            # 4-bit volume steps
    nr = dsp.secs(release)
    env[-nr:] *= np.linspace(1, 0, nr)
    env[:24] *= np.linspace(0, 1, 24)
    return x * env * vel


def tri_note(pitch, dur, vel):
    f0 = float(mtof(pitch))
    n = dsp.secs(dur + 0.01)
    x = osc(nes_triangle_table(f0), f0)
    env = np.ones(n)
    env[:24] = np.linspace(0, 1, 24)
    env[-dsp.secs(0.01):] = np.linspace(1, 0, dsp.secs(0.01))
    return x * env * vel


def chip_noise(dur, vel, rng, low=False):
    n = dsp.secs(dur)
    # NES-like LFSR noise: sample-and-hold at a clock rate
    rate = 3000 if low else 16000
    hold = max(1, int(SR / rate))
    r = rng.choice([-1.0, 1.0], size=n // hold + 2)
    x = np.repeat(r, hold)[:n]
    env = np.exp(-np.arange(n) / SR / (0.05 if low else 0.018))
    env = np.round(env * 15) / 15.0
    return x * env * vel * (0.5 if low else 0.35)


def pluck_note(pitch, dur, vel, fc_base=1400.0, env_amt=4.0, fdecay=0.07, adecay=0.22, q=1.2,
               rng=None):
    """Plucky subtractive-style synth note via additive synthesis with a decaying filter."""
    f0 = float(mtof(pitch))
    n = dsp.secs(dur + adecay * 2.5)
    t = np.arange(n) / SR
    fc = fc_base * (1.0 + env_amt * np.exp(-t / fdecay))
    K = max(1, int(16000 / f0))
    out = np.zeros(n)
    ph0 = rng.random(K) * 2 * np.pi if rng is not None else np.zeros(K)
    for k in range(1, K + 1):
        f = k * f0
        h = 1.0 / np.sqrt((1 - (f / fc) ** 2) ** 2 + (f / (fc * q)) ** 2)
        if np.max(h) / k < 1e-4:
            continue
        out += (h / k) * np.sin(2 * np.pi * f * t + ph0[k - 1])
    env = np.exp(-t / adecay)
    na = dsp.secs(0.002)
    env[:na] *= np.linspace(0, 1, na)
    nr = dsp.secs(0.03)
    rel_start = dsp.secs(dur)
    if rel_start < n:
        tail = np.exp(-np.arange(n - rel_start) / SR / 0.06)
        env[rel_start:] *= tail
    return out * env * vel * 0.5


def sub_note(pitch, dur, vel, release=0.07):
    f0 = float(mtof(pitch))
    n = dsp.secs(dur + release)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f0 * t) + 0.32 * np.sin(4 * np.pi * f0 * t + 0.3) + 0.1 * np.sin(6 * np.pi * f0 * t)
    env = np.ones(n)
    na = dsp.secs(0.008)
    env[:na] = np.linspace(0, 1, na) ** 2
    nr = dsp.secs(release)
    env[-nr:] = np.cos(np.linspace(0, np.pi / 2, nr))
    env *= 0.92 + 0.08 * np.exp(-t / 0.15)
    return np.tanh(1.4 * x * env * vel) / 1.4


def shimmer_note(pitch, dur, vel, rng, attack=0.9, release=1.8):
    f0 = float(mtof(pitch))
    env = adsr(dur, a=attack, d=1.0, s=0.8, r=release)
    n = len(env)
    t = np.arange(n) / SR
    trem = 1.0 + 0.35 * dsp.smooth_random(n, 5.0, rng)
    x = np.sin(2 * np.pi * f0 * t + rng.random() * 6.28) + 0.25 * np.sin(4 * np.pi * f0 * t)
    y = x * env * np.clip(trem, 0.2, 2.0) * vel
    p = rng.uniform(-0.7, 0.7)
    return dsp.pan(y, p)


def fm_tone(f0, dur, ratio=3.5, index=2.0, idecay=0.25, adecay=0.8, attack=0.002):
    n = dsp.secs(dur)
    t = np.arange(n) / SR
    I = index * np.exp(-t / idecay)
    y = np.sin(2 * np.pi * f0 * t + I * np.sin(2 * np.pi * f0 * ratio * t))
    return y * exp_env(n, adecay, attack)


def modal(freqs, decays, amps, dur, rng, exc=0.0015, exc_color=None):
    """Modal synthesis: damped sinusoids excited by a short noise burst."""
    n = dsp.secs(dur)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for f, d, a in zip(freqs, decays, amps):
        y += a * np.exp(-t / d) * np.sin(2 * np.pi * f * t + rng.random() * 6.28)
    ne = max(8, dsp.secs(exc))
    burst = rng.standard_normal(ne) * np.hanning(ne)
    if exc_color is not None:
        burst = dsp.filt(burst, exc_color)
    y = np.convolve(y, burst)[:n] / np.sqrt(ne)
    return y
