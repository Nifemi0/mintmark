"""Original score and sound design for the Mintmark launch film.

Everything is synthesised here, so the score is owned outright. Cue times
match film.html / scenes2.js and audio/cues.json. Output: score.wav (stereo,
48 kHz), with the music ducked under the voice-over spans.
Usage: python compose.py <vo_spans.json> <out.wav>
"""
import json, sys
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
DUR = 83.0
N = int(DUR * SR)
BPM = 96
BEAT = 60 / BPM
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)

def t_arr(d): return np.arange(int(d * SR)) / SR
def place(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N: return
    sig = sig[: N - i] * gain
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(sig)] += sig * l * 1.414; R[i:i + len(sig)] += sig * r * 1.414
def lp(x, f, order=2): return sosfilt(butter(order, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, order=2): return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi, order=2): return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)
def env(n, a, d):
    e = np.ones(n); ai = max(1, int(a * SR)); e[:ai] = np.linspace(0, 1, ai)
    e *= np.exp(-np.arange(n) / SR / max(d, 1e-4)); return e
def saw(f, t): return 2 * ((f * t) % 1.0) - 1
def note(m): return 440 * 2 ** ((m - 69) / 12)
_ir = rng.standard_normal(int(2.8 * SR)) * np.exp(-np.arange(int(2.8 * SR)) / SR / 0.75)
IR = lp(_ir, 7000) / np.sqrt(np.sum(_ir ** 2))
def verb(x, mix=0.3): w = fftconvolve(x, IR)[: len(x) + int(2.8 * SR)]; y = np.concatenate([x, np.zeros(len(w) - len(x))]); return y * (1 - mix) + w * mix

# ---------- sound design ----------
def impact(big=1.0):
    t = t_arr(3.2)
    f = 55 * np.exp(-t * 3) + 28
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    crack = lp(rng.standard_normal(len(t)), 3500) * np.exp(-t * 18)
    return verb(sub * 0.9 + crack * 0.45 * big, 0.35)
def riser(d):
    t = t_arr(d); n = rng.standard_normal(len(t)); out = np.zeros(len(t)); step = int(0.05 * SR)
    for i in range(0, len(t), step):
        p = i / len(t); c = 300 + p ** 2 * 7000
        out[i:i + step] = bp(n[i:i + step + 400], c * 0.7, min(c * 1.4, 20000))[: len(out[i:i + step])]
    tone = saw(110 * 2 ** (t / d * 2), t) * 0.15
    return (out * 0.6 + lp(tone, 2500)) * (t / d) ** 2.2
def whoosh(d=0.7):
    t = t_arr(d); n = rng.standard_normal(len(t)); out = np.zeros(len(t)); step = int(0.02 * SR)
    for i in range(0, len(t), step):
        p = i / len(t); c = 400 + np.sin(np.pi * p) * 4500
        out[i:i + step] = bp(n[i:i + step + 400], c * 0.6, min(c * 1.6, 20000))[: len(out[i:i + step])]
    return out * np.sin(np.pi * t / d) ** 1.5
def glitch(d=1.0):
    t = t_arr(d); out = np.zeros(len(t)); i = 0
    while i < len(t):
        seg = int(rng.uniform(0.012, 0.06) * SR)
        kind = rng.integers(3)
        if kind == 0: s = np.sign(np.sin(2 * np.pi * rng.uniform(80, 900) * np.arange(seg) / SR))
        elif kind == 1: s = np.round(rng.standard_normal(seg) * 3) / 3
        else: s = np.zeros(seg)
        out[i:i + seg] = s[: len(out[i:i + seg])] * (0.5 if kind != 2 else 0); i += seg
    stab = sum(saw(note(m), t) for m in (46, 52, 53)) / 3 * np.exp(-t * 3)
    return hp(out, 150) * 0.55 * np.exp(-t * 1.2) + lp(stab, 1800) * 0.5
def stamp():
    t = t_arr(0.6)
    thud = np.sin(2 * np.pi * (90 * np.exp(-t * 20) + 60) * t) * np.exp(-t * 14)
    slap = bp(rng.standard_normal(len(t)), 900, 5000) * np.exp(-t * 45)
    return verb(thud * 0.9 + slap * 0.6, 0.2)
def tick():
    t = t_arr(0.03); return hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 300) * 0.5
def blip(f=1200):
    t = t_arr(0.18); return np.sin(2 * np.pi * (f + 600 * t / 0.18) * t) * np.exp(-t * 28) * 0.4
