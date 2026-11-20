# Builds captions.ass from the voice-over lines and their timing.
import json, re
spans = {k: (a, b) for k, a, b in json.load(open('audio/vo_spans.json'))}
lines = dict(json.load(open('captions-text.json')))
TOP = {'l01', 'l13'}  # on-screen text sits at the bottom during these lines
def chunks(text, n=44):
    parts = re.split(r'(?<=[.?!,])\s+', text)
    out, cur = [], ''
    for p in parts:
        if cur and len(cur) + 1 + len(p) > n: out.append(cur); cur = p
        else: cur = (cur + ' ' + p).strip()
    if cur: out.append(cur)
    return out
def ts(t): h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60; return f"{h}:{m:02d}:{s:05.2f}"
ev = []
for k, (a, b) in sorted(spans.items(), key=lambda x: x[1][0]):
    cs = chunks(lines[k]); total = sum(len(c) for c in cs); t = a
    for c in cs:
        d = (b - a) * len(c) / total
        ev.append(f"Dialogue: 0,{ts(t)},{ts(min(t + d + 0.15, b + 0.25))},{'Top' if k in TOP else 'Cap'},,0,0,0,,{c}")
        t += d
head = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Inter Display,44,&H00F2F6F2,&H00F2F6F2,&H64000000,&H64000000,0,0,0,0,100,100,0,0,3,14,0,2,80,80,44,1
Style: Top,Inter Display,44,&H00F2F6F2,&H00F2F6F2,&H64000000,&H64000000,0,0,0,0,100,100,0,0,3,14,0,8,80,80,36,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
# A caption ends before the next one starts.
def secs(x): h, m, sec = x.split(':'); return int(h) * 3600 + int(m) * 60 + float(sec)
fixed = []
for i, e in enumerate(ev):
    parts = e.split(',', 9)
    if i + 1 < len(ev):
        nxt = secs(ev[i + 1].split(',', 9)[1])
        if secs(parts[2]) > nxt - 0.02: parts[2] = ts(nxt - 0.02)
    fixed.append(','.join(parts))
ev = fixed
open('captions.ass', 'w').write(head + '\n'.join(ev) + '\n')
print(len(ev), 'caption events')
