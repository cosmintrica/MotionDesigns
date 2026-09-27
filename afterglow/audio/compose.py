"""AFTERGLOW - the score.

Builds every part as a list of notes on the film timeline (seconds).  Parts
rendered by fluidsynth are exported to MIDI (timeline starts at film t=0, i.e.
12 beats of silence before bar m0); numpy-synth parts are returned as note lists.

Key: D major, 80 BPM, bar m starts at 9 + 3m s.  Signature colour: Gmaj7 -> Gm6.
Memory theme (m0-m3):  F#5 - E5 D5 | A4 - - B4 C#5 | D5 - E5 F#5 | E5 - - - (A4 D5)
"""
import itertools
import zlib
import numpy as np
import mido

from cues import bar_t, BEAT, LEAD_IN_BEATS, DURATION, CUES

TPB = 960
FLUIDR3 = "/usr/share/sounds/sf2/FluidR3_GM.sf2"
_NAMES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def P(x):
    """'F#5' -> 78 (C4 = 60). ints pass through."""
    if isinstance(x, (int, np.integer)):
        return int(x)
    s = x.strip()
    pc = _NAMES[s[0]]
    i = 1
    while i < len(s) and s[i] in "#b":
        pc += 1 if s[i] == "#" else -1
        i += 1
    return pc + 12 * (int(s[i:]) + 1)


def T(m, beat=1.0):
    return bar_t(m, beat)


def B(beats):
    return beats * BEAT


# ---------------------------------------------------------------- chords
CHORD_DEF = {
    "Dmaj7": ("D", ["D", "F#", "A", "C#"], ["F#", "C#"]),
    "Dmaj9": ("D", ["D", "F#", "A", "C#", "E"], ["F#", "C#", "E"]),
    "D": ("D", ["D", "F#", "A"], ["F#"]),
    "D7": ("D", ["D", "F#", "A", "C"], ["F#", "C"]),
    "Dsus2": ("D", ["D", "E", "A"], ["E"]),
    "Bm7": ("B", ["B", "D", "F#", "A"], ["D", "A"]),
    "Bm(add9)": ("B", ["B", "D", "F#", "C#"], ["D", "C#"]),
    "Gmaj7": ("G", ["G", "B", "D", "F#"], ["B", "F#"]),
    "Gm6": ("G", ["G", "Bb", "D", "E"], ["Bb", "E"]),
    "Dmaj7/F#": ("F#", ["D", "F#", "A", "C#"], ["D", "C#"]),
    "D/F#": ("F#", ["D", "F#", "A"], ["D", "A"]),
    "Em7": ("E", ["E", "G", "B", "D"], ["G", "D"]),
    "A7sus4": ("A", ["A", "D", "E", "G"], ["D", "G"]),
    "A7": ("A", ["A", "C#", "E", "G"], ["C#", "G"]),
    "A": ("A", ["A", "C#", "E"], ["C#"]),
    "A6": ("A", ["A", "C#", "E", "F#"], ["C#", "F#"]),
    "A/C#": ("C#", ["A", "C#", "E"], ["A", "E"]),
    "F#m7": ("F#", ["F#", "A", "C#", "E"], ["A", "E"]),
}


def pcs(names):
    return {P(n + "4") % 12 for n in names}


# (bar, beat, symbol) - harmonic map of the whole film (None = no harmony)
CHORDS = [
    (0, 1, "Dmaj7"), (1, 1, "Bm7"), (2, 1, "Gmaj7"), (3, 1, "Gm6"),
    (4, 1, "Dmaj7"), (5, 1, "Bm7"), (6, 1, "Gmaj7"), (7, 1, "Gm6"), (8, 1, "Dmaj7/F#"),
    (9, 1, "Em7"), (10, 1, "A7sus4"), (10, 3, "A7"),
    (11, 1, "Bm7"), (12, 1, "Gmaj7"), (12, 3, "A"),
    (13, 1, "Gmaj7"), (14, 1, "F#m7"), (15, 1, "Em7"), (16, 1, "A7sus4"), (16, 3, "A7"),
    (17, 1, "Dsus2"),
    (19, 1, "Gmaj7"), (20, 1, "A7"), (21, 1, "F#m7"), (22, 1, "Bm7"),
    (23, 1, "Gmaj7"), (24, 1, "A7"), (25, 1, "Dmaj7"), (26, 1, "D7"),
    (27, 1, "Gmaj7"), (28, 1, "A6"), (29, 1, "Bm7"), (29, 3, "D/F#"), (30, 1, "Em7"), (30, 3, "A7sus4"),
    (31, 1, "Bm(add9)"), (32, 1, "Gmaj7"),
    (33, 1, "Dmaj7"), (34, 1, "A/C#"), (35, 1, "Bm7"), (36, 1, "Gmaj7"),
    (37, 1, "Em7"), (38, 1, "A7sus4"), (38, 3, "A7"),
    (39, 1, "Dmaj7"), (40, 1, "Bm7"), (41, 1, "Gmaj7"), (42, 1, "Gm6"),
    (43, 1, "Gmaj7"), (44, 1, "A"), (45, 1, "Bm7"), (45, 3, "Gm6"),
    (46, 1, "Gmaj7"), (47, 1, "Gm6"), (48, 1, "Dmaj7"), (49, 1, "D"),
    (51, 1, "Gmaj7"), (52, 1, "A7sus4"),
    (53, 1, "D"), (54, 1, "A/C#"), (55, 1, "Bm7"), (55, 3, "Gmaj7"), (56, 1, "Dmaj9"),
]


def chord_spans(m0, m1):
    """[(t_start, t_end, symbol)] for chords starting within bars m0..m1 (inclusive)."""
    out = []
    for i, (m, b, s) in enumerate(CHORDS):
        if m0 <= m <= m1:
            if i + 1 < len(CHORDS):
                nm, nb, _ = CHORDS[i + 1]
                end = T(nm, nb)
            else:
                end = T(m + 1)
            end = min(end, T(m1 + 1))
            out.append((T(m, b), end, s))
    return out


def lead_voices(prev, symbol, n=3, lo=55, hi=76, max_gap=9, center=64):
    """Choose an n-note upper voicing for `symbol` close to `prev` (smooth voice leading)."""
    _, tones, must = CHORD_DEF[symbol]
    tpc, mpc = pcs(tones), pcs(must)
    cand = [p for p in range(lo, hi + 1) if p % 12 in tpc]
    best, best_cost = None, 1e9
    for combo in itertools.combinations(cand, n):
        if any(b - a > max_gap for a, b in zip(combo, combo[1:])):
            continue
        cp = {p % 12 for p in combo}
        if not mpc <= cp:
            continue
        if len(cp) < min(n, len(tpc)):
            continue
        if prev is None:
            cost = abs(np.mean(combo) - center) * 2
        else:
            cost = sum(abs(a - b) for a, b in zip(combo, prev))
        cost += 0.05 * (combo[-1] - combo[0])
        if cost < best_cost:
            best, best_cost = combo, cost
    return list(best)


def bass_of(symbol, lo=33, hi=44):
    """Bass note (root or inversion) in [lo, hi]."""
    r = P(CHORD_DEF[symbol][0] + "2") % 12
    for p in range(lo, hi + 1):
        if p % 12 == r:
            return p
    raise ValueError(symbol)


