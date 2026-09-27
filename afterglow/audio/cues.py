"""AFTERGLOW - single source of truth for timing.

Every time value used by the soundtrack build lives in this file (seconds, film
timeline, t=0 = film frame 0).  Edit a value and run `python3 audio/build.py`.

Two kinds of entries:
  * SFX / ambience cues: pure sound-design events. Moving them only moves the
    sound (nothing else depends on them).
  * [music] cues: effect points applied to the MUSIC BUS (beat drop, earbud,
    reality->memory bloom, tape stop, fade...).  The notes themselves are fixed
    to the bar grid below (80 BPM, bar m starts at 9 + 3m s); if you move one of
    these you move the effect, not the notes.
"""

SR = 48000
DURATION = 182.0
N_SAMPLES = int(round(DURATION * SR))          # 8,736,000

BPM = 80.0
BEAT = 60.0 / BPM                              # 0.75 s
BAR = 4 * BEAT                                 # 3.0 s
MUSIC_T0 = 9.0                                 # bar m0 downbeat
LEAD_IN_BEATS = int(round(MUSIC_T0 / BEAT))    # 12 beats of silence in the MIDI


def bar_t(m, beat=1.0):
    """Film time of bar m (0-based, m0 = 9.0 s), beat 1-based (2.5 = 'two-and')."""
    return MUSIC_T0 + BAR * m + BEAT * (beat - 1.0)


# ---------------------------------------------------------------- sections
# (key, label, start, end) - used for automation, the report and the plots.
SECTIONS = [
    ("cold_open",   "Cold open",            0.0,   9.0),
    ("intro",       "Intro / title",        9.0,  21.0),
    ("courtyard",   "'90s courtyard",      21.0,  42.0),
    ("tv",          "TV + console",        42.0,  48.0),
    ("village",     "Village night",       48.0,  60.0),
    ("dialup",      "Dial-up",             60.0,  66.0),
    ("y2k",         "2000s beat",          66.0,  84.0),
    ("earbud",      "2000s earbud",        84.0,  90.0),
    ("y2010",       "2010s",               90.0, 102.0),
    ("question",    "The question",       102.0, 108.0),
    ("reality",     "Reality vs memory",  108.0, 120.0),
    ("first",       "First times",        120.0, 126.0),
    ("who",         "Who we were",        126.0, 138.0),
    ("people",      "The people (peak)",  138.0, 147.0),
    ("imagined",    "Imagined?",          147.0, 156.0),
    ("tape_end",    "Tape end",           156.0, 162.0),
    ("today",       "Today",              162.0, 168.0),
    ("rec",         "REC",                168.0, 180.0),
    ("fade",        "Fade",               180.0, 182.0),
]

# ---------------------------------------------------------------- cue sheet
CUES = {
    # cold open (SFX + ambience)
    "hiss_open":        (0.0, 9.2),       # cassette hiss bed
    "case_open":        0.5,              # cassette case clack
    "cassette_desk":    1.2,              # cassette set on desk
    "pencil_rewind":    (2.0, 6.2),       # pencil rewinding the tape
    "cassette_in":      6.8,              # cassette into deck
    "play_clunk":       7.5,              # PLAY key + motor start
    "reverse_swell":    (8.2, 9.0),       # [music] reversed piano/reverb swell -> m0

    # '90s courtyard
    "swallows":         (21.0, 33.0),     # swallows + soft evening wind
    "ball_stop":        29.2,             # sneaker stops the ball
    "streetlight":      (35.0, 35.8),     # ballast ticks + hum

    # TV + console
    "crt_on":           42.0,             # CRT power-on (degauss, whine, static)
    "jump_blips":       [43.1, 44.3, 46.4],
    "coin":             43.7,
    "freeze":           (45.2, 45.8),     # [music] chiptune stutters then drops out

    # village
    "crickets":         (48.0, 60.0),

    # dial-up
    "modem":            (60.2, 65.0),
    "reverse_riser":    (65.0, 66.0),
    "beat_drop":        66.0,             # [music] reference only (bar m19)

    # 2000s
    "online_chime":     67.6,
    "buzz":             (71.0, 71.8),
    "msg_pops":         [72.4, 73.1],
    "t9":               (75.2, 78.6),
    "vibrations":       [(79.4, 79.9), (80.4, 80.9)],
    "earbud":           (84.0, 89.0, 90.0),  # [music] narrow from 84.0, opening 89.0 -> 90.0

    # 2010s
    "shutters":         [91.6, 93.2],
    "like_pop":         96.5,
    "beat_cut":         102.0,            # [music] beat/synths cut hard (tails ring)

    # reality vs memory
    "rain":             (108.0, 110.8),
    "reality":          (108.0, 110.8),   # [music] dry / dull / mono / wobbly
    "bloom":            (110.8, 111.8),   # [music] warm shimmer swell into memory

    # first times
    "whooshes":         [120.2, 121.8, 123.4],

    # people / imagined
    "clock":            (139.0, 146.0),   # kitchen clock ticks, ~1 Hz
    "projector":        (147.0, 156.0),   # projector clatter + motor

    # tape end
    "tape_stop":        (156.3, 157.2),   # [music] speed 1 -> 0 (pitch slides down)
    "key_popup":        157.2,            # PLAY key pops up
    "hiss_tape_end":    (157.2, 162.0),

    # today / REC
    "riser":            (166.0, 168.0),
    "rec_clunk":        168.0,            # REC+PLAY clunk + motor
    "final_chord":      177.0,            # [music] reference only (bar m56)
    "fade_out":         (180.0, 182.0),
}


def section_bounds(key):
    for k, _, a, b in SECTIONS:
        if k == key:
            return a, b
    raise KeyError(key)
