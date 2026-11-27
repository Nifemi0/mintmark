# Original score for the Mintmark ad: 120 BPM, 45 s, cut to the picture's beat grid.
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 48000
DUR = 45.0
BEAT = 0.5
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

# ---------- arrangement ----------
CH = {  # chord tones for stabs, bass root
    'Am': (['A3', 'C4', 'E4', 'B4'], 'A1'), 'F': (['F3', 'A3', 'C4', 'E4'], 'F1'), 'C': (['G3', 'C4', 'E4', 'D5'], 'C2'),
    'G': (['G3', 'B3', 'D4', 'A4'], 'G1'), 'Dm': (['D4', 'F4', 'A4', 'E5'], 'D2'), 'E': (['G#3', 'B3', 'E4', 'F#4'], 'E1'),
}
def bars(t0, t1, prog):
    out = []; t = t0; i = 0
    while t < t1 - 1e-6:
        out.append((t, prog[i % len(prog)])); t += 2.0; i += 1
    return out

def groove(t0, t1, prog, intensity=1.0, ticks=False, hats_open=False, half=False):
    for (bt, ch) in bars(t0, t1, prog):
        notes, root = CH[ch]
        for k in range(4):
            tb = bt + k * BEAT
            if tb >= t1: break
            if not half or k % 2 == 0: add(kick(), tb, 0.9 * intensity)
            if k in (1, 3) and not half: add(clap(), tb, 0.55 * intensity, 0.1)
            if half and k == 2: add(clap(), tb, 0.55 * intensity, 0.1)
            for s in range(2):
                th = tb + s * BEAT / 2
                if th < t1: add(hat(hats_open and s == 1), th, (0.5 if s else 0.28) * intensity, 0.35)
            # bass: off-beat eighths pumping
            bn = root if k != 3 else root[:-1] + str(int(root[-1]) + 1)
            add(bass(bn, BEAT / 2 - 0.02), tb + BEAT / 2, 0.55 * intensity)
            if k == 0: add(bass(root, BEAT / 2 - 0.02), tb, 0.5 * intensity)
        # chord stabs on the "and" of 2 and on 4 (syncopated, varies per bar)
        for off in (1.5 * BEAT, 3 * BEAT + BEAT / 2):
            if bt + off < t1: add(stab(notes, cutoff=2200 + 1800 * intensity), bt + off, 0.42 * intensity, -0.2)
        if ticks:
            for s in range(16):
                ts = bt + s * BEAT / 4
                if ts < t1 and (s % 3 != 2): add(tick(3000 + 400 * (s % 4)), ts, 0.30 + 0.12 * (s % 2), 0.5 if s % 2 else -0.5)