# ---------------------------------------------------------------- parts
class Part:
    """A performance part.  kind='sf' (fluidsynth) or 'synth' (numpy)."""

    def __init__(self, name, kind="sf", programs=None, pans=None, humanize=0.005, seed=0, vel_map=()):
        self.vel_map = list(vel_map)                     # [(t0, t1, velocity offset)]
        self.soundfont = None                            # None = MuseScore General
        self.name, self.kind = name, kind
        self.programs = programs or {0: (0, 0)}         # ch -> (bank, program)
        self.pans = pans or {}
        self.humanize = humanize
        self.seed = seed
        self.notes = []                                  # dicts
        self.ccs = []                                    # (t, ch, cc, val)

    @property
    def default_ch(self):
        return next(iter(self.programs))           # e.g. 9 for drum kits

    def n(self, t, dur, pitch, vel, ch=None, hum=True, **kw):
        ch = self.default_ch if ch is None else ch
        self.notes.append(dict(t=float(t), dur=float(dur), p=P(pitch), v=float(vel), ch=ch,
                               hum=hum, **kw))

    def cc(self, t, num, val, ch=None):
        ch = self.default_ch if ch is None else ch
        self.ccs.append((float(t), ch, int(num), int(np.clip(round(val), 0, 127))))

    def cc_curve(self, num, points, ch=None, step=0.05):
        """Smooth CC automation from (t, value) breakpoints."""
        ch = self.default_ch if ch is None else ch
        pts = sorted(points)
        chans = ch if isinstance(ch, (list, tuple)) else [ch]
        last = {}
        for (t0, v0), (t1, v1) in zip(pts, pts[1:]):
            k = max(1, int((t1 - t0) / step))
            for i in range(k + 1):
                u = i / k
                v = v0 + (v1 - v0) * (0.5 - 0.5 * np.cos(np.pi * u))
                for c in chans:
                    vv = int(round(v))
                    if last.get(c) != vv:
                        self.cc(t0 + (t1 - t0) * u, num, vv, c)
                        last[c] = vv

    def pedal(self, change_times, end=None, lift=0.02, catch=0.08):
        """Legato pedalling: lift just before each change, re-catch after it."""
        for tc in sorted(set(change_times)):
            self.cc(tc - lift, 64, 0)
            self.cc(tc + catch, 64, 127)
        if end is not None:
            self.cc(end, 64, 0)

    # ------------------------------------------------------------- performance
    def performed(self):
        """Notes with humanised timing/velocity (deterministic per part)."""
        rng = np.random.default_rng(zlib.crc32(self.name.encode()) if self.seed == 0 else self.seed)
        out = []
        for nt in sorted(self.notes, key=lambda d: (d["t"], d["p"])):
            d = dict(nt)
            if d["hum"] and self.humanize > 0:
                dt = float(np.clip(rng.normal(0, self.humanize), -0.012, 0.012))
                d["t"] += dt
                d["v"] += rng.normal(0, 2.5)
            for (a, b, dv) in self.vel_map:
                if a <= nt["t"] < b:
                    d["v"] += dv
            d["v"] = float(np.clip(d["v"], 1, 127))
            d["t"] = max(0.0, d["t"])
            out.append(d)
        return out


def tick(t):
    return int(round(t / BEAT * TPB))


def write_midi(part, path, end_time=DURATION + 0.5):
    mid = mido.MidiFile(ticks_per_beat=TPB)
    tr = mido.MidiTrack()
    mid.tracks.append(tr)
    tr.append(mido.MetaMessage("set_tempo", tempo=int(round(BEAT * 1e6)), time=0))
    ev = []   # (tick, order, msg)
    for ch, (bank, prog) in part.programs.items():
        if ch != 9:
            ev.append((0, 0, mido.Message("control_change", channel=ch, control=0, value=bank)))
            ev.append((0, 0, mido.Message("control_change", channel=ch, control=32, value=0)))
        ev.append((0, 1, mido.Message("program_change", channel=ch, program=prog)))
        ev.append((0, 2, mido.Message("control_change", channel=ch, control=7, value=100)))
        ev.append((0, 2, mido.Message("control_change", channel=ch, control=10,
                                      value=part.pans.get(ch, 64))))
        ev.append((0, 2, mido.Message("control_change", channel=ch, control=91, value=0)))
        ev.append((0, 2, mido.Message("control_change", channel=ch, control=93, value=0)))
        if not any(c[1] == ch and c[2] == 11 for c in part.ccs):
            ev.append((0, 2, mido.Message("control_change", channel=ch, control=11, value=127)))
        if not any(c[1] == ch and c[2] == 2 for c in part.ccs):
            ev.append((0, 2, mido.Message("control_change", channel=ch, control=2, value=127)))
    notes = part.performed()
    # resolve overlaps of identical pitch on one channel
    by_key = {}
    for d in notes:
        by_key.setdefault((d["ch"], d["p"]), []).append(d)
    for lst in by_key.values():
        lst.sort(key=lambda d: d["t"])
        for a, b in zip(lst, lst[1:]):
            if a["t"] + a["dur"] > b["t"] - 0.004:
                a["dur"] = max(0.02, b["t"] - a["t"] - 0.004)
    for d in notes:
        t0, t1 = tick(d["t"]), tick(d["t"] + d["dur"])
        t1 = max(t1, t0 + 1)
        ev.append((t0, 4, mido.Message("note_on", channel=d["ch"], note=d["p"],
                                       velocity=int(round(d["v"])))))
        ev.append((t1, 3, mido.Message("note_off", channel=d["ch"], note=d["p"], velocity=0)))
    for (t, ch, num, val) in part.ccs:
        ev.append((max(0, tick(t)), 2, mido.Message("control_change", channel=ch, control=num,
                                                     value=val)))
    ev.append((tick(end_time), 5, mido.Message("control_change", channel=0, control=7, value=100)))
    ev.sort(key=lambda e: (e[0], e[1]))
    last = 0
    for tk, _, msg in ev:
        msg.time = tk - last
        last = tk
        tr.append(msg)
    mid.save(path)


# ---------------------------------------------------------------- writing helpers

def mel(part, m, items, vel=50, legato=0.04, octave=0, ov=-10, ch=None, **kw):
    """Melody: items = (beat, dur_beats, pitch[, vel])."""
    for it in items:
        beat, dur, p = it[:3]
        v = it[3] if len(it) > 3 else vel
        part.n(T(m, beat), B(dur) + legato, p, v, ch=ch, **kw)
        if octave:
            part.n(T(m, beat) + 0.006, B(dur) + legato, P(p) + 12 * octave, v + ov, ch=ch, **kw)


def rolled(part, t, pitches, dur, vel, roll=0.03, vstep=1.5, ch=None, **kw):
    for i, p in enumerate(pitches):
        part.n(t + i * roll, dur - i * roll, p, vel + i * vstep, ch=ch, **kw)


def arp(part, t0, voicing, n, step, pattern=(0, 1, 2, 3, 4, 3, 2, 1), vb=44, vlo=31, vhi=40,
        ring=2.2, accent_first=True, ch=None, end=None, **kw):
    top = max(pattern)
    if end is None:
        end = t0 + n * step
    for i in range(n):
        idx = pattern[i % len(pattern)]
        p = voicing[idx]
        v = vlo + (vhi - vlo) * idx / max(1, top)
        if i == 0 and accent_first:
            v = vb
        elif i % 2 == 0:
            v += 2
        t = t0 + i * step
        part.n(t, max(0.05, min(step * ring, end - t + 0.03)), p, v, ch=ch, **kw)


