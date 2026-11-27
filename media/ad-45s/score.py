# Original score for the Mintmark ad: 120 BPM, 45 s, cut to the picture's beat grid.
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 48000
DUR = 54.0
BEAT = 0.6
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)
b = lambda n: n * BEAT

def hz(note):
    names = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    n, o = note[:-1], int(note[-1])
    return 440 * 2 ** ((names[n] + 12 * (o + 1) - 69) / 12)

def filt(x, kind, f, order=2):
    sos = butter(order, f, btype=kind, fs=SR, output='sos'); return sosfilt(sos, x)

def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N or i + len(sig) <= 0: return
    if i < 0: sig = sig[-i:]; i = 0
    sig = sig[:N - i]
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(sig)] += sig * gain * l * 1.414
    R[i:i + len(sig)] += sig * gain * r * 1.414

def env(n, a=0.002, d=0.2, s=0.0, rel=0.05, hold=None):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4))
    e = e * (s + (1 - s) * np.exp(-np.maximum(0, t - a) / max(d, 1e-4)))
    if hold is not None:
        e = e * np.clip(1 - (t - hold) / rel, 0, 1)
    return e

# ---------- instruments ----------
def kick(g=1.0):
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = 48 + 120 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t * 7.5)
    x += 0.25 * filt(rng.standard_normal(n), 'high', 2500) * np.exp(-t * 180)
    return np.tanh(x * 1.6) * g

def clap():
    n = int(0.3 * SR); t = np.arange(n) / SR
    nz = filt(rng.standard_normal(n), 'band', [900, 3200])
    e = np.zeros(n)
    for k, o in enumerate([0, 0.011, 0.022]):
        e += (t >= o) * np.exp(-np.maximum(0, t - o) * (120 if k < 2 else 22))
    return nz * e * 0.55

def hat(open_=False):
    n = int((0.35 if open_ else 0.06) * SR); t = np.arange(n) / SR
    x = filt(rng.standard_normal(n), 'high', 7500)
    return x * np.exp(-t * (14 if open_ else 70)) * 0.32

def tick(f=3200):  # telegraph / ticker clack: woody click + short ring
    n = int(0.08 * SR); t = np.arange(n) / SR
    click = filt(rng.standard_normal(n), 'band', [1800, 6000]) * np.exp(-t * 400)
    ring = np.sin(2 * np.pi * f * t) * np.exp(-t * 90) * 0.5 + np.sin(2 * np.pi * f * 1.51 * t) * np.exp(-t * 120) * 0.25
    return (click * 0.7 + ring) * 0.4

def saw(f, n, detune=(0,), bright=1.0):
    t = np.arange(n) / SR; x = np.zeros(n)
    for d in detune:
        ff = f * 2 ** (d / 1200)
        x += 2 * ((t * ff + rng.random()) % 1) - 1
    return x / len(detune)

def bass(note, dur, g=1.0):
    n = int(dur * SR); f = hz(note)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) * 0.8 + 0.35 * filt(saw(f, n), 'low', 600 + 1400 * 0.5)
    return np.tanh(1.4 * x * env(n, 0.004, dur * 0.9, 0.6, 0.03, hold=dur - 0.03)) * g

def stab(notes, dur=0.22, cutoff=2600, g=1.0):
    n = int((dur + 0.25) * SR); x = np.zeros(n)
    for nt in notes: x += saw(hz(nt), n, detune=(-9, 0, 8))
    x = filt(x, 'low', cutoff) * env(n, 0.003, dur * 0.6, 0.0)
    return x * g / len(notes)

def pad(notes, dur, cutoff=1400, g=1.0, attack=0.6):
    n = int(dur * SR); x = np.zeros(n)
    for nt in notes: x += saw(hz(nt), n, detune=(-14, -5, 5, 13))
    t = np.arange(n) / SR
    e = np.minimum(1, t / attack) * np.minimum(1, (dur - t) / 0.4)
    return filt(x, 'low', cutoff) * e * g / len(notes)