# 0 - 1: engraving shimmer, building
add(pad(['A3', 'E4', 'B4'], 1.2, cutoff=1800, attack=0.9), 0, 0.5)
for s in range(8): add(tick(4200 + 200 * s), s * BEAT / 4, 0.12 + 0.03 * s, 0.6 if s % 2 else -0.6)
riser(0.2, 1.0, 'A2', 0.25)
add(impact(), b(2), 0.9)
# 1 - 4.5: paper
groove(b(2), b(9), ['Am', 'F', 'C', 'G'], 0.85)
add(pad(['A3', 'C4', 'E4'], 3.5, cutoff=900), b(2), 0.25)
# 4.5: drop-out + tonal lift, 5.0 hit (1867)
riser(b(9), b(10), 'E3', 0.35)
add(impact(0.8), b(10), 0.75)
groove(b(10), b(16), ['Am', 'F', 'C', 'G'], 0.95, ticks=True)
# 8.0: 2026 hit, halftone glitch stutter
add(impact(0.9), b(16), 0.8)
for k in range(6): add(stab(CH['Am'][0], dur=0.05, cutoff=5000), b(16) + k * BEAT / 4, 0.3, 0.3 if k % 2 else -0.3)
groove(b(16.5), b(19.5), ['C', 'G'], 0.8, half=True)
riser(b(18.5), b(20), 'A2', 0.35)
# 10 - 20: NVDA, cards, counter, look-alikes
add(impact(), b(20), 0.95)
groove(b(20), b(32), ['Am', 'F', 'Dm', 'E'], 1.0, hats_open=True)
for s in range(int((b(28) - b(26.6)) / (BEAT / 4))): add(tick(2600 + 60 * s), b(26.6) + s * BEAT / 4, 0.22 + 0.01 * s, 0.4 if s % 2 else -0.4)  # counter roll
for k, tt in enumerate([b(29.75), b(30.25), b(30.75)]): add(stab(['A4', 'C5', 'E5'][k:k + 1] + ['A3'], dur=0.15, cutoff=4000), tt, 0.5, (k - 1) * 0.5)
groove(b(32), b(38), ['Dm', 'E'], 0.9, half=True)
add(pad(['D4', 'F4', 'A4', 'E5'], 3.0, cutoff=1100), b(32), 0.22)
add(stamp(), b(35.5), 0.9)
add(stab(['A#3', 'E4', 'G#4'], dur=0.3, cutoff=3000), b(35.25), 0.45)
riser(b(38), b(40), 'E2', 0.45)
add(pad(['E3', 'G#3', 'B3', 'D4'], 2.0, cutoff=900, attack=1.2), b(38), 0.35)
for k in range(8): add(kick(0.6), b(38 + k * 0.5), 0.25 + 0.06 * k)
# 20 - 34: the registry (bright)
add(impact(), b(40), 1.0)
groove(b(40), b(68), ['C', 'G', 'Am', 'F'], 1.05, hats_open=True)
add(pad(['C4', 'E4', 'G4', 'D5'], 4.0, cutoff=1600), b(40), 0.25)
for k in range(4): add(tick(3400), b(44.5) + k * BEAT / 4, 0.35, 0.2)  # typing NVDA
add(stamp(), b(49), 1.0)
for k in range(4): add(impact(0.5), b(52 + 2 * k), 0.4)  # feature changes
for k in range(48): add(tick(3600 + (k % 3) * 300), b(60) + k * (b(1.2) / 48), 0.12, 0.3 if k % 2 else -0.3)  # terminal typing
for k, nt in enumerate(['C5', 'E5', 'G5']): add(bell(nt, dur=1.4), b(64 + 0.25 * k), 0.35, (k - 1) * 0.5)  # three dots (single, not repeated)
add(pad(['C4', 'E4', 'G4', 'B4', 'D5'], 2.0, cutoff=2400, attack=0.05), b(66), 0.3)
# 34 - 36: rewind (tape-stop on the groove)
seg = slice(int(b(60) * SR), int(b(64) * SR))
src = (L[seg] + R[seg]) / 2
n = int(b(4) * SR); tt = np.arange(n) / n
speed = np.maximum(0.12, 1 - tt ** 1.4 * 0.88)
pos = np.cumsum(speed); pos = (pos / pos[-1] * (len(src) - 1)).astype(int)[::-1]
rew = filt(src[pos], 'low', 4000) * np.minimum(1, (1 - tt) / 0.1)
add(rew, b(68), 0.55)
for s in range(16): add(tick(2200 + 150 * s), b(68.2) + s * (b(3) / 16), 0.25, 0.5 if s % 2 else -0.5)  # year rolling back
for k in range(4): add(kick(0.7), b(68 + k), 0.6)
# 36 - 38: the line
add(impact(0.7), b(72), 0.6)
add(pad(['A3', 'C4', 'E4', 'B4'], 3.0, cutoff=1300, attack=0.2), b(72), 0.35)
for k in range(6): add(kick(0.8), b(72 + k * 0.5), 0.45 + 0.05 * k)
riser(b(75), b(78), 'C3', 0.5)
for s in range(12): add(tick(4000 + 150 * s), b(75) + s * (b(1.5) / 12), 0.12, 0.6 if s % 2 else -0.6)  # rosette engraving
# 39: logo lands
add(impact(1.0), b(78), 1.0)
add(kick(), b(78), 1.0)
add(pad(['C3', 'G3', 'C4', 'E4', 'G4', 'D5'], 6.0, cutoff=2200, attack=0.02), b(78), 0.42)
add(bass('C1', 3.0), b(78), 0.7)
for k, nt in enumerate(['G4', 'C5', 'E5']): add(bell(nt, dur=3.5), b(79 + 0.5 * k), 0.3, (k - 1) * 0.4)

# ---------- master ----------
def reverb(x, secs=1.6, wet=0.18):
    n = int(secs * SR); t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-t * 4.2); ir = filt(ir, 'low', 6000); ir /= np.sqrt(np.sum(ir ** 2))
    return x * (1 - wet) + fftconvolve(x, ir)[:len(x)] * wet
L = reverb(L); R = reverb(R)
mix = np.stack([L, R], 1)
mix = np.tanh(mix / (np.max(np.abs(mix)) + 1e-9) * 1.4)
fade = np.ones(N); fn = int(1.2 * SR); fade[-fn:] = np.linspace(1, 0, fn) ** 2
mix *= fade[:, None]
mix *= 0.89 / np.max(np.abs(mix))
wavfile.write('score.wav', SR, (mix * 32767).astype(np.int16))
print('wrote score.wav')