# LH arpeggio voicings (bass in [A1..G#2], chord tones in octave 2-4)
ARP = {
    "Dmaj7": ["D2", "A2", "F#3", "A3", "C#4"],
    "Bm7": ["B1", "F#2", "D3", "F#3", "A3"],
    "Gmaj7": ["G2", "D3", "F#3", "A3", "B3"],
    "Gm6": ["G2", "D3", "E3", "Bb3", "D4"],
    "Dmaj7/F#": ["F#2", "D3", "A3", "C#4", "F#4"],
    "D/F#": ["F#2", "D3", "A3", "D4", "F#4"],
    "Em7": ["E2", "B2", "D3", "G3", "B3"],
    "A7sus4": ["A1", "E2", "G2", "D3", "E3"],
    "A7": ["A1", "E2", "G2", "C#3", "E3"],
    "A": ["A1", "E2", "A2", "C#3", "E3"],
    "F#m7": ["F#2", "C#3", "E3", "A3", "C#4"],
    "A/C#": ["C#2", "A2", "E3", "A3", "C#4"],
    "D": ["D2", "A2", "D3", "F#3", "A3"],
    "A6": ["A1", "E2", "C#3", "F#3", "A3"],
    "Bm(add9)": ["B1", "F#2", "C#3", "D3", "F#3"],
}

# rootless Rhodes voicings (2000s / 2010s)
EPV = {
    "Gmaj7": ["F#3", "A3", "B3", "D4"],
    "A7": ["G3", "B3", "C#4", "F#4"],
    "F#m7": ["E3", "A3", "B3", "C#4"],
    "Bm7": ["A3", "C#4", "D4", "F#4"],
    "Dmaj7": ["F#3", "A3", "C#4", "E4"],
    "D7": ["F#3", "A3", "C4", "E4"],
    "A6": ["E3", "F#3", "A3", "C#4"],
    "D/F#": ["F#3", "A3", "D4", "E4"],
    "Em7": ["G3", "B3", "D4", "F#4"],
    "A7sus4": ["G3", "B3", "D4", "E4"],
}


# ================================================================ the score

