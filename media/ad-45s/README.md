# Mintmark ad (45 s)

A 54-second motion ad, 1920×1080, 60 fps, built in code at 100 BPM (one beat = 0.6 s).
The ad tells the story of proving share ownership: the 1606 Amsterdam share, Edison's
1871 stock ticker, a 1900s exchange floor, then NVDA today with three issuers
(Ondo, bStocks, xStocks), three contracts and one registry. It ends on the Mintmark logo.

- `film.js`: act 1 (rosette, the 1606 share, ticker tape, exchange floor, halftone to contract address) and the frame loop.
- `act2.js`: NVDA, 3D issuer cards, the 1,937-contract logo wall, provider split, look-alike check.
- `act3.js`: provider braid, registry UI and seal, features, API, rewind, the line, logo.
- `core.js`: easing, magic-move text, odometer roll, guilloche rosettes, painted strokes.
- `gl3d.js`: three.js tapes and cards.
- `score.py`: original score, synthesized (numpy/scipy).
- `assets/`: public-domain archive images from Wikimedia Commons (VOC share 1606, Edison stock ticker / NMAH, NYSE floor), turned into duotones by `prep.py`, plus the site's logos.

Render (serve this folder over HTTP first, e.g. `python3 -m http.server 8765`):

```sh
node render.mjs previews/silent.mp4 0 54 60 2   # 60 fps, 2-sample motion blur
python3 score.py                                 # writes score.wav
ffmpeg -i previews/silent.mp4 -i score.wav -map 0:v -map 1:a -c:v libx264 -crf 17 -c:a aac -b:a 256k \
  -af "volume=<gain to -14 LUFS>dB,alimiter=limit=0.89" -shortest previews/mintmark-ad-54s.mp4
```
