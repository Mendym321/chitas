"""The app preview video, part 2: its music, original and composed here (so it
is ours to use anywhere). Warm and quietly uplifting: a soft pad, a plucked
pattern, a low bass, a light beat that comes in after the opening, a bell
melody in the second half, a swell into the last bar, and a ringing final chord.

One bar per scene (timing.json): 68.57 beats a minute, so every cut in the video
lands on a downbeat. D major: D, A/C#, Bm, G, D, A, Em7, D.

Usage (from tools/):  python3 store/video/music.py   -> store/video/music.wav
Needs only numpy.
"""
import json, wave
from pathlib import Path
import numpy as np

HERE = Path(__file__).parent
T = json.loads((HERE / 'timing.json').read_text())
SR = 44100
BEAT = 60 / T['bpm']                      # 0.875 s
BAR = 4 * BEAT                            # 3.5 s, one scene
BARS = sum(s['beats'] for s in T['scenes']) // 4      # 8
LENGTH = BARS * BAR                       # 28 s, the video's length
N = int((LENGTH + 0.05) * SR)
rng = np.random.default_rng(5787)

def hz(note):
    """'D4' -> frequency (A4 = 440)."""
    names = {'C': -9, 'C#': -8, 'D': -7, 'D#': -6, 'E': -5, 'F': -4, 'F#': -3, 'G': -2, 'G#': -1, 'A': 0, 'A#': 1, 'B': 2}
    name, octave = note[:-1], int(note[-1])
    return 440.0 * 2 ** ((names[name] + 12 * (octave - 4)) / 12)

L = np.zeros(N); R = np.zeros(N)
def add(sig, start, gain=1.0, pan=0.0):
    """Mix a mono signal in at `start` seconds, panned -1 (left) .. 1 (right)."""
    i = int(start * SR)
    if i >= N: return
    sig = sig[: N - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(sig)] += sig * gain * l * 1.41
    R[i:i + len(sig)] += sig * gain * r * 1.41

def env(n, a, d, sustain=1.0, release=None):
    """A plain attack / decay envelope over n samples (seconds)."""
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * (sustain + (1 - sustain) * np.exp(-t / max(d, 1e-4)))
    if release:
        r = int(release * SR)
        e[-r:] *= np.linspace(1, 0, r) ** 2
    return e

