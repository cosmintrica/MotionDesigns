#!/usr/bin/env python3
"""AFTERGLOW soundtrack - full build.

    python3 audio/build.py            # compose -> render -> synth -> mix -> master -> report

Outputs (out/audio/):
    afterglow_mix.wav        48 kHz / 24-bit / stereo / exactly 182.0 s (8,736,000 samples)
    stems/*.wav              music / sfx / ambience buses (+ music sub-groups), same timeline
    midi/*.mid               the score, one file per soundfont part (t=0 = film frame 0)
    report.txt, spectrogram.png, envelope.png, checks/*.png
All cue times live in audio/cues.py.
"""
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "out", "audio")

import numpy as np
import soundfile as sf

from cues import SR, N_SAMPLES, CUES, SECTIONS


_T0 = time.time()


def log(*a):
    print(f"[{time.time() - _T0:6.1f}s]", *a, flush=True)


def write24(path, x, rng):
    x = np.asarray(x, dtype=np.float64)
    assert x.shape == (N_SAMPLES, 2), x.shape
    lsb = 1.0 / (2 ** 23)
    d = (rng.random(x.shape) - rng.random(x.shape)) * lsb          # TPDF dither
    y = np.clip(x + d, -1.0, 1.0 - lsb)
    sf.write(path, y, SR, subtype="PCM_24")


def stem_table(path, blocks, gc, sections):
    """Gated loudness (LUFS, after arc gain + master trim) of every stem in every section."""
    w = int(0.4 * SR)
    k = len(gc) // w
    g2 = (gc[:k * w] ** 2).reshape(k, w).mean(axis=1)
    hdr = f"{'stem':13s}" + "".join(f"{s[0][:8]:>9s}" for s in sections)
    lines = ["Per-stem gated loudness per section (LUFS, pre-bus, arc gain + trim applied; '.' = silent)", hdr]
    for nm, bp in blocks.items():
        bp = bp[:k] * g2[:len(bp)]
        row = f"{nm:13s}"
        for key, lab, a, bb in sections:
            z = bp[int(a / 0.4):max(int(a / 0.4) + 1, int(bb / 0.4))]
            z = z[z > 1e-9]
            if len(z) == 0:
                row += f"{'.':>9s}"
                continue
            l = -0.691 + 10 * np.log10(z)
            rel = -0.691 + 10 * np.log10(z.mean()) - 10
            z2 = z[l > rel]
            row += f"{-0.691 + 10 * np.log10(z2.mean()):9.1f}"
        lines.append(row)
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")