def kick():
    t = t_arr(0.45); f = 48 + 90 * np.exp(-t * 35)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) + hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 400) * 0.25
def hat(open_=False):
    t = t_arr(0.25 if open_ else 0.06); return hp(rng.standard_normal(len(t)), 7500) * np.exp(-t * (18 if open_ else 80)) * 0.25
def clap():
    t = t_arr(0.35); n = bp(rng.standard_normal(len(t)), 900, 6000)
    e = np.exp(-t * 18) + 0.6 * np.exp(-np.maximum(t - 0.012, 0) * 60) * (t > 0.012)
    return verb(n * e * 0.6, 0.25)
def tom():
    t = t_arr(0.5); f = 70 + 80 * np.exp(-t * 20)
    return verb(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8) + lp(rng.standard_normal(len(t)), 2000) * np.exp(-t * 40) * 0.3, 0.3)

# ---------- harmony ----------
def pad(chord, d, cutoff=1400, gain=0.12):
    t = t_arr(d); s = np.zeros(len(t))
    for m in chord:
        for det in (-0.12, -0.04, 0.04, 0.12):
            s += saw(note(m) * 2 ** (det / 12), t + rng.uniform(0, 1))
    s = lp(s / (len(chord) * 4), cutoff, 2)
    a = min(1.2, d / 3); e = np.minimum(1, t / a) * np.minimum(1, (d - t) / min(1.0, d / 3))
    return s * e * gain
def bass(m, d, gain=0.32):
    t = t_arr(d); s = lp(saw(note(m), t), 380) + np.sin(2 * np.pi * note(m) * t) * 0.6
    return s * env(len(t), 0.005, d * 0.9) * gain