def lowpass(x, cutoff):
    """Smooth low-pass, done in the frequency domain (no scipy)."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (f / cutoff) ** 4)
    return np.fft.irfft(X, len(x))

# ── Pad: three detuned saws per note, darkened, slow to swell ────────────────
def pad(notes, dur, bright=1400):
    n = int(dur * SR); t = np.arange(n) / SR; out = np.zeros(n)
    for note in notes:
        f = hz(note)
        for det in (-0.12, 0.0, 0.13):
            ph = rng.random()
            out += 2 * ((f * (1 + det / 100) * t + ph) % 1) - 1
    out = lowpass(out / (3 * len(notes)), bright)
    return out * env(n, 0.9, 1.0, 1.0, release=0.6)

# ── Pluck: Karplus-Strong string ──────────────────────────────────────────────
def pluck(note, dur=1.6, damp=0.996, bright=0.55):
    n = int(dur * SR); p = int(round(SR / hz(note)))
    buf = rng.uniform(-1, 1, p)
    buf = lowpass(np.concatenate([buf, np.zeros(p)]), 5000)[:p]       # a softer attack
    out = np.empty(n); out[:p] = buf
    i = p
    while i < n:                                                       # one period at a time
        seg = out[i - p:i]
        nxt = damp * (bright * seg + (1 - bright) * np.roll(seg, 1))
        k = min(p, n - i); out[i:i + k] = nxt[:k]; i += k
    return out * env(n, 0.002, 0.6, 0.35, release=0.25)

# ── Bell: a few inharmonic partials, ringing ──────────────────────────────────
def bell(note, dur=2.6):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(note)
    parts = [(1, 1.0, 1.6), (2.0, 0.45, 0.9), (3.01, 0.22, 0.5), (4.2, 0.12, 0.35), (5.43, 0.06, 0.25)]
    out = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t / d) for m, a, d in parts)
    return out * np.minimum(1, t / 0.004)

# ── Bass, kick, shaker, swell, impact ─────────────────────────────────────────
def bass(note, dur):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(note)
    x = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t) + 0.08 * (2 * ((f * t) % 1) - 1)
    return lowpass(x, 600) * env(n, 0.01, 0.5, 0.6, release=0.15)

def kick(dur=0.45):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 46 + 110 * np.exp(-t / 0.035)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)

def shaker(dur=0.09):
    n = int(dur * SR); x = rng.uniform(-1, 1, n)
    x = x - lowpass(x, 6500)                                           # only the top
    return x * np.exp(-np.arange(n) / SR / 0.025)

def swell(dur):
    n = int(dur * SR); t = np.arange(n) / SR
    x = rng.uniform(-1, 1, n)
    x = lowpass(x, 3000) * (t / dur) ** 2.4
    return x

def impact(dur=3.0):
    n = int(dur * SR); t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * (40 + 30 * np.exp(-t / 0.08)) * t) * np.exp(-t / 0.7)
    air = lowpass(rng.uniform(-1, 1, n), 9000) * np.exp(-t / 0.9) * 0.35
    return boom + air

# ── The arrangement ───────────────────────────────────────────────────────────
CHORDS = [
    ('D2', ['D3', 'F#3', 'A3', 'D4'], ['D4', 'F#4', 'A4', 'D5', 'A4', 'F#4']),
    ('C#2', ['C#3', 'E3', 'A3', 'E4'], ['C#4', 'E4', 'A4', 'C#5', 'A4', 'E4']),
    ('B1', ['B2', 'D3', 'F#3', 'D4'], ['B3', 'D4', 'F#4', 'B4', 'F#4', 'D4']),
    ('G1', ['G2', 'B2', 'D3', 'B3'], ['G3', 'B3', 'D4', 'G4', 'D4', 'B3']),
    ('D2', ['D3', 'F#3', 'A3', 'D4'], ['D4', 'F#4', 'A4', 'D5', 'A4', 'F#4']),
    ('A1', ['A2', 'C#3', 'E3', 'C#4'], ['A3', 'C#4', 'E4', 'A4', 'E4', 'C#4']),
    ('E2', ['E3', 'G3', 'B3', 'D4'], ['E4', 'G4', 'B4', 'D5', 'B4', 'G4']),
    ('D2', ['D3', 'F#3', 'A3', 'D4', 'F#4'], ['D4', 'F#4', 'A4', 'D5', 'F#5', 'A5']),
]
MELODY = {  # bar: [(beat, note)]
    4: [(0, 'F#5'), (1.5, 'E5'), (2, 'D5'), (3, 'A5')],
    5: [(0, 'E5'), (1.5, 'C#5'), (2, 'A4'), (3, 'C#5')],
    6: [(0, 'D5'), (1, 'E5'), (2, 'G5'), (3, 'F#5')],
    7: [(0, 'A5'), (0.5, 'D6')],
}
SIXTEENTH = BEAT / 4

for b, (root, chord, arp) in enumerate(CHORDS):
    t0 = b * BAR
    last = b == BARS - 1
    add(pad(chord, BAR + (2.2 if last else 0.9), bright=1100 + 160 * b), t0, 0.5 if not last else 0.5)
    # The plucked pattern: eighths in the opening bar, sixteenths after
    step = 2 if b == 0 else 1
    for k in range(0, 16, step):
        if last and k >= 4: break                                      # the last bar rings instead
        note = arp[k % len(arp)]
        add(pluck(note), t0 + k * SIXTEENTH, (0.46 if b < 4 else 0.36) + 0.06 * (k % 4 == 0), pan=(-0.35 if k % 2 else 0.35))
    if b >= 1:                                                         # bass from the second bar
        add(bass(root, BEAT * 2.4), t0, 0.08)
        if not last: add(bass(root, BEAT * 1.3), t0 + 2.5 * BEAT, 0.05)
    if 2 <= b < BARS - 1:                                              # the beat from the third bar
        for beat in ((0, 2) if b < 6 else (0, 1, 2, 3)):
            add(kick(), t0 + beat * BEAT, 0.16)
    if 3 <= b < BARS - 1:
        for k in range(8):
            add(shaker(), t0 + (k + 0.5) * BEAT / 2, 0.07 + 0.03 * (k % 2), pan=0.4)
    for beat, note in MELODY.get(b, []):
        add(bell(note), t0 + beat * BEAT, 0.15, pan=-0.15)
    if b == BARS - 2:                                                  # swell into the last bar
        add(swell(BAR), t0, 0.18)
    if last:
        add(impact(), t0, 0.22)
        add(bell('D6', 3.0), t0, 0.12, pan=0.2); add(bell('A5', 3.0), t0 + BEAT / 2, 0.08, pan=-0.2)

# ── Room: a soft hall (a decaying noise tail, convolved) ─────────────────────
def reverb(x, seconds=2.4, seed=1):
    g = np.random.default_rng(seed); n = int(seconds * SR); t = np.arange(n) / SR
    ir = g.standard_normal(n) * np.exp(-t / (seconds / 6.9)); ir = lowpass(ir, 5000); ir /= np.sqrt((ir ** 2).sum())
    m = len(x) + n
    y = np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[:len(x)]
    return y
wet = 0.32
L2 = L + wet * reverb(L, seed=1); R2 = R + wet * reverb(R, seed=2)

# ── Finish: gentle glue, a fade at the very end, -1 dB peak ──────────────────
def highpass(x, cutoff):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= (f / cutoff) ** 2 / np.sqrt(1 + (f / cutoff) ** 4)
    return np.fft.irfft(X, len(x))
mix = np.stack([highpass(L2, 38), highpass(R2, 38)], 1)          # no rumble below the bass
mix /= np.abs(mix).max()
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
fade = int(1.4 * SR); mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 1.5
mix[: int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))[:, None]
# Loudness about -14 LUFS (streaming level): a simple K-weighting stand-in (a
# high-shelf lift above 1.5 kHz, low cut at 100 Hz) for the measure; the peak
# never above -1 dBFS
def loudness(m):
    k = np.stack([highpass(m[:, c], 100) for c in range(2)], 1)
    X = np.fft.rfft(k, axis=0); f = np.fft.rfftfreq(len(k), 1 / SR)
    X *= (1 + 0.58 * (f > 1500))[:, None]; k = np.fft.irfft(X, len(k), axis=0)
    return -0.691 + 10 * np.log10(np.mean(k ** 2) * 2 + 1e-12)
mix *= 10 ** ((-14 - loudness(mix)) / 20)
peak = np.abs(mix).max()
if peak > 10 ** (-1 / 20): mix *= 10 ** (-1 / 20) / peak
pcm = (mix * 32767).astype('<i2')
with wave.open(str(HERE / 'music.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print(f'music.wav: {len(pcm) / SR:.2f} s, {BARS} bars of {BAR:.2f} s')