def main():
    t_start = time.time()
    os.makedirs(os.path.join(OUT, "stems"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "checks"), exist_ok=True)
    from compose import compose
    from render import render_parts
    from music_synth import render_synth_parts
    import mix
    import analysis
    import dsp

    log("[1/6] composing the score")
    S = compose()
    log("[2/6] rendering soundfont parts (fluidsynth, reverb/chorus off)")
    R = render_parts(S, os.path.join(OUT, "midi"), os.path.join(OUT, "cache", "render"), log=log)
    log("[3/6] synthesising numpy parts (pads, sub, chiptune, plucks, shimmer)")
    Y = render_synth_parts(S)
    log("[4/6] mixing the music bus")
    music, minfo = mix.build_music(R, Y, S, log=log)
    del R, Y
    gains = minfo["gains"]
    log("[5/6] sound design + ambience")
    sfx_bus, events = mix.build_sfx_bus(log=log)
    amb_bus = mix.build_ambience(log=log)
    log("[6/6] mastering")
    master, trim = mix.master(music, sfx_bus, amb_bus, log=log)
    assert master.shape == (N_SAMPLES, 2)

    rng = np.random.default_rng(1234)
    out_mix = os.path.join(OUT, "afterglow_mix.wav")
    write24(out_mix, master, rng)
    del master
    g = dsp.db2lin(trim)
    fade = dsp.db_curve([(0, 0), (CUES["fade_out"][1] - 1.0, 0), (CUES["fade_out"][1], -90)])[:, None] * g
    buses = {"music": music * fade, "sfx": sfx_bus * fade, "amb": amb_bus * fade}
    del music, sfx_bus, amb_bus
    write24(os.path.join(OUT, "stems", "music_bus.wav"), buses["music"], rng)
    write24(os.path.join(OUT, "stems", "sfx_bus.wav"), buses["sfx"], rng)
    write24(os.path.join(OUT, "stems", "ambience_bus.wav"), buses["amb"], rng)
    # music sub-groups (before memory colour / bus effects; arc gain + trim applied)
    gc = mix.gain_curve(gains)[:, None] * g
    for gname, x in minfo["groups"].items():
        write24(os.path.join(OUT, "stems", f"{gname}_dry.wav"), x * gc, rng)
    write24(os.path.join(OUT, "stems", "music_reverb_returns.wav"), minfo["reverb"] * gc, rng)
    del minfo["groups"], minfo["reverb"]

    # re-read the written master to verify the delivered file itself
    y, sr = sf.read(out_mix, dtype="float64", always_2d=True)
    info = sf.info(out_mix)
    notes = [
        f"master trim applied after glue compression: {trim:+.2f} dB",
        "stems/music_bus.wav + sfx_bus.wav + ambience_bus.wav = master input (pre glue-comp/limiter,",
        "  master trim + final fade applied). music_*_dry.wav are pre-bus groups (no memory colour,",
        "  no earbud/reality/tape-stop) for reference; music_reverb_returns.wav = their reverb.",
        "arc fit gains (dB) per section: " + ", ".join(f"{k} {v:+.1f}" for k, v in gains.items()),
        f"key moments: reverse swell {CUES['reverse_swell'][0]}-{CUES['reverse_swell'][1]} s | beat drop 66.0 s |"
        f" earbud {CUES['earbud'][0]}-{CUES['earbud'][1]} (opens by {CUES['earbud'][2]}) | beat cut {CUES['beat_cut']} s",
        f"  reality {CUES['reality'][0]}-{CUES['reality'][1]} s, bloom {CUES['bloom'][0]}-{CUES['bloom'][1]} s |"
        f" tape stop {CUES['tape_stop'][0]}-{CUES['tape_stop'][1]} s | final chord {CUES['final_chord']} s |"
        f" fade {CUES['fade_out'][0]}-{CUES['fade_out'][1]} s",
    ]
    rows = analysis.write_report(os.path.join(OUT, "report.txt"), y, buses,
                                 dict(path=out_mix, sr=sr, channels=info.channels, notes=notes),
                                 targets=mix.ARC, events=events)
    log("  report written")
    stem_table(os.path.join(OUT, "checks", "stem_levels.txt"), minfo["stem_blocks"], gc[:, 0], SECTIONS)
    analysis.spectrogram_png(os.path.join(OUT, "spectrogram.png"), y)
    analysis.envelope_png(os.path.join(OUT, "envelope.png"), y, buses, targets=mix.ARC)
    for (a, b, name) in [(0, 10.5, "cold_open"), (40.5, 48.5, "tv_freeze"), (58, 68.5, "dialup_drop"),
                         (82, 92, "earbud"), (99.5, 105, "beat_cut"), (106.5, 115, "reality_bloom"),
                         (153, 163, "tape_stop"), (163, 172, "riser_rec"), (172, 182, "ending")]:
        analysis.zoom_png(os.path.join(OUT, "checks", f"{name}.png"), y, a, b, f"{name}  {a}-{b} s")
    import resource
    log(f"done in {time.time() - t_start:.0f} s -> {out_mix}  (peak RSS "
        f"{resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1e6:.2f} GB)")
    for r in rows:
        log(f"  {r['label']:22s} {r['a']:6.1f}-{r['b']:6.1f}  ST mean {r['st_mean']:6.1f}  max {r['st_max']:6.1f}")


if __name__ == "__main__":
    main()