def arp(chord, start, end, rate=0.25, gain=0.08, cutoff=3500):
    k = 0; t0 = start
    while t0 < end:
        m = chord[k % len(chord)] + 12 * (k // len(chord) % 2)
        t = t_arr(rate * 0.9); s = lp(saw(note(m), t) + 0.5 * saw(note(m) * 1.005, t), cutoff) * env(len(t), 0.003, 0.12)
        place(s, t0, gain, pan=0.35 if k % 2 else -0.35); k += 1; t0 += rate

Am, F, C, G, Dm, E = [57, 60, 64], [53, 57, 60], [48, 55, 64], [55, 59, 62], [50, 57, 62], [52, 56, 59]
ROOT = {id(Am): 45, id(F): 41, id(C): 36, id(G): 43, id(Dm): 38, id(E): 40}

# Opening: drone, then pulse
place(pad([45, 52, 57], 22.0, cutoff=900, gain=0.10), 0.3)
place(riser(1.2), 0.25, 0.5)
for t0 in np.arange(2.6, 21.7, BEAT / 2):
    s = bass(33, BEAT / 2 * 0.9, 0.22); place(lp(s, 200 + 2200 * min(1, (t0 - 2.6) / 12)), t0)
place(pad(F, 5.0, 1600, 0.09), 6.3); place(pad(Dm, 3.3, 1700, 0.09), 8.7)
place(riser(0.65), 11.6, 0.55); place(glitch(1.2), 12.42, 0.9, pan=0.2)
place(pad(E, 2.0, 2200, 0.11), 12.45)
for i, w in enumerate([14.25, 14.5, 14.75, 15.0, 15.25, 15.55]): place(tom(), w, 0.55 + 0.05 * i, pan=(-0.2 + 0.08 * i))
place(riser(1.2), 14.7, 0.5)
place(whoosh(0.8), 15.85, 0.6)
place(pad([45, 52, 57, 60, 64], 6.5, 2600, 0.12), 17.8)  # logo bloom
arp([57, 60, 64, 67], 17.85, 21.6, 0.3125, 0.06)
# Impacts in the opening (film time)
for at, big in [(1.42, 1.2), (6.3, 0.8), (12.45, 1.0), (17.8, 1.3)]: place(impact(big), at, 0.75)
for at in [8.7, 13.9, 21.75]: place(whoosh(0.7), at, 0.55, pan=0.1)

# Act two groove from 22.2: Am F C G, two bars each
prog = [Am, F, C, G]
bar = 4 * BEAT
start = 22.2
sections = [(22.2, 43.3, 'groove'), (43.3, 50.3, 'tension'), (50.3, 74.0, 'lift')]
t0 = start; k = 0
while t0 < 74.0:
    ch = prog[k % 4] if t0 < 43.3 or t0 >= 50.3 else Dm
    d = min(2 * bar, 74.0 - t0)
    sec = 'groove' if t0 < 43.3 else 'tension' if t0 < 50.3 else 'lift'
    place(pad(ch if sec != 'lift' else [m + 12 for m in ch][:2] + ch, d, 1800 if sec == 'groove' else 2600, 0.085), t0)
    root = ROOT[id(ch)]
    for b in range(int(round(d / (BEAT / 2)))):
        place(bass(root if b % 4 != 3 else root + 7, BEAT / 2 * 0.85, 0.2 if sec != 'tension' else 0.12), t0 + b * BEAT / 2)
    if sec == 'lift': arp(ch, t0, t0 + d, BEAT / 4, 0.045, 4000)
    if sec == 'tension': arp([m + 12 for m in ch], t0, t0 + d, BEAT / 4, 0.03 + 0.02 * (t0 - 43.3) / 7, 2000 + 300 * (t0 - 43.3))
    t0 += 2 * bar; k += 1
# drums
t0 = start; beat = 0
while t0 < 73.8:
    sec = 'groove' if t0 < 43.3 else 'tension' if t0 < 50.3 else 'lift'
    if sec != 'tension' or beat % 4 == 0: place(kick(), t0, 0.55)
    if sec != 'tension' and beat % 2 == 1: place(clap(), t0, 0.32)
    if sec == 'groove': place(hat(), t0 + BEAT / 2, 0.5, pan=0.3)
    if sec == 'lift':
        for q in range(4): place(hat(q == 2), t0 + q * BEAT / 4, 0.42 if q % 2 else 0.28, pan=0.3)
    t0 += BEAT; beat += 1

# Act two sound design
for at in [22.2, 33.5, 43.3, 50.3, 58.4, 68.3]: place(whoosh(0.75), at - 0.1, 0.55, pan=-0.1)
for i in range(6): place(tick(), 23.0 + i * 0.15, 1.0, pan=0.1)
place(impact(0.6), 24.1, 0.5)
for at in [27.55, 28.2, 28.95]: place(blip(1100), at, 0.8)
for at in [36.05, 37.3, 38.8, 40.1]: place(stamp(), at, 0.85)
for at in [43.95]: place(tick(), at, 1.2)
place(riser(1.8), 45.8, 0.4)
place(glitch(1.0), 47.6, 0.9, pan=-0.2); place(impact(1.0), 47.6, 0.7)
for i in range(6): place(blip(900 + i * 80), 50.9 + i * 0.22, 0.35)
for at in [55.0, 55.95, 56.65]: place(blip(1400), at, 0.8)
for at in [59.35, 60.15, 61.3]: place(blip(1000), at, 0.7)
for x in np.arange(62.55, 63.4, 0.035): place(tick(), x, 0.7, pan=0.15)
place(impact(0.7), 63.45, 0.55)
for at in [65.2, 65.9, 66.6]: place(stamp(), at, 0.6)
for i in range(4): place(blip(1300), 69.2 + i * 0.2, 0.5)
place(riser(1.3), 72.7, 0.45)
# Outro
place(riser(1.1), 74.1, 0.6)
place(impact(1.4), 75.2, 0.85)
place(pad([45, 52, 57, 60, 64, 69], 7.6, 2400, 0.13), 75.2)
arp([57, 60, 64, 69], 75.3, 81.5, 0.3125, 0.05)
for i in range(23): place(tick(), 78.6 + i * 0.048, 0.6)

# ---------- duck music under the voice ----------
spans = json.load(open(sys.argv[1]))
duck = np.ones(N)
for _, a, b in spans:
    i, j = int((a - 0.12) * SR), int((b + 0.2) * SR); duck[max(0, i):j] = 0.5
k = int(0.12 * SR); duck = np.convolve(duck, np.ones(k) / k, mode='same')
L *= duck; R *= duck
# fade out at the end
fo = np.ones(N); fs = int(82.0 * SR); fo[fs:] = np.linspace(1, 0, N - fs); L *= fo; R *= fo
mix = np.stack([L, R], axis=1)
mix = np.tanh(mix / max(1e-6, np.abs(mix).max()) * 1.4) * 0.8
sf.write(sys.argv[2], mix.astype(np.float32), SR)
print('score written', sys.argv[2], f'{N / SR:.1f}s')
