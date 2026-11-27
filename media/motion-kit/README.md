# Motion kit

The pipeline behind the Mintmark ad (`media/ad-45s`), packaged so any new video starts from working parts.
Films are code: a deterministic `renderFrame(t)` draws any moment, Chromium captures frames, ffmpeg encodes.
Everything is timed in **beats** (`b(4)` = 4 beats), so tempo changes stretch the whole film and keep music in sync.

## Files

| File | What it does |
|---|---|
| `film.html` | Stage: `c0` canvas (under), `gl` three.js canvas, `c1` canvas (over). Sets `window.FILM_BPM`. |
| `film.js` | Your scenes. Starter shows rosette, typed headline, magic-move morph, marker highlight, odometer, end card. |
| `core.js` | Toolkit: easing, `rise`/`fall` (typed text), `morph` (magic-move text), `roll` (odometer), `rosette` (guilloche), `paint` (marker strokes), `loopPts`/`linePts`/`arrowPts`/`crossPts`, `img` (cover-fit images), `cue` (sound events). |
| `gl3d.js` | three.js helpers: `Ribbon` (printed 3D tape that never reads mirrored), `tapeTexture`, `textTexture`, `px2w`. |
| `render.mjs` | Frame capture → mp4. `node render.mjs out.mp4 [start|-] [end|-] [fps] [subframes]`; `--stills dir t1 t2…` for review. |
| `scan.mjs` | Renders the timeline at 240 Hz without capture and writes `cues.json`: every typed letter, odometer tick, marker stroke, engraving. |
| `score.py` | Original synthesized music, one continuous track. Edit `DUR`, `BEAT`, the energy curve and the accents. |
| `sfx.py` | Sound design from `cues.json` plus placed hits by beat. Short clean hits only. |
| `mix.py` | Music + effects → `final_mix.wav` (effects at 0.3× music RMS, no ducking). |
| `prep-duotone.py` | Turns archive photos into clean ink-on-white duotones (no sepia). |
| `contact-sheet.py` | Grid of stills for reviewing. |

## Run

```sh
python3 -m http.server 8765 &          # serve this folder (ES modules need http)
node render.mjs --stills st 1 2 3       # look at moments while building
node scan.mjs && python3 score.py && python3 sfx.py && python3 mix.py
node render.mjs previews/silent.mp4 - - 60 2      # 60 fps, 2-sample motion blur
I=$(ffmpeg -i final_mix.wav -af ebur128 -f null - 2>&1 | grep -E '^\s+I:' | tail -1 | awk '{print $2}')
ffmpeg -i previews/silent.mp4 -i final_mix.wav -map 0:v -map 1:a -c:v libx264 -crf 17 -pix_fmt yuv420p \
  -c:a aac -b:a 256k -af "volume=$(python3 -c "print(-14-($I))")dB,alimiter=limit=0.89:level=false" \
  -shortest -movflags +faststart previews/final.mp4
```

Needs: Node + Playwright Chromium, ffmpeg, Python 3 with numpy and scipy.
Render speed in a cloud container is about 0.6 s per frame (double with 2 subframes).
