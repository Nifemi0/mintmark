# Sound design layer, locked to the picture. Dynamic events (typed letters,
# odometer ticks, marker strokes, engraving) come from cues.json, produced by a
# dense scan of the film; one-off hits are placed below by beat.
import json
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 48000; DUR = 54.0; BEAT = 0.6
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
    x = thock * 0.9 + click * (0.5 if soft else 0.9) + body * 0.5
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

# ---------- scanned events ----------
cues = json.load(open('cues.json'))
starts = {}
for i, e in enumerate(cues):
    if e['type'] == 'marker': starts.setdefault(len(starts), e)
markers = [e for e in cues if e['type'] == 'marker']
ends = [e for e in cues if e['type'] == 'markerEnd']
for e in cues:
    t, ty, pan = e['t'], e['type'], e.get('pan', 0)
    if ty == 'type': add(key(e.get('size', 120)), t, 0.32 if e.get('size', 120) >= 100 else 0.24, pan * 0.7)
    elif ty == 'untype': add(untype(), t, 0.18, pan * 0.7)
    elif ty == 'tick': add(tick(), t, 0.22, pan * 0.6)
    elif ty == 'engrave': add(scratch(e.get('dur', 0.9), 3000, 9500, 45), t, 0.12, pan * 0.4)
for m, en in zip(markers, ends):
    d = en['t'] - m['t']
    if d < 0.05: d = 0.38
    w = m.get('w', 20)
    lo, hi = (900, 3500) if w > 60 else (1500, 5200)
    add(scratch(min(d, 1.2), lo, hi), m['t'], 0.22 if w > 60 else 0.26, m.get('pan', 0) * 0.6)

# ---------- placed hits (by beat) ----------
P = []  # (beat, sound, gain, pan)
P += [(3, swipe(0.3), 0.35, 0), (5, swipe(0.22, 300, 1500), 0.3, -0.2)]
P += [(7, swipe(0.25), 0.3, 0), (7.25, paper(), 0.4, -0.6), (7.5, paper(), 0.4, 0.6), (8, swipe(0.25), 0.3, 0.3), (8, paper(), 0.35, 0.2)]
P += [(9, swipe(0.35, 300, 1800), 0.45, -0.5), (9.25, swipe(0.2), 0.3, 0.5), (10.3, thud(), 0.5, 0.3), (12.4, swipe(0.35, 300, 1800), 0.4, -0.4)]
P += [(11, ribbon(b(2)), 1.0, 0.3)]
P += [(13, glitch(0.42), 0.5, 0)] + [(13 + k * 0.06, ring_click(), 0.25, -0.8 + k * 0.14) for k in range(12)]
P += [(14, thud(), 0.35, -0.4), (14.5, thud(), 0.35, 0.4), (15, thud(), 0.4, 0)]
P += [(16, glitch(0.35), 0.45, 0)]
P += [(17 + k * 0.035, blip(rng.uniform(2500, 7000)), 0.12, rng.uniform(-0.8, 0.8)) for k in range(32)]
P += [(17.95, pop(900), 0.4, 0), (19.4, swipe(0.25), 0.3, 0)]
P += [(19.8, swipe(0.35, 400, 2200), 0.4, 0), (20, pop(520), 0.6, 0)]
P += [(22 + 0.5 * k, swipe(0.22), 0.3, [0, -0.6, 0.6][k]) for k in range(3)] + [(22.4 + 0.5 * k, thud(), 0.4, [0, -0.6, 0.6][k]) for k in range(3)]
P += [(25.5, swipe(0.4, 300, 2000), 0.45, 0)]
P += [((26 * BEAT + d * 0.045) / BEAT, pop(500 + d * 60), 0.2, 0) for d in range(0, 14, 1)]
P += [(29.75 + 0.5 * k, pop([600, 760, 900][k]), 0.45, -0.3 + 0.3 * k) for k in range(3)] + [(31.5, swipe(0.3), 0.3, 0)]
P += [(32, swipe(0.22), 0.3, -0.6), (32.4, thud(), 0.35, -0.6), (32.5, swipe(0.22), 0.3, 0.6), (32.9, thud(), 0.35, 0.6)]
P += [(34 + k * (1 / 42), blip(1600 + 40 * k), 0.13, -0.6 + k * 0.03) for k in range(42)]
P += [(35.5, stamp(), 0.75, 0.5), (37.4, swipe(0.3), 0.3, 0)]
P += [(37.9 + 0.1 * k, pop([700, 880, 1050][k]), 0.35, (k - 1) * 0.5) for k in range(3)] + [(38, whir(b(2), 200, 900), 0.35, 0)]
P += [(40, swipe(0.4, 300, 2200), 0.45, 0), (40, ribbon(b(3.5)), 1.2, 0), (43.6, swipe(0.45, 300, 2000), 0.45, 0), (44, thud(), 0.45, 0)]
P += [(44.5 + 0.25 * k, key(90), 0.5, -0.3) for k in range(4)]
P += [(46 + 0.5 * k, pop(650 + 90 * k), 0.4, 0) for k in range(3)]
P += [(49, stamp(), 0.85, 0.4), (51.2, swipe(0.5, 300, 2200), 0.5, 0.3)]
for k in range(4):
    a = 52 + 2 * k
    P += [(a - 0.25, swipe(0.3, 400, 2400), 0.38, 0.5)]
    if k == 0: P += [(a, pop(600), 0.4, 0.4), (a + 0.1, pop(720), 0.35, 0.6)]
    if k == 1: P += [(a, thud(), 0.35, 0.4)] + [(a + 0.4 + 0.25 * i, pop(700 + 120 * i), 0.35, 0.5) for i in range(3)]
    if k == 2: P += [(a, paper(), 0.45, 0.4)] + [(a + 0.6 + 0.25 * i, pop(800 + 100 * i), 0.3, 0.5) for i in range(3)]
    if k == 3: P += [(a, pop(450), 0.45, 0.2), (a + 0.05, pop(450), 0.45, 0.7)]