def compose():
    S = {}
    # Mellow Grand (felt-like). The intro, the question and the tape end stay at the
    # softest touch; elsewhere the touch is a little firmer for presence.
    pno = Part("piano", programs={0: (8, 0)}, humanize=0.0045,
               vel_map=[(20.9, 101.9, 7), (107.9, 156.2, 7), (161.5, 182.0, 9)])
    swell = Part("piano_swell", programs={0: (8, 0)}, humanize=0.0)   # source for reverse swell
    mbox = Part("musicbox", programs={0: (0, 10)}, humanize=0.004)
    cel = Part("celesta", programs={0: (0, 8)}, humanize=0.005)
    bells = Part("bells", programs={0: (0, 9), 1: (0, 14)}, pans={0: 70, 1: 58}, humanize=0.003)
    strings = Part("strings", programs={0: (20, 49), 1: (25, 49), 2: (30, 49), 3: (40, 49), 4: (50, 49)},
                   pans={0: 38, 1: 52, 2: 76, 3: 88, 4: 96}, humanize=0.01)
    cello = Part("cello", programs={0: (40, 49)}, pans={0: 78}, humanize=0.006)
    choir = Part("choir", programs={0: (0, 52)}, humanize=0.01)
    ep = Part("ep", programs={0: (8, 4)}, humanize=0.006)
    kick = Part("dr_kick", programs={9: (128, 32)}, humanize=0.003)
    snare = Part("dr_snare", programs={9: (128, 32)}, humanize=0.004)
    hats = Part("dr_hats", programs={9: (128, 32)}, humanize=0.004)
    perc = Part("dr_perc", programs={9: (128, 0)}, humanize=0.005)
    brush = Part("dr_brush", programs={9: (128, 40)}, humanize=0.006)
    # numpy synth parts
    pad = Part("pad", kind="synth", humanize=0.0)
    sub = Part("sub", kind="synth", humanize=0.0)
    chip = Part("chip", kind="synth", humanize=0.0)
    pluck = Part("pluck", kind="synth", humanize=0.002)
    shim = Part("shimmer", kind="synth", humanize=0.0)

    VN1, VN2, VLA, VC, CB = 0, 1, 2, 3, 4

    def strings_block(m0, m1, lo=55, hi=76, vel=64, early=0.12, bass=True, cello_oct=True,
                      top=None, skip=(), first_start=None):
        """Sustained string chords over bars m0..m1 with smooth voice leading."""
        prev = None
        for i, (a, b, s) in enumerate(chord_spans(m0, m1)):
            if s in skip:
                continue
            if i == 0 and first_start is not None:
                a = first_start
            up = lead_voices(prev, s, 3, lo, hi)
            prev = up
            for ch, p in zip((VLA, VN2, VN1), up):
                strings.n(a - early, b - a + 0.08, p, vel, ch=ch)
            if top is not None:
                pass
            if bass:
                bn = bass_of(s, 33, 44)
                strings.n(a - early, b - a + 0.08, bn, vel - 4, ch=CB)
                if cello_oct:
                    strings.n(a - early, b - a + 0.08, bn + 12, vel - 2, ch=VC)

    def pad_block(m0, m1, lo=50, hi=69, vel=0.5, n=4, bass=False, bright=0.3, first_start=None, **kw):
        prev = None
        for i, (a, b, s) in enumerate(chord_spans(m0, m1)):
            if i == 0 and first_start is not None:
                a = first_start
            up = lead_voices(prev, s, n, lo, hi, max_gap=7, center=(lo + hi) / 2)
            prev = up
            for p in up:
                pad.n(a, b - a, p, vel, bright=bright, hum=False, **kw)
            if bass:
                pad.n(a, b - a, bass_of(s, 38, 49), vel * 0.8, bright=bright, hum=False, **kw)

    # ------------------------------------------------------------ INTRO m0-m3 (9-21)
    # felt piano, rolled close voicings, big reverb; music box an octave up; barely-there pad
    lh = [("D2", ["A3", "C#4", "F#4"]), ("B1", ["A3", "D4", "F#4"]),
          ("G2", ["B3", "D4", "F#4"]), ("G2", ["Bb3", "D4", "E4"])]
    for i, (bn, up) in enumerate(lh):
        t = T(i)
        pno.n(t, B(4) + 0.1, bn, 40 - i)
        rolled(pno, t + 0.05, up, B(4), 31, roll=0.045)
        pno.n(t + B(2), B(2), up[1], 25)                    # soft inner pulse on beat 3
    theme = [
        (0, [(1, 2, "F#5", 53), (3, 1, "E5", 47), (4, 1, "D5", 45)]),
        (1, [(1, 3, "A4", 46), (4, .5, "B4", 41), (4.5, .5, "C#5", 45)]),
        (2, [(1, 2, "D5", 49), (3, 1, "E5", 48), (4, 1, "F#5", 53)]),
        (3, [(1, 4, "E5", 50), (4.5, .25, "A4", 30), (4.75, .25, "D5", 35)]),
    ]
    for m, items in theme:
        mel(pno, m, items)
        mel(mbox, m, [(b, d, P(p) + 12, 36 if v > 40 else 28) for b, d, p, v in items])
    pno.pedal([T(0), T(1), T(2), T(3), T(4)])
    pad_block(0, 3, lo=50, hi=66, vel=0.30, bright=0.15)
    # reverse-swell source: the m0 chord, isolated (rendered separately, reversed in mix)
    swell.n(T(0), 4.0, "D2", 46)
    for p in ["A3", "C#4", "F#4", "A4", "F#5"]:
        swell.n(T(0) + 0.01, 4.0, p, 42)
    swell.cc(T(0) - 0.1, 64, 127)

    # ------------------------------------------------------------ COURTYARD m4-m10 (21-42)
    changes = []
    for (a, b, s) in chord_spans(4, 10):
        nsteps = int(round((b - a) / B(0.5)))
        v = ARP[s]
        if s == "A7sus4":
            arp(pno, a, v, nsteps, B(0.5), pattern=(0, 1, 2, 3), vb=43, vlo=30, vhi=37)
        elif s == "A7":
            arp(pno, a, v, nsteps, B(0.5), pattern=(4, 3, 2, 1), vb=36, vlo=30, vhi=38,
                accent_first=False)
        else:
            lift = 3 if a >= T(9) else 0                 # the lift at m9 (36 s)
            arp(pno, a, v, nsteps, B(0.5), vb=44 + lift, vlo=30 + lift, vhi=39 + lift)
        changes.append(a)
    court = [
        (4, [(1, 1.5, "F#5", 55), (2.5, .5, "G5", 48), (3, 1, "F#5", 52), (4, 1, "E5", 49)]),
        (5, [(1, 3, "D5", 52), (4, .5, "C#5", 44), (4.5, .5, "D5", 47)]),
        (6, [(1, 2, "E5", 53), (3, 1, "F#5", 54), (4, 1, "G5", 56)]),
        (7, [(1, 2, "A5", 62), (3, 1, "G5", 55), (4, 1, "E5", 50)]),
        (8, [(1, 2, "F#5", 54), (3, 1, "E5", 50), (4, 1, "D5", 48)]),
        (9, [(1, 1.5, "B5", 63), (2.5, .5, "A5", 54), (3, 1, "G5", 50), (4, 1, "E5", 45)]),
        (10, [(1, 2, "D5", 47), (3, 2, "C#5", 44)]),
    ]
    for m, items in court:
        mel(pno, m, items)
    pno.pedal(changes)
    # a soft pad bridge under m4-m5 (strings take over at m6)
    for (a, b, s) in chord_spans(4, 5):
        up = lead_voices(None if s == "Dmaj7" else [57, 62, 66, 69], s, 4, 50, 69, 7, 59.5)
        for p in up:
            pad.n(a, b - a, p, 0.22, bright=0.15, hum=False)
    # strings enter ~m6 and lift at m9
    strings_block(6, 10, vel=62)
    strings.cc_curve(11, [(T(6) - 0.5, 20), (T(7), 72), (T(8, 3), 80), (T(9), 96), (T(9, 3), 84),
                          (T(10, 3), 72), (T(11) - 0.2, 40), (T(11) + 0.4, 0)], ch=[0, 1, 2, 3, 4])
    # streetlights (35.0): a tiny celesta twinkle
    for i, p in enumerate(["D6", "F#6", "A6", "C#7"]):
        cel.n(CUES["streetlight"][0] + 0.05 + i * 0.07, 1.2, p, 30 + 2 * i)
    # brushed shaker from m6 (no kick)
    for m in range(6, 11):
        for k in range(8):
            t = T(m) + k * B(0.5) + (0.028 if k % 2 else 0.0)
            perc.n(t, 0.12, 82, 34 + (8 if k % 2 == 0 else 0) + (4 if k in (2, 6) else 0))
        for bt in (2, 4):
            brush.n(T(m, bt) - 0.06, 0.3, 40, 30)          # brush swirl on 2 & 4

    # ------------------------------------------------------------ TV m11-m12 (42-48)
    rolled(pno, T(11), ["B1", "F#3", "A3", "D4"], B(4) + 0.2, 36, roll=0.03)
    rolled(pno, T(12), ["G2", "D3", "F#3", "B3"], B(2), 30, roll=0.03)
    rolled(pno, T(12, 3), ["A1", "E3", "A3", "C#4"], B(2) + 0.3, 34, roll=0.035)
    pno.n(T(12, 4.5), B(0.5) + 0.05, "A4", 34)                  # pickup to the village
    pno.pedal([T(11), T(12), T(12, 3)])
    # chiptune: lead, arp, triangle bass, noise (original); freezes at 45.2
    lead = [(42.000, .375, "F#5"), (42.375, .375, "A5"), (42.750, .75, "B5"), (43.500, .375, "A5"),
            (43.875, .375, "F#5"), (44.250, .375, "E5"), (44.625, .375, "F#5"), (45.000, .75, "D5")]
    for t, d, p in lead:
        chip.n(t, d * 0.92, p, 1.0, voice="lead", hum=False)
    arp_b = ["B4", "D5", "F#5", "A5"]
    arp_g = ["G4", "B4", "D5", "F#5"]
    for k in range(24):
        t = T(11) + k * B(0.25)
        seq = arp_b if t < T(12) else arp_g
        chip.n(t, B(0.25) * 0.8, seq[k % 4], 0.8, voice="arp", hum=False)
    for k in range(12):
        t = T(11) + k * B(0.5)
        root = "B2" if t < T(12) else "G2"
        chip.n(t, B(0.5) * 0.9, P(root) + (12 if k % 2 else 0), 1.0, voice="tri", hum=False)
    for k in range(12):
        t = T(11) + k * B(0.5)
        chip.n(t, 0.05 if k % 2 else 0.09, 60, 0.9 if k % 2 else 0.6,
               voice="noise", hum=False, low=(k % 4 == 0))

    # ------------------------------------------------------------ VILLAGE m13-m16 (48-60)
    vil_lh = {"Gmaj7": ["G2", "D3", "F#3", "B3"], "F#m7": ["F#2", "C#3", "E3", "A3"],
              "Em7": ["E2", "B2", "D3", "G3"], "A7sus4": ["A1", "E3"],
              "A7": ["G3", "C#4"]}
    changes = []
    for (a, b, s) in chord_spans(13, 16):
        notes = vil_lh[s]
        for k, p in enumerate(notes):
            tk = a + k * BEAT
            pno.n(tk, b - tk + 0.04, p, (38 if k == 0 else 29 + k))
        changes.append(a)
    village = [
        (13, [(1, 3, "B4", 46), (4, .5, "C#5", 39), (4.5, .5, "D5", 42)]),
        (14, [(1, 2, "E5", 50), (3, 1, "C#5", 44), (4, 1, "A4", 40)]),
        (15, [(1, 3, "B4", 45), (4, .5, "A4", 37), (4.5, .5, "B4", 40)]),
        (16, [(1, 2, "D5", 46), (3, 2, "C#5", 42)]),
    ]
    for m, items in village:
        mel(pno, m, items)
    # fireflies: sparse celesta notes (deterministic pseudo-random chord tones)
    rng = np.random.default_rng(7)
    fire = {"Gmaj7": ["D6", "F#6", "B6", "A6"], "F#m7": ["C#6", "E6", "A6", "F#6"],
            "Em7": ["B5", "E6", "G6", "D7"], "A7sus4": ["E6", "A6", "D7", "G6"], "A7": ["C#7", "E6", "G6"]}
    for (a, b, s) in chord_spans(13, 16):
        nb = int(round((b - a) / BEAT))
        slots = sorted(rng.choice(np.arange(1, nb * 2), size=min(3, nb * 2 - 1), replace=False))
        for j, sl in enumerate(slots):
            cel.n(a + sl * B(0.5) + rng.uniform(0, 0.05), 1.5, fire[s][j % len(fire[s])],
                  27 + rng.uniform(0, 9))
    strings_block(13, 16, vel=60, lo=55, hi=74)
    strings.cc_curve(11, [(T(13) - 0.6, 10), (T(13, 3), 62), (T(15), 70), (T(16, 3), 64),
                          (T(17), 52), (T(17, 3), 34), (T(18), 22), (T(18, 3), 0)], ch=[0, 1, 2, 3, 4])

    # ------------------------------------------------------------ DIAL-UP m17-m18 (60-66)
    pno.n(T(17), B(8), "D2", 34)
    rolled(pno, T(17) + 0.04, ["A3", "D4", "E4"], B(8), 28, roll=0.05)
    pno.n(T(17), B(8), "D5", 38)                                  # melody resolves C#5 -> D5
    changes.append(T(17))
    pno.pedal(changes + [T(18, 4)])
    strings.n(T(17) - 0.1, B(6), "D3", 58, ch=VC)
    strings.n(T(17) - 0.1, B(6), "A3", 58, ch=VLA)
    strings.n(T(17) - 0.1, B(6), "E4", 56, ch=VN2)
    for p in ["D3", "A3", "D4", "E4"]:
        pad.n(T(17), 5.75, p, 0.42, bright=0.2, hum=False)

    # ------------------------------------------------------------ 2000s m19-m26 (66-90)
    SW = 0.034   # swing delay of the off-16ths (s)

    def step_t(m, s):
        return T(m) + s * B(0.25) + (SW if s % 2 else 0.0)

    kickA, kickB = [0, 7, 10], [0, 3, 10, 14]
    for m in range(19, 31):
        tenth = (m >= 27)
        kpat = kickA if m % 2 == 1 else kickB
        for s in kpat:
            kick.n(step_t(m, s), 0.2, 36, 92 if s == 0 else 78)
        for s in (4, 12):
            snare.n(step_t(m, s) + 0.012, 0.2, 38, 70 if not tenth else 76)
            snare.n(step_t(m, s) + 0.012, 0.2, 37, 52)
            if tenth:
                perc.n(step_t(m, s) + 0.016, 0.2, 39, 72)     # claps in the 2010s
        if m % 2 == 0 and m not in (26, 30):
            snare.n(step_t(m, 15), 0.1, 38, 34)            # ghost
        for s in range(0, 16, 2):
            hats.n(step_t(m, s), 0.08, 42, (52 if s % 4 == 0 else 42) + (6 if tenth else 0))
        for s in (7, 15) if not tenth else (3, 7, 11, 15):
            hats.n(step_t(m, s), 0.06, 42, 30 + (6 if tenth else 0))
        if m % 2 == 0:
            hats.n(step_t(m, 14), 0.25, 46, 40)            # open hat
        if m >= 23:
            for s in range(0, 16, 2 if not tenth else 1):
                perc.n(step_t(m, s), 0.08, 82, 30 + (6 if s % 4 == 2 else 0))
    # fill into the 2010s (m26 beat 4) and roll into the cut (m30 beats 3-4)
    for s in (13, 14, 15):
        snare.n(step_t(26, s) + 0.01, 0.1, 38, 44 + 6 * (s - 13))
    for k in range(8):
        snare.n(T(30, 3) + k * B(0.25), 0.1, 38, 38 + 5 * k)
    # sub bass (numpy): root + kick-locked notes + approach tones
    sub_roots = {19: "G1", 20: "A1", 21: "F#1", 22: "B1", 23: "G1", 24: "A1", 25: "D2", 26: "D2",
                 27: "G1", 28: "A1"}
    approach = {19: "G#1", 20: "G1", 21: "A#1", 22: "A1", 23: "G#1", 24: "C#2", 25: "D2", 26: "F#1",
                27: "G#1", 28: "A#1"}
    for m in range(19, 29):
        r = P(sub_roots[m])
        if m == 26:
            sub.n(T(m), B(1.75), r, 1.0)
            sub.n(T(m, 3), B(1.0), P("C2"), 0.9)
            sub.n(T(m, 4), B(0.5), P("B1"), 0.85)
            sub.n(T(m, 4.5), B(0.45), P("A1"), 0.85)
            continue
        sub.n(T(m), B(1.6), r, 1.0)
        sub.n(step_t(m, 7 if m % 2 == 1 else 10), B(0.7), r, 0.85)
        if m % 2 == 1:
            sub.n(step_t(m, 10), B(0.9), r, 0.9)
        sub.n(step_t(m, 14), B(0.45), P(approach[m]), 0.7)
    for (a, b, s) in chord_spans(29, 30):
        r = bass_of(s, 28, 40)
        sub.n(a, b - a - 0.05, r, 1.0)
    # Rhodes comping
    for (a, b, s) in chord_spans(19, 30):
        v = EPV[s]
        dur = b - a
        if dur > B(3):
            rolled(ep, a, v, B(2.5), 46, roll=0.012, vstep=1)
            rolled(ep, a + B(2.5) + SW, v[1:], B(1.25), 36, roll=0.01, vstep=1)
        else:
            rolled(ep, a, v, dur - 0.05, 44, roll=0.012, vstep=1)
    # piano melody fragments (sparse; SFX live in the gaps)
    y2k = [
        (20, [(1, .5, "E5", 50), (1.5, .5, "F#5", 48), (2, 1, "G5", 53), (3, .75, "E5", 46)]),
        (21, [(3, .5, "A4", 44), (3.5, .5, "C#5", 46), (4, 1, "E5", 50)]),
        (23, [(1, 1.5, "F#5", 54), (2.5, .5, "E5", 48), (3, 1, "D5", 50), (4, 1, "B4", 46)]),
        (24, [(1, 1.5, "C#5", 50), (2.5, .5, "D5", 46), (3, 2, "E5", 52)]),
        (25, [(1, 2, "F#5", 56), (3, 1, "E5", 50), (4, 1, "D5", 48)]),
        (26, [(1, 3, "A4", 50), (4, .5, "B4", 46), (4.5, .5, "C5", 50)]),
    ]
    for m, items in y2k:
        mel(pno, m, items)
    pno.cc(T(19) - 0.05, 64, 0)
    for (a, b, s) in chord_spans(19, 26):
        pno.cc(a + 0.05, 64, 100)
        pno.cc(b - 0.03, 64, 0)

    # ------------------------------------------------------------ 2010s m27-m30 (90-102)
    y10 = [
        (27, [(1, 1.5, "B4", 56), (2.5, .5, "D5", 50), (3, 1.5, "F#5", 56), (4.5, .5, "E5", 48)]),
        (28, [(1, 1.5, "F#5", 58), (2.5, .5, "E5", 50), (3, 2, "C#5", 52)]),
        (29, [(1, 2, "D5", 56), (3, 1, "E5", 56), (4, 1, "F#5", 60)]),
        (30, [(1, 4, "E5", 58)]),
    ]
    for m, items in y10:
        mel(pno, m, items)
    for (a, b, s) in chord_spans(27, 30):
        pno.cc(a + 0.05, 64, 100)
        pno.cc(min(b, T(31)) - 0.03, 64, 0)
    # plucks: 16ths, 3-3-2 accents; the filter sweep in m30 is applied in the synth
    ptones = {"Gmaj7": ["B4", "D5", "F#5", "A5"], "A6": ["C#5", "E5", "F#5", "A5"],
              "Bm7": ["B4", "D5", "F#5", "A5"], "D/F#": ["A4", "D5", "F#5", "A5"],
              "Em7": ["B4", "D5", "E5", "G5"], "A7sus4": ["A4", "D5", "E5", "G5"]}
    patt = [0, 1, 2, 0, 1, 2, 3, 2, 0, 1, 2, 0, 1, 2, 3, 1]
    for m in range(27, 31):
        for s in range(16):
            t = T(m) + s * B(0.25) + (SW * 0.6 if s % 2 else 0.0)
            sym = [c for (a, b, c) in chord_spans(m, m) if a <= t + 1e-6][-1]
            acc = 1.0 if s in (0, 3, 6, 8, 11, 14) else 0.7
            pluck.n(t, B(0.25) * 1.6, ptones[sym][patt[s]], acc, hum=False)
    # bright pad under the 2010s
    pad_block(27, 30, lo=57, hi=74, vel=0.34, n=4, bright=0.55)

    # ------------------------------------------------------------ QUESTION m31-m32 (102-108)
    pno.n(T(31, 2), B(7), "B1", 38)
    pno.n(T(31, 2) + 0.06, B(7), "F#2", 30)
    rolled(pno, T(31, 2) + 0.16, ["D4", "F#4", "C#5"], B(3), 30, roll=0.07)
    mel(pno, 31, [(3, 1, "B4", 42), (4, 1, "C#5", 45)])
    pno.n(T(32), B(4), "G2", 34)
    rolled(pno, T(32) + 0.08, ["B3", "D4", "F#4"], B(4), 27, roll=0.06)
    mel(pno, 32, [(1, 1.5, "D5", 49), (2.5, .5, "E5", 45), (3, 2, "F#5", 51)])
    pno.pedal([T(31, 2), T(32)], end=T(33) - 0.05)

    # ------------------------------------------------------------ REALITY / MEMORY m33-m36 (108-120)
    # reality (108-110.8): plain, stiff, un-pedalled
    for p in ["D2", "A3", "C#4", "F#4"]:
        pno.n(T(33), B(2.9), p, 40, hum=False)
    for b_, d_, p_, v_ in [(1, 2, "F#5", 46), (3, 1, "E5", 44), (4, 1, "D5", 42)]:
        pno.n(T(33, b_), B(d_) - 0.02, p_, v_, hum=False)
    # memory (from 111): courtyard texture returns
    changes = []
    for (a, b, s) in chord_spans(34, 36):
        nsteps = int(round((b - a) / B(0.5)))
        arp(pno, a, ARP[s], nsteps, B(0.5), vb=44, vlo=31, vhi=40)
        changes.append(a)
    memory = [
        (34, [(1, 3, "A4", 50), (4, .5, "B4", 44), (4.5, .5, "C#5", 48)]),
        (35, [(1, 2, "D5", 54), (3, 1, "E5", 52), (4, 1, "F#5", 56)]),
        (36, [(1, 4, "E5", 52)]),
    ]
    for m, items in memory:
        mel(pno, m, items)
        mel(mbox, m, [(b_, d_, P(p_) + 12, 33) for b_, d_, p_, v_ in items])
    pno.pedal(changes)
    # bloom: strings + pad + shimmer from 110.8
    bl0 = CUES["bloom"][0]
    strings_block(34, 36, vel=64, lo=57, hi=76, early=0.0, first_start=bl0 - 0.25)
    strings.cc_curve(11, [(bl0 - 0.3, 0), (bl0 + 0.9, 90), (T(35), 82), (T(36, 3), 76),
                          (T(37) + 0.5, 64), (T(38, 3), 70), (T(39) - 0.3, 58)], ch=[0, 1, 2, 3, 4])
    pad_block(34, 36, lo=52, hi=71, vel=0.46, bright=0.35, first_start=bl0, attack=0.7)
    for p in ["A5", "C#6", "E6", "A6"]:
        shim.n(bl0, 3.4, p, 1.0, hum=False)
    for (a, b, s) in chord_spans(35, 36):
        for p in lead_voices(None, s, 3, 81, 93, 9, 86):
            shim.n(a, b - a + 1.0, p, 0.55, hum=False)

    # ------------------------------------------------------------ FIRST TIMES m37-m38 (120-126)
    pno.n(T(37), B(4), "E2", 38)
    rolled(pno, T(37) + 0.03, ["G3", "B3", "D4"], B(4), 30, roll=0.03)
    pno.n(T(38), B(4), "A1", 38)
    rolled(pno, T(38) + 0.03, ["D4", "E4", "G4"], B(2), 30, roll=0.03)
    rolled(pno, T(38, 3), ["C#4", "E4", "G4"], B(2), 31, roll=0.03)
    mel(pno, 37, [(1, 1.5, "B4", 47), (2.5, .5, "D5", 45), (3, 2, "E5", 51)])
    mel(pno, 38, [(1, 2, "D5", 49), (3, 1, "C#5", 47), (4.5, .25, "A4", 40), (4.75, .25, "D5", 45)])
    pno.pedal([T(37), T(38), T(38, 3)])
    ftones = {"Em7": ["E5", "G5", "B5", "D6", "E6", "D6", "B5", "G5"],
              "A7sus4": ["A5", "D6", "E6", "G6", "A6", "G6", "E6", "D6"],
              "A7": ["A5", "C#6", "E6", "G6", "A6", "G6", "E6", "C#6"]}
    for (a, b, s) in chord_spans(37, 38):
        nst = int(round((b - a) / B(0.25)))
        for k in range(nst):
            t = a + k * B(0.25)
            prog = (t - T(37)) / 6.0
            cel.n(t, 0.5, ftones[s][k % 8], 30 + 12 * prog + (6 if k % 4 == 0 else 0))
            if k % 2 == 0:
                mbox.n(t + 0.004, 0.5, P(ftones[s][k % 8]) + 12, 24 + 10 * prog)
    strings_block(37, 38, vel=60, lo=57, hi=74, early=0.1)

    # ------------------------------------------------------------ WHO WE WERE m39-m42 (126-138)
    changes = []
    for (a, b, s) in chord_spans(39, 42):
        nsteps = int(round((b - a) / B(0.5)))
        k = (a - T(39)) / 12.0
        arp(pno, a, ARP[s], nsteps, B(0.5), vb=46 + 6 * k, vlo=32 + 5 * k, vhi=41 + 6 * k)
        changes.append(a)
    who = [
        (39, [(1, 2, "F#5", 60), (3, 1, "E5", 54), (4, 1, "D5", 52)]),
        (40, [(1, 3, "A4", 54), (4, .5, "B4", 50), (4.5, .5, "C#5", 54)]),
        (41, [(1, 2, "D5", 58), (3, 1, "E5", 60), (4, 1, "F#5", 64)]),
        (42, [(1, 3, "E5", 62), (4, .25, "D5", 50), (4.25, .25, "E5", 54),
              (4.5, .25, "G5", 58), (4.75, .25, "A5", 62)]),
    ]
    for m, items in who:
        mel(pno, m, items)
    mel(mbox, 39, [(1, 2, "F#6", 30), (3, 1, "E6", 27), (4, 1, "D6", 26)])
    pno.pedal(changes)
    strings_block(39, 42, vel=66, lo=57, hi=76, early=0.12)
    strings.cc_curve(11, [(T(39) - 0.3, 58), (T(40), 64), (T(41), 78), (T(42), 92), (T(42, 3), 104),
                          (T(43) - 0.1, 112)], ch=[0, 1, 2, 3, 4])
    cello_line = [
        (39, [(1, 2, "A3", 70), (3, 2, "F#3", 66)]),
        (40, [(1, 3, "B3", 72), (4, 1, "A3", 66)]),
        (41, [(1, 2, "G3", 72), (3, 1, "A3", 70), (4, 1, "B3", 74)]),
        (42, [(1, 4, "Bb3", 80)]),
        (43, [(1, 2, "B3", 86), (3, 1, "C#4", 84), (4, 1, "D4", 86)]),
        (44, [(1, 2, "E4", 88), (3, 2, "C#4", 82)]),
        (45, [(1, 2, "D4", 80), (3, 2, "Bb3", 70)]),
    ]
    for m, items in cello_line:
        mel(cello, m, [(b_ - 0.12 / BEAT, d_, p_, v_) for b_, d_, p_, v_ in items], legato=0.12)
    cello.cc_curve(11, [(T(39) - 0.4, 50), (T(41), 80), (T(43), 110), (T(44, 3), 116), (T(45, 3), 88),
                        (T(46) - 0.1, 50), (T(46) + 0.4, 0)])

    # ------------------------------------------------------------ THE PEOPLE m43-m45 (138-147)
    peak_arp = {"Gmaj7": ["G1", "D3", "A3", "B3", "F#4"], "A": ["A1", "E3", "A3", "C#4", "E4"],
                "Bm7": ["B1", "F#3", "A3", "D4"], "Gm6": ["G1", "D3", "Bb3", "E4"]}
    changes = []
    for (a, b, s) in chord_spans(43, 45):
        v = peak_arp[s]
        nsteps = int(round((b - a) / B(0.5)))
        fade_k = 1.0 if a < T(45, 3) else 0.7
        pno.n(a, b - a + 0.3, P(v[0]) + 12, (54 if fade_k == 1 else 40))       # octave bass
        pat = (0, 1, 2, 3, 4, 3, 2, 1) if len(v) == 5 else (0, 1, 2, 3)
        arp(pno, a, v, nsteps, B(0.5), pattern=pat, vb=58 * fade_k, vlo=38 * fade_k, vhi=48 * fade_k)
        changes.append(a)
    peak = [
        (43, [(1, 2, "B5", 74), (3, 1, "A5", 66), (4, 1, "F#5", 64)]),
        (44, [(1, 3, "E5", 66), (4, .5, "F#5", 60), (4.5, .5, "G5", 62)]),
        (45, [(1, 2, "F#5", 62), (3, 2, "E5", 50)]),
    ]
    for m, items in peak:
        mel(pno, m, items, octave=-1, ov=-12)
    pno.pedal(changes)
    # strings: violins double the melody, harmony below, basses roots
    for m, items in peak:
        for b_, d_, p_, v_ in items:
            strings.n(T(m, b_) - 0.1, B(d_) + 0.12, P(p_) - 12, 76, ch=VN1)
    prev = None
    for (a, b, s) in chord_spans(43, 45):
        up = lead_voices(prev, s, 2, 57, 71, 9, 64)
        prev = up
        for ch, p in zip((VLA, VN2), up):
            strings.n(a - 0.1, b - a + 0.1, p, 72, ch=ch)
        bn = bass_of(s, 31, 43)
        strings.n(a - 0.1, b - a + 0.1, bn, 70, ch=CB)
        strings.n(a - 0.1, b - a + 0.1, bn + 12, 66, ch=VC)
    strings.cc_curve(11, [(T(43) - 0.1, 112), (T(44), 118), (T(45), 110), (T(45, 3), 92), (T(46) - 0.2, 60),
                          (T(46) + 0.3, 42)], ch=[0, 1, 2, 3, 4])
    choir_v = {"Gmaj7": ["D4", "F#4", "B4"], "A": ["C#4", "E4", "A4"], "Bm7": ["D4", "F#4", "A4"],
               "Gm6": ["D4", "E4", "Bb4"]}
    for (a, b, s) in chord_spans(43, 45):
        for p in choir_v[s]:
            choir.n(a - 0.15, b - a + 0.15, p, 62)
    choir.cc_curve(11, [(T(43) - 0.5, 40), (T(43, 3), 90), (T(44, 3), 100), (T(45, 3), 70), (T(46), 30),
                        (T(46) + 0.5, 0)])

    # ------------------------------------------------------------ IMAGINED m46-m48 (147-156)
    for m, bn, up in [(46, "G2", ["B3", "D4", "F#4"]), (47, "G2", ["Bb3", "D4", "E4"]),
                      (48, "D2", ["A3", "C#4", "F#4"])]:
        pno.n(T(m), B(4) + 0.1, bn, 33)
        rolled(pno, T(m) + 0.06, up, B(4), 26, roll=0.07)
    imag = [
        (46, [(1, 2, "F#5", 46), (3, 1, "E5", 42), (4, 1, "D5", 40)]),
        (47, [(1, 4, "E5", 44)]),
        (48, [(1, 3, "A4", 40), (4, .5, "B4", 37), (4.5, .5, "C#5", 42)]),
        (49, [(1, 2, "D5", 46)]),
    ]
    for m, items in imag:
        mel(pno, m, items)
        mel(mbox, m, [(b_, d_, P(p_) + 12, 27) for b_, d_, p_, v_ in items])
    pno.n(T(49), B(3), "D2", 38)
    rolled(pno, T(49) + 0.02, ["A3", "D4", "F#4"], B(3), 31, roll=0.03)
    pno.pedal([T(46), T(47), T(48), T(49)], end=T(50))
    strings_block(46, 49, vel=58, lo=55, hi=72, early=0.15)
    strings.cc_curve(11, [(T(46) + 0.3, 42), (T(46, 3), 54), (T(48), 60), (T(49), 66), (T(50), 66)],
                     ch=[0, 1, 2, 3, 4])
    pad_block(46, 49, lo=52, hi=69, vel=0.40, bright=0.2)

    # ------------------------------------------------------------ TODAY m51-m52 (162-168)
    changes = []
    for (a, b, s) in chord_spans(51, 52):
        nsteps = int(round((b - a) / B(0.5)))
        for i in range(nsteps):                       # a gentle, rising return
            u = (a - T(51) + i * B(0.5)) / 6.0
            v = ARP[s][(0, 1, 2, 3, 4, 3, 2, 1)[i % 8]]
            vel = (30 + 18 * u) + (5 if i == 0 else 0)
            pno.n(a + i * B(0.5), B(0.5) * 2.2, v, vel)
        changes.append(a)
    today = [
        (51, [(1, 2, "D5", 38), (3, 1, "E5", 42), (4, 1, "F#5", 47)]),
        (52, [(1, 2, "G5", 53), (3, 1, "A5", 58)]),
    ]
    for m, items in today:
        mel(pno, m, items)
    for b_, p_, v_ in [(4.5, "A4", 50), (4.75, "D5", 56)]:
        pno.n(T(52, b_) + 0.02, B(0.3), p_, v_)
        pno.n(T(52, b_) + 0.025, B(0.3), P(p_) + 12, v_ - 6)
    pno.pedal(changes)
    strings_block(51, 52, vel=64, lo=55, hi=74, early=0.2)
    strings.cc_curve(11, [(T(51) - 0.5, 20), (T(51, 3), 48), (T(52), 70), (T(52, 3), 96), (T(53) - 0.05, 118)],
                     ch=[0, 1, 2, 3, 4])
    pad_block(51, 52, lo=52, hi=71, vel=0.36, bright=0.3)

    # ------------------------------------------------------------ REC m53-m56 (168-180)
    changes = []
    rec_arp = {"D": ["D2", "A2", "D3", "F#3", "A3"], "A/C#": ["C#2", "A2", "E3", "A3", "C#4"],
               "Bm7": ["B1", "F#2", "D3", "A3"], "Gmaj7": ["G1", "D2", "B2", "F#3"]}
    for (a, b, s) in chord_spans(53, 55):
        v = rec_arp[s]
        nsteps = int(round((b - a) / B(0.5)))
        pat = (0, 1, 2, 3, 4, 3, 2, 1) if len(v) == 5 else (0, 1, 2, 3)
        pno.n(a, b - a + 0.2, P(v[0]) - 12, 48)
        arp(pno, a, v, nsteps, B(0.5), pattern=pat, vb=56, vlo=40, vhi=50)
        changes.append(a)
    rec = [
        (53, [(1, 2, "F#5", 70), (3, 1, "E5", 64), (4, 1, "D5", 62)]),
        (54, [(1, 3, "A4", 64), (4, .5, "B4", 60), (4.5, .5, "C#5", 64)]),
        (55, [(1, 2, "D5", 68), (3, 1, "E5", 68), (4, 1, "F#5", 72)]),
    ]
    for m, items in rec:
        mel(pno, m, items, octave=1, ov=-8)
    # final Dmaj9 at 177.0
    tf = CUES["final_chord"]
    pno.n(tf, 3.4, "D1", 50)
    pno.n(tf + 0.01, 3.4, "D2", 50)
    rolled(pno, tf + 0.05, ["A2", "F#3", "C#4", "E4", "A4"], 3.3, 44, roll=0.06, vstep=2)
    pno.n(tf + 0.02, 3.2, "E5", 62)
    pno.n(tf + 0.025, 3.2, "E6", 54)
    changes.append(tf)
    pno.pedal(changes, end=180.6)
    prev = None
    for (a, b, s) in chord_spans(53, 56):
        if s == "Dmaj9":
            b = tf + 3.2
        up = lead_voices(prev, s, 3, 57, 76, 9, 67)
        prev = up
        for ch, p in zip((VLA, VN2, VN1), up):
            strings.n(a - 0.1, b - a + 0.1, p, 74, ch=ch)
        bn = bass_of(s, 33, 44)
        strings.n(a - 0.1, b - a + 0.1, bn - 12 if bn > 38 else bn, 72, ch=CB)
        strings.n(a - 0.1, b - a + 0.1, bn + 12, 70, ch=VC)
    for m, items in rec:
        for b_, d_, p_, v_ in items:
            strings.n(T(m, b_) - 0.08, B(d_) + 0.1, p_, 70, ch=VN1)
    strings.n(tf - 0.05, 3.2, "E5", 70, ch=VN1)
    strings.n(tf - 0.05, 3.2, "A5", 64, ch=VN2)
    strings.cc_curve(11, [(T(53), 118), (T(55), 118), (tf, 120), (tf + 1.2, 108), (179.4, 70),
                          (180.6, 0)], ch=[0, 1, 2, 3, 4])
    for (a, b, s) in [(T(55), T(55, 3), "Bm7"), (T(55, 3), tf, "Gmaj7"), (tf, tf + 3.2, "Dmaj9")]:
        cv = {"Bm7": ["D4", "F#4", "A4"], "Gmaj7": ["D4", "F#4", "B4"], "Dmaj9": ["C#4", "E4", "A4", "F#4"]}[s]
        for p in cv:
            choir.n(a - 0.15, b - a + 0.15, p, 58)
    choir.cc_curve(11, [(T(55) - 0.3, 30), (tf, 84), (tf + 1.5, 70), (180.0, 0)])
    # bells: glockenspiel on the phrase starts, tubular bell on the last chord
    for t, p, v in [(T(53), "F#6", 50), (T(53, 3), "E6", 40), (T(54), "A5", 46), (T(54, 4.5), "C#6", 38),
                    (T(55), "D6", 48), (T(55, 4), "F#6", 44), (tf + 0.02, "E6", 52), (tf + 0.3, "A6", 40)]:
        bells.n(t, 1.5, p, v, ch=0)
    bells.n(tf, 4.0, "D5", 52, ch=1)
    for m in (53, 54, 55):
        for bt in (1, 3):
            kick.n(T(m, bt), 0.2, 36, 62 if bt == 1 else 52)
        kick.n(T(m, 3.5), 0.2, 36, 44)
        for bt in (2, 4):
            brush.n(T(m, bt), 0.25, 39, 56)
        for k in range(8):
            perc.n(T(m) + k * B(0.5) + (0.02 if k % 2 else 0), 0.1, 82, 36 + (6 if k % 2 == 0 else 0))
    kick.n(tf, 0.3, 36, 64)
    perc.n(tf, 1.0, 49, 42)                                           # soft crash on the final chord
    pad_block(53, 56, lo=54, hi=74, vel=0.34, bright=0.4)
    for p in ["D5", "F#5", "A5", "C#6", "E6"]:
        shim.n(tf, 3.5, p, 0.7, hum=False)

    # 'air' layer: the very same performance rendered with FluidR3's brighter grand
    # (identical humanisation via the shared seed); the mixer keeps only its top end.
    pbr = Part("piano_bright", programs={0: (0, 0)}, humanize=pno.humanize,
               seed=zlib.crc32(b"piano"), vel_map=pno.vel_map)
    pbr.notes, pbr.ccs = list(pno.notes), list(pno.ccs)
    pbr.soundfont = FLUIDR3
    for part in (pno, pbr, swell, mbox, cel, bells, strings, cello, choir, ep,
                 kick, snare, hats, perc, brush, pad, sub, chip, pluck, shim):
        S[part.name] = part
    return S


if __name__ == "__main__":
    S = compose()
    for k, p in S.items():
        print(f"{k:14s} {p.kind:5s} notes={len(p.notes):4d} ccs={len(p.ccs)}")
