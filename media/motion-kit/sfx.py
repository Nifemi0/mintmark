# Sound design layer, locked to the picture. Dynamic events (typed letters,
# odometer ticks, marker strokes, engraving) come from cues.json, produced by a
# dense scan of the film; one-off hits are placed below by beat.
import json
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 48000; DUR = 14.4; BEAT = 0.6   # EDIT: match the film
b = lambda n: n * BEAT
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(11)

def filt(x, kind, f, order=2):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output='sos'), x)
def nz(n): return rng.standard_normal(n)
def tt(n): return np.arange(n) / SR
def add(sig, t, g=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N: return
    sig = sig[:N - i]
    pan = max(-1, min(1, pan))
    L[i:i + len(sig)] += sig * g * np.cos((pan + 1) * np.pi / 4) * 1.414
    R[i:i + len(sig)] += sig * g * np.sin((pan + 1) * np.pi / 4) * 1.414

# ---------- sounds ----------
def key(size=120, soft=False):
    n = int(0.09 * SR); t = tt(n)
    f0 = 170 + rng.uniform(-25, 25) - (size - 120) * 0.25
    thock = np.sin(2 * np.pi * f0 * t) * np.exp(-t * 55)
    click = filt(nz(n), 'band', [2500, 7500]) * np.exp(-t * 420)
    body = filt(nz(n), 'band', [700, 2000]) * np.exp(-t * 160)
    x = thock * 0.9 + click * (0.35 if soft else 0.8) + body * (0.2 if soft else 0.5)
    return x * rng.uniform(0.75, 1.0)
def untype():
    n = int(0.05 * SR); t = tt(n)
    return (filt(nz(n), 'band', [3000, 9000]) * np.exp(-t * 300) + np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 200) * 0.2) * 0.5
def tick():
    n = int(0.04 * SR); t = tt(n)
    return filt(nz(n), 'band', [3500, 9000]) * np.exp(-t * 500) * 0.8 + np.sin(2 * np.pi * (2600 + rng.uniform(-150, 150)) * t) * np.exp(-t * 160) * 0.35
def scratch(dur, lo=1200, hi=4800, grain=28):
    n = int(dur * SR); t = tt(n)
    am = np.abs(filt(nz(n), 'low', grain)); am /= am.max() + 1e-9
    x = filt(nz(n), 'band', [lo, hi]) * (0.45 + 0.55 * am)
    env = np.minimum(1, t / 0.012) * np.minimum(1, (dur - t) / 0.04)
    return x * env
def swipe(dur=0.2, lo=500, hi=2500):
    n = int(dur * SR); t = tt(n)
    env = np.sin(np.pi * t / dur) ** 2
    return filt(nz(n), 'band', [lo, hi]) * env * 0.6
def thud():
    n = int(0.25 * SR); t = tt(n)
    x = np.sin(2 * np.pi * (75 + 60 * np.exp(-t * 40)) * t) * np.exp(-t * 18)
    return np.tanh(2 * x + 0.3 * filt(nz(n), 'band', [1500, 4000]) * np.exp(-t * 200))
def pop(f=700):
    n = int(0.12 * SR); t = tt(n)
    x = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.8 * np.exp(-t * 60))) / SR) * np.exp(-t * 38)
    return x * 0.8 + filt(nz(n), 'high', 4000) * np.exp(-t * 600) * 0.3
def paper():
    n = int(0.28 * SR); t = tt(n)
    crack = (rng.random(n) < 0.004) * rng.uniform(-1, 1, n)
    x = filt(nz(n) * 0.5 + filt(crack, 'high', 2000) * 6, 'band', [1500, 7000])
    return x * np.sin(np.pi * t / 0.28) * 0.6
def glitch(dur=0.32):
    n = int(dur * SR); x = np.zeros(n); i = 0
    while i < n:
        m = int(rng.uniform(0.012, 0.04) * SR); f = rng.choice([220, 440, 880, 1320, 1760, 2640])
        seg = np.sign(np.sin(2 * np.pi * f * tt(m))) * rng.uniform(0.3, 0.8)
        seg = np.round(seg * 4) / 4
        x[i:i + m] = seg[:max(0, min(m, n - i))]; i += m
    return filt(x, 'band', [200, 6000]) * 0.45 * np.minimum(1, (dur - tt(n)) / 0.03)
def blip(f):
    n = int(0.05 * SR); t = tt(n); return np.sin(2 * np.pi * f * t) * np.exp(-t * 90)
def ribbon(dur):
    n = int(dur * SR); t = tt(n)
    am = 0.5 + 0.5 * np.sin(2 * np.pi * (14 + 6 * np.sin(t * 3)) * t)
    x = filt(nz(n), 'band', [600, 3500]) * am
    return x * np.minimum(1, t / 0.15) * np.minimum(1, (dur - t) / 0.3) * 0.35
def stamp():
    n = int(0.5 * SR); t = tt(n)
    x = np.sin(2 * np.pi * (70 + 80 * np.exp(-t * 40)) * t) * np.exp(-t * 12)
    x += 0.7 * filt(nz(n), 'band', [300, 2500]) * np.exp(-t * 30)
    return np.tanh(2.2 * x)
def whir(dur, f0=300, f1=1400):
    n = int(dur * SR); t = tt(n); f = f0 + (f1 - f0) * (t / dur) ** 1.5
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3 + filt(nz(n), 'band', [800, 3000]) * 0.3
    return x * np.sin(np.pi * t / dur) * 0.5
def ring_click():
    n = int(0.08 * SR); t = tt(n)
    return np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 80) * 0.5 + filt(nz(n), 'high', 3000) * np.exp(-t * 400) * 0.6

# No swooshes: every noise-based sustained sound is silenced; only short clean hits remain.
SILENT = lambda *a, **k: np.zeros(1)
swipe = ribbon = whir = paper = SILENT
def glitch(dur=0.32):  # three tight digital blips instead of a noise burst
    x = np.zeros(int(0.2 * SR))
    for i, f in enumerate([1760, 1320, 2640]):
        bl = blip(f); j = int(i * 0.05 * SR); x[j:j + len(bl)] += bl * 0.6
    return x

# ---------- scanned events ----------
cues = json.load(open('cues.json'))
starts = {}
for i, e in enumerate(cues):
    if e['type'] == 'marker': starts.setdefault(len(starts), e)
markers = [e for e in cues if e['type'] == 'marker']
ends = [e for e in cues if e['type'] == 'markerEnd']
for e in cues:
    t, ty, pan = e['t'], e['type'], e.get('pan', 0)
    if ty == 'type': add(key(e.get('size', 120), soft=True), t, 0.2, pan * 0.5)
    elif ty == 'tick': add(tick(), t, 0.14, pan * 0.5)
for m, en in zip(markers, ends):
    d = en['t'] - m['t']
    if d < 0.05: d = 0.38
    w = m.get('w', 20)
    lo, hi = (900, 3500) if w > 60 else (1500, 5200)
    pass  # markers stay silent (scratches read as swooshes)

# ---------- placed hits (by beat) ----------
# EDIT: one entry per visual event the scan cannot see: (beat, sound, gain, pan).
# Use only short clean hits: pop, thud, stamp, ring_click, key, blip, glitch.
P = [
    (2, pop(520), 0.5, 0),          # disc lands
    (18, thud(), 0.5, 0),           # end card
]
for beat, s, g, pan in P: add(s, b(beat), g, pan)

out = np.stack([L, R], 1)
wavfile.write('sfx.wav', SR, (out / (np.max(np.abs(out)) + 1e-9) * 0.9 * 32767).astype(np.int16))
print('sfx peak', np.max(np.abs(out)))