def bell(note, g=1.0, dur=2.5):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(note)
    x = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t * dcy) for m, a, dcy in [(1, 1, 1.6), (2.0, 0.35, 3), (3.01, 0.18, 5), (4.2, 0.08, 8)])
    return x * np.minimum(1, t / 0.003) * g * 0.35

def impact(g=1.0):
    n = int(1.6 * SR); t = np.arange(n) / SR
    f = 30 + 60 * np.exp(-t * 8)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.4)
    x += 0.4 * filt(rng.standard_normal(n), 'low', 900) * np.exp(-t * 14)
    return np.tanh(1.5 * x) * g

def riser(t0, t1, root='A3', g=0.5):  # tonal riser: pitch-climbing filtered saw, no noise
    n = int((t1 - t0) * SR); t = np.arange(n) / SR; T = t1 - t0
    f0 = hz(root); f = f0 * 2 ** (1.0 * (t / T) ** 2)
    ph = np.cumsum(f) / SR
    x = (2 * (ph % 1) - 1) + 0.6 * (2 * ((ph * 1.5) % 1) - 1)
    x = filt(x, 'low', 3000) * (t / T) ** 2.2 * g
    add(x, t0, 1.0)

def stamp(g=1.0):
    n = int(0.5 * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * (70 + 80 * np.exp(-t * 40)) * t) * np.exp(-t * 12)
    x += 0.5 * filt(rng.standard_normal(n), 'band', [300, 1500]) * np.exp(-t * 35)
    return np.tanh(2 * x) * g

