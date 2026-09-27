"""Render the numpy-synth parts of the score (pad, sub, chiptune, plucks, shimmer)."""
import numpy as np

from cues import SR, N_SAMPLES, CUES
import dsp
import synth as sy
from compose import T


def _sum_notes(notes, fn, stereo=True):
    out = dsp.zeros(N_SAMPLES, 2 if stereo else 1)
    for d in notes:
        y = fn(d)
        dsp.place(out, y, d["t"])
    return out


def render_pad(part, seed=11):
    rng = np.random.default_rng(seed)

    def fn(d):
        return sy.pad_note(d["p"], d["dur"], d["v"], rng, bright=d.get("bright", 0.3),
                           attack=d.get("attack", 1.1), release=d.get("release", 1.6))
    return _sum_notes(part.performed(), fn)


def render_sub(part):
    def fn(d):
        return sy.sub_note(d["p"], d["dur"], d["v"])
    y = _sum_notes(part.performed(), fn, stereo=False)
    return dsp.to_stereo(y)


def render_shimmer(part, seed=5):
    rng = np.random.default_rng(seed)

    def fn(d):
        return sy.shimmer_note(d["p"], d["dur"], d["v"], rng)
    return _sum_notes(part.performed(), fn)


def render_pluck(part, seed=3):
    rng = np.random.default_rng(seed)
    t_sweep0, t_cut = T(30), CUES["beat_cut"]
    out = dsp.zeros(N_SAMPLES, 2)
    for i, d in enumerate(part.performed()):
        if d["t"] >= t_sweep0:
            u = np.clip((d["t"] - t_sweep0) / (t_cut - t_sweep0), 0, 1)
            fc = 900.0 * (7.5 ** u)
            q, amt = 1.2 + 2.3 * u, 3.0 - 1.5 * u
        else:
            fc, q, amt = 1500.0, 1.3, 3.5
        y = sy.pluck_note(d["p"], d["dur"], d["v"], fc_base=fc, env_amt=amt, q=q, rng=rng)
        p = 0.35 if i % 2 else -0.35
        dsp.place(out, dsp.pan(y, p), d["t"])
    # dotted-eighth ping-pong echo (tempo synced)
    dly = dsp.secs(0.75 * 0.75)
    echo = np.zeros_like(out)
    echo[dly:, 0] = out[:-dly, 1] * 0.32
    echo[2 * dly:, 1] = out[:-2 * dly, 0] * 0.2
    echo = dsp.filt(echo, dsp.eq(dsp.butter("high", 400, 1), dsp.butter("low", 5000, 1)))
    return out + echo


def render_chip(part, seed=9):
    """Chiptune layer (mono, TV speaker), with the game freeze glitch."""
    rng = np.random.default_rng(seed)
    y = np.zeros(N_SAMPLES)
    for d in part.performed():
        v = d.get("voice")
        if v == "lead":
            s = sy.pulse_note(d["p"], d["dur"], 0.30 * d["v"], duty=0.25, vibrato=18 if d["dur"] > 0.5 else 0)
        elif v == "arp":
            s = sy.pulse_note(d["p"], d["dur"], 0.16 * d["v"], duty=0.125, decay=0.09)
        elif v == "tri":
            s = sy.tri_note(d["p"], d["dur"], 0.30 * d["v"])
        else:
            s = sy.chip_noise(d["dur"] + 0.03, 0.22 * d["v"], rng, low=d.get("low", False))
        dsp.place(y, s, d["t"])
    return dsp.to_stereo(chip_freeze(y, CUES["freeze"][0], CUES["freeze"][1], rng))


def chip_freeze(y, t0, t1, rng):
    """The console freezes: the last fragment stutters, collapses to a buzz, then cuts."""
    n0, n1 = dsp.secs(t0), dsp.secs(t1)
    out = y.copy()
    out[n0:] = 0.0
    g_len = dsp.secs(0.07)
    grain = y[n0 - g_len:n0].copy()
    pos = n0
    stutter_end = n0 + int(0.55 * (n1 - n0))
    k = 0
    while pos < stutter_end:
        L = int(g_len * (1.0 if k < 3 else 0.75 if k < 5 else 0.5))
        g = grain[-L:].copy()
        if k % 3 == 2:
            g = dsp.bitcrush(g, bits=4)
        g = dsp.fade(g, 0.001, 0.001)
        seg = g[:max(0, min(L, stutter_end - pos))]
        out[pos:pos + len(seg)] += seg
        pos += L
        k += 1
    # buzz: a ~one-period loop of the grain, slightly bit-crushed
    per = dsp.secs(1 / 247.0)
    cyc = dsp.bitcrush(grain[-per:], bits=5)
    reps = int(np.ceil((n1 - pos) / per)) + 1
    buzz = np.tile(cyc, reps)[:max(0, n1 - pos)]
    buzz = buzz * np.linspace(1.0, 0.8, len(buzz))
    buzz = dsp.fade(buzz, 0.002, 0.004)
    out[pos:pos + len(buzz)] += buzz
    return out


def render_synth_parts(S):
    out = {}
    for k, fn in (("pad", render_pad), ("sub", render_sub), ("shimmer", render_shimmer),
                  ("pluck", render_pluck), ("chip", render_chip)):
        out[k] = fn(S[k]).astype(np.float32)
    return out