cmd = '$ curl mintmark.nuvixes.studio/v1/companies/NVDA'
for i, ch in enumerate(cmd):
    if ch != ' ': P += [(60 + 1.2 * i / len(cmd), key(70, soft=True), 0.38, -0.2 + 0.4 * i / len(cmd))]
P += [(61.4 + 0.25 * i, key(160), 0.3, -0.3) for i in range(8)]
P += [(63.5, swipe(0.3), 0.3, 0)]
P += [(64 + 0.25 * k, pop([520, 660, 820][k]), 0.45, (k - 1) * 0.6) for k in range(3)] + [(66, pop(1000), 0.5, 0), (66, swipe(0.2), 0.25, 0)]
P += [(68 + 0.5 * k, paper(), 0.4, [-0.5, 0.5, -0.3, 0.4, -0.5, 0.5, 0][k]) for k in range(7)] + [(68 + 0.5 * k, swipe(0.15, 600, 3000), 0.22, 0) for k in range(7)]
P += [(71.6, swipe(0.35, 300, 2000), 0.4, 0)]
P += [(76.5, whir(b(1.5), 900, 250), 0.35, 0), (77.6, ring_click(), 0.6, 0), (78, thud(), 0.6, 0), (78.8, swipe(0.4, 300, 1800), 0.35, -0.3)]
P += [(80, ribbon(b(1.5)), 0.6, 0), (84, whir(b(1.5), 400, 1600), 0.3, -0.3), (85.4, ring_click(), 0.4, -0.3)]
for beat, s, g, pan in P: add(s, b(beat), g, pan)

out = np.stack([L, R], 1)
wavfile.write('sfx.wav', SR, (out / (np.max(np.abs(out)) + 1e-9) * 0.9 * 32767).astype(np.int16))
print('sfx peak', np.max(np.abs(out)))
