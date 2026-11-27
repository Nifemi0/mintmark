# Music + sound design -> final_mix.wav
import numpy as np
from scipy.io import wavfile
sr, m = wavfile.read('score.wav'); _, s = wavfile.read('sfx.wav')
m = m.astype(float) / 32767; s = s.astype(float) / 32767
rms = lambda x: np.sqrt(np.mean(x ** 2))
s *= 0.3 * rms(m) / rms(s)          # sound design sits just under the music by RMS; transients cut through
# duck the music slightly while effects are dense
env = np.abs(s).mean(1)
k = int(0.03 * sr); env = np.convolve(env, np.ones(k) / k, mode='same')
duck = 1 - 0.25 * np.clip(env / (np.percentile(env, 99) + 1e-9), 0, 1)
mix = m * 0.85 + s   # no ducking: the music stays steady
mix = np.tanh(mix * 1.1); mix *= 0.9 / np.max(np.abs(mix))
wavfile.write('final_mix.wav', sr, (mix * 32767).astype(np.int16))
print('ok')