# ---------- arrangement: one continuous track ----------
CH = {
    'Am': (['A3', 'C4', 'E4', 'B4'], 'A1'), 'F': (['F3', 'A3', 'C4', 'E4'], 'F1'), 'C': (['G3', 'C4', 'E4', 'D5'], 'C2'),
    'G': (['G3', 'B3', 'D4', 'A4'], 'G1'),
}
PROG = ['Am', 'F', 'C', 'G']           # 2 s per chord, never stops
def chord_at(t): return PROG[int(t // (4 * BEAT)) % 4]
def inten(t):                          # energy curve; sections only change how full it is
    pts = [(b(x), y) for x, y in [(0, 0.45), (2, 0.8), (19, 0.85), (20, 0.92), (38, 0.95), (40, 1.0), (68, 1.0), (72, 0.85), (77, 0.95), (78, 1.0), (86, 0.85), (90, 0.7)]]
    for (a, x), (z, y) in zip(pts, pts[1:]):
        if a <= t <= z: return x + (y - x) * (t - a) / (z - a)
    return pts[-1][1]

# continuous pad: overlapping chord pads, cutoff rides the energy curve
for k in range(23):
    t0 = k * 4 * BEAT
    notes, _ = CH[chord_at(t0)]
    add(pad(notes, 4 * BEAT + 0.5, cutoff=900 + 1500 * inten(t0), attack=0.35 if k else 1.0), t0 - (0.25 if k else 0), 0.30)
# sub bass under everything from the first slam to the end
for k in range(int((DUR - b(2)) / BEAT)):
    tb = b(2) + k * BEAT
    root = CH[chord_at(tb)][1]
    add(bass(root, BEAT - 0.03), tb, 0.42 * inten(tb))
    if tb < b(86): add(bass(root[:-1] + str(int(root[-1]) + 1), BEAT / 2 - 0.02), tb + BEAT / 2, 0.32 * inten(tb))
# drums: four-on-the-floor from 1.0 s to the logo, hats/claps continuous
end_drums = b(86)
for k in range(int((end_drums - b(2)) / BEAT)):
    tb = b(2) + k * BEAT
    g = inten(tb)
    add(kick(), tb, 0.9 * g)
    if k % 2 == 1: add(clap(), tb, 0.5 * g, 0.1)
    add(hat(), tb, 0.26 * g, 0.35)
    add(hat(open_=(tb >= b(20))), tb + BEAT / 2, 0.42 * g, 0.35)
    if tb >= b(40): add(hat(), tb + BEAT / 4, 0.16 * g, -0.35); add(hat(), tb + 3 * BEAT / 4, 0.16 * g, -0.35)
# chord stabs: syncopated, every bar
for k in range(int((b(86) - b(2)) / (4 * BEAT))):
    bt = b(2) + k * 4 * BEAT
    notes, _ = CH[chord_at(bt)]
    for off in (1.5 * BEAT, 3.5 * BEAT):
        add(stab(notes, cutoff=2000 + 2200 * inten(bt)), bt + off, 0.36 * inten(bt), -0.2)
# ticker motif runs quietly the whole time, louder in the telegraph section and on the counter
for s_ in range(int((b(86) - b(2)) / (BEAT / 4))):
    ts = b(2) + s_ * BEAT / 4
    if s_ % 4 == 3: continue
    loud = 0.07
    if b(10) <= ts < b(16) or b(26.6) <= ts < b(28) or b(60) <= ts < b(61.2) or b(68) <= ts < b(71): loud = 0.24
    add(tick(3000 + 400 * (s_ % 4)), ts, loud, 0.5 if s_ % 2 else -0.5)

# opening: engraving ticks over the pad, lift into the first slam
for s_ in range(8): add(tick(4200 + 200 * s_), s_ * BEAT / 4, 0.12 + 0.03 * s_, 0.6 if s_ % 2 else -0.6)
riser(b(0.4), b(2), 'A2', 0.22)
# accents that sit ON the groove (nothing stops)
add(impact(0.8), b(2), 0.7)          # 1606
add(impact(0.6), b(10), 0.45)        # 1867
add(impact(0.6), b(16), 0.4)         # 2026
riser(b(18), b(20), 'A2', 0.3)
add(impact(0.9), b(20), 0.6)         # NVDA
add(stamp(), b(35.5), 0.7)           # look-alike stamp
riser(b(38), b(40), 'E2', 0.32)
add(impact(0.9), b(40), 0.6)         # one registry
add(stamp(), b(49), 0.8)             # seal
for k_, nt in enumerate(['C5', 'E5', 'G5']): add(bell(nt, dur=1.4), b(64 + 0.25 * k_), 0.28, (k_ - 1) * 0.5)
riser(b(75), b(78), 'C3', 0.35)
add(impact(1.0), b(78), 0.8)         # logo lands
add(pad(['C3', 'G3', 'C4', 'E4', 'G4', 'D5'], DUR - b(78), cutoff=2200, attack=0.02), b(78), 0.32)
for k_, nt in enumerate(['G4', 'C5', 'E5']): add(bell(nt, dur=3.5), b(79 + 0.5 * k_), 0.25, (k_ - 1) * 0.4)
# after the drums stop at 43 s the pad, bass and a soft kick on 1 carry the logo out
for k_ in range(2): add(kick(0.6), b(86 + 2 * k_), 0.35)

# ---------- master ----------
def reverb(x, secs=1.6, wet=0.18):
    n = int(secs * SR); t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-t * 4.2); ir = filt(ir, 'low', 6000); ir /= np.sqrt(np.sum(ir ** 2))
    return x * (1 - wet) + fftconvolve(x, ir)[:len(x)] * wet
L = reverb(L); R = reverb(R)
mix = np.stack([L, R], 1)
mix = np.tanh(mix / (np.max(np.abs(mix)) + 1e-9) * 1.25)
fade = np.ones(N); fn = int(1.2 * SR); fade[-fn:] = np.linspace(1, 0, fn) ** 2
mix *= fade[:, None]
mix *= 0.89 / np.max(np.abs(mix))
wavfile.write('score.wav', SR, (mix * 32767).astype(np.int16))
print('wrote score.wav')
