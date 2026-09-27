"""Render soundfont parts with fluidsynth (internal reverb/chorus OFF), cached."""
import hashlib
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import soundfile as sf

from cues import SR, N_SAMPLES
from compose import write_midi

SOUNDFONT = "/usr/share/sounds/sf2/MuseScore_General_Full.sf2"
FLUID_FLAGS = ["-ni", "-q", "-g", "1.0", "-r", str(SR), "-R", "0", "-C", "0", "-O", "float",
               "-o", "synth.polyphony=512"]


def _render_one(midi_path, wav_path, soundfont=SOUNDFONT):
    cmd = ["fluidsynth"] + FLUID_FLAGS + ["-F", wav_path, soundfont, midi_path]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def render_parts(parts, midi_dir, wav_dir, jobs=4, log=print):
    """Export MIDI for every soundfont part and render it; returns {name: (n,2) array}."""
    os.makedirs(midi_dir, exist_ok=True)
    os.makedirs(wav_dir, exist_ok=True)
    todo, paths = [], {}
    for name, part in parts.items():
        if part.kind != "sf":
            continue
        mid = os.path.join(midi_dir, f"{name}.mid")
        write_midi(part, mid)
        sfont = part.soundfont or SOUNDFONT
        h = hashlib.sha1(open(mid, "rb").read() + " ".join(FLUID_FLAGS).encode() +
                         sfont.encode()).hexdigest()[:16]
        wav = os.path.join(wav_dir, f"{name}.wav")
        stamp = wav + ".hash"
        paths[name] = wav
        if os.path.exists(wav) and os.path.exists(stamp) and open(stamp).read() == h:
            continue
        todo.append((mid, wav, stamp, h, sfont))
    if todo:
        log(f"  fluidsynth: rendering {len(todo)} part(s): " + ", ".join(os.path.basename(t[1]) for t in todo))

        def job(item):
            mid, wav, stamp, h, sfont = item
            _render_one(mid, wav, sfont)
            with open(stamp, "w") as f:
                f.write(h)

        with ThreadPoolExecutor(max_workers=jobs) as ex:
            list(ex.map(job, todo))
    out = {}
    for name, wav in paths.items():
        x, sr = sf.read(wav, dtype="float32", always_2d=True)
        assert sr == SR
        if len(x) < N_SAMPLES:
            x = np.pad(x, ((0, N_SAMPLES - len(x)), (0, 0)))
        out[name] = x[:N_SAMPLES]
    return out
