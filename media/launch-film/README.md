# Mintmark launch film

An 83-second motion-graphics launch film, built in code so it can be re-cut and re-rendered.

- `film.html`: the opening (particles, 3D cards, logo) and the timeline. `window.renderFrame(t)` draws any moment; the opening is time-warped onto the voice-over cues.
- `scenes2.js`: search, evidence, look-alike, daily report, API, wallet and routes, outro.
- `data.js`: real catalog data used on screen.
- `audio/`: voice-over lines (Kokoro TTS, voice `af_heart`, Apache 2.0 model), their timing (`cues.json`, `vo_spans.json`) and the original score and sound design (`compose.py`).

Render:

```sh
node render.mjs previews/film-silent.mp4 0 83 60            # video, 60 fps
python audio/compose.py audio/vo_spans.json audio/score.wav  # score
# mix voice + score, normalise to -14 LUFS, then mux (see commit history for the exact ffmpeg steps)
```
