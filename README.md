# MotionDesigns

Short motion-design films, each written, drawn, scored and rendered entirely from code:
story, visuals, music and sound design. No stock footage, samples or existing music.

## Projects

| # | Film | Year | Length | About |
|---|---|---|---|---|
| 01 | [AFTERGLOW](afterglow/) | 2026 | 3:02 | Nostalgia for the ’90s, the 2000s and the 2010s |

---

### 01 · AFTERGLOW
*A letter to the ’90s, the 2000s and the 2010s.*

[![AFTERGLOW — Summers lasted forever.](afterglow/poster.jpg)](afterglow/AFTERGLOW_1080p.mp4)

A 3-minute film about nostalgia: summers that lasted forever, the sound of dial-up,
one earbud each. It asks why our memories seem to glow, and what we actually miss when we miss the past.

1920×1080 · 24 fps · original score and sound design · made with Claude Opus 5.5 in Claude Code

▶ **[Watch the film](afterglow/AFTERGLOW_1080p.mp4)** · [About the project](afterglow/README.md) · [Script & timings](afterglow/SCRIPT.md)

---

## How the films are made

- **Picture:** HTML canvas illustration with a WebGL post-processing chain (bloom, halation,
  film grain, light leaks, VHS/CRT). Headless Chromium renders it frame by frame, with a
  deterministic clock, into ffmpeg.
- **Sound:** original music composed as MIDI and played with open-source soundfonts, plus
  synthesized sound design, mixed and mastered in Python.
- **Everything is reproducible:** each project folder has its own README with the commands
  to rebuild the film from scratch.

## Layout

```
MotionDesigns/
└── afterglow/                 01 · AFTERGLOW
    ├── AFTERGLOW_1080p.mp4    the film
    ├── SCRIPT.md              story and timing sheet
    ├── web/                   scenes, look, captions, fonts
    ├── audio/                 score, sound design, mix
    └── render/                frame renderer and encoder
```

More films to come.
