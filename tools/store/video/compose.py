"""The app preview video, part 3: edited together.

Takes the filmed scenes (capture.mjs) and the music (music.py), and makes:
  out/chitas-app-preview.mp4         886 x 1920, for the App Store (the app's screen
                                     with a headline above it; no phone frame, which
                                     Apple rejects in previews)
  out/chitas-promo.mp4               1920 x 1080, for Google Play (a YouTube link):
                                     the screen in a phone, the words beside it
  out/chitas-coming-soon-vertical.mp4  the same two, ending on "Coming soon to the
  out/chitas-coming-soon-wide.mp4      App Store" and the website's address, to share
Each cut is on a downbeat: a scene is one bar or more (timing.json).

Usage (from tools/):  python3 store/video/compose.py [preview|promo|soon-vertical|soon-wide ...]
Needs numpy, Pillow and ffmpeg.
"""
import json, math, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).parent
T = json.loads((HERE / 'timing.json').read_text())
FPS, BAR, OVER = T['fps'], T['bar_frames'], T['overlap']
SCENES = T['scenes']
LEN = [s.get('bars', 1) * BAR for s in SCENES]             # each scene's length in frames
STARTS = [sum(LEN[:i]) for i in range(len(SCENES))]
TOTAL = sum(LEN)
SITE = 'chitas.vercel.app'
ENDING = 'store'                                    # 'store', or 'soon': coming soon, with the address
DISSOLVE = 10                                     # frames
OUT = HERE / 'out'; OUT.mkdir(exist_ok=True)

COLORS = {'cream': ((243, 235, 219), (31, 27, 22)), 'gold': ((224, 160, 48), (46, 30, 0)), 'purple': ((139, 84, 176), (255, 255, 255)),
          'blue': ((63, 111, 192), (255, 255, 255)), 'ink': ((31, 27, 22), (251, 247, 239)), 'green': ((94, 138, 60), (255, 255, 255))}
RINGS = [(224, 160, 48), (78, 122, 203), (149, 96, 186), (101, 148, 68)]
font = lambda w, size: ImageFont.truetype(str(HERE / 'fonts' / f'Bricolage-{w}.woff'), size)

def ease_out(t): t = min(1, max(0, t)); return 1 - (1 - t) ** 3
def ease_io(t): t = min(1, max(0, t)); return 3 * t * t - 2 * t * t * t
def mix(a, b, t): return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

_cache, _count, _where = {}, {}, {}
def filmed(scene, f, w, h):
    """A filmed frame of a scene, sized (cached per size)."""
    if scene not in _count: _count[scene] = len(list((HERE / 'frames' / scene).glob('*.jpg')))
    f = max(0, min(_count[scene] - 1, f))
    key = (scene, f, w, h)
    if key not in _cache:
        if len(_cache) > 64: _cache.clear()
        _cache[key] = Image.open(HERE / 'frames' / scene / f'{f:04d}.jpg').convert('RGB').resize((w, h), Image.LANCZOS)
    return _cache[key]

def screen(sc, f, w, h):
    """What the screen shows: the filmed frame (eased where the app changes at once),
    with the place marked, a small label, and a touch where something is tapped."""
    sec = f / FPS; s = w / 443                       # pixels per point of the app
    img = filmed(sc['id'], f, w, h)
    for c in sc.get('soft', []):                     # closing or opening: eased over 6 frames, not a jump
        fc = round(c * FPS)
        if fc <= f < fc + 6: img = Image.blend(filmed(sc['id'], fc - 1, w, h), img, ease_io((f - fc + 1) / 7))
    bg, fg = COLORS[sc['color']]
    over = None
    for a, b, y, label in sc.get('mark', []):        # the line you stopped on
        k = min(ease_out((sec - a) / 0.25), 1 - ease_io((sec - (b - 0.15)) / 0.15)) if a <= sec <= b else 0
        if k <= 0: continue
        over = over or Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(over)
        yy, hh = y * s, 30 * s
        d.rounded_rectangle((6 * s, yy - hh / 2, w - 6 * s, yy + hh / 2), 6 * s, fill=bg + (round(70 * k),))
        d.rounded_rectangle((6 * s, yy - hh / 2, 9 * s, yy + hh / 2), 1.5 * s, fill=bg + (round(255 * k),))
        fl = font(800, round(12.5 * s)); tw = d.textlength(label, font=fl); px, py = 6 * s, yy - hh / 2 - 27 * s
        d.rounded_rectangle((px, py, px + tw + 20 * s, py + 23 * s), 11.5 * s, fill=bg + (round(255 * k),))
        d.text((px + 10 * s, py + 4 * s), label, font=fl, fill=fg + (round(255 * k),))
    if sc.get('chip'):                               # time passing, said once and small
        a, b, label = sc['chip']
        k = min(ease_out((sec - a) / 0.3), 1 - ease_io((sec - (b - 0.25)) / 0.25)) if a <= sec <= b else 0
        if k > 0:
            over = over or Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(over)
            fl = font(800, round(17 * s)); tw = d.textlength(label, font=fl)
            cy = h * 0.55 + (1 - k) * 8 * s; ph, pw = 40 * s, tw + 40 * s
            d.rounded_rectangle((w / 2 - pw / 2, cy - ph / 2, w / 2 + pw / 2, cy + ph / 2), ph / 2, fill=(31, 27, 22, round(232 * k)))
            d.text((w / 2 - tw / 2, cy - fl.size * 0.62), label, font=fl, fill=(251, 247, 239, round(255 * k)))
    for t0, name in sc.get('tap', []):                # a touch: a soft circle that presses in and lifts
        u = (sec - t0) / 0.45
        if not 0 <= u <= 1: continue
        if sc['id'] not in _where: _where[sc['id']] = json.loads((HERE / 'frames' / sc['id'] / 'where.json').read_text())
        x, y = _where[sc['id']][name]; e = math.sin(math.pi * u); r = 24 * s * (1 - 0.18 * e)
        over = over or Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(over)
        d.ellipse((x * s - r, y * s - r, x * s + r, y * s + r), fill=(70, 70, 70, round(95 * e)), outline=(255, 255, 255, round(170 * e)), width=max(1, round(r * 0.08)))
    if over: img = Image.alpha_composite(img.convert('RGBA'), over).convert('RGB')
    return img

def rounded_mask(w, h, r, top_only=False):
    m = Image.new('L', (w, h), 0); d = ImageDraw.Draw(m)
    d.rounded_rectangle((0, 0, w - 1, h - 1 + (r if top_only else 0)), r, fill=255)
    return m

def shadow(w, h, r, blur, alpha, pad):
    s = Image.new('L', (w + 2 * pad, h + 2 * pad), 0)
    ImageDraw.Draw(s).rounded_rectangle((pad, pad, pad + w, pad + h), r, fill=alpha)
    return s.filter(ImageFilter.GaussianBlur(blur))

def text_block(draw, lines, fnt, color, cx, cy, align='center', lh=1.08, alpha=1.0, base=None):
    """Lines of text centred on (cx, cy), or starting at cx when align is left."""
    size = fnt.size; heights = len(lines) * size * lh
    y = cy - heights / 2
    for line in lines:
        tw = draw.textlength(line, font=fnt)
        x = cx - tw / 2 if align == 'center' else cx
        c = color if alpha >= 1 else mix(base, color, alpha)
        draw.text((x, y), line, font=fnt, fill=c)
        y += size * lh

def fit(d, lines, size, width):
    """The headline's font: as large as the design asks, but never wider than the room it has."""
    while size > 30 and max(d.textlength(l, font=font(800, size)) for l in lines) > width: size -= 2
    return font(800, size)

def end_card(img, t, layout, s=1):
    """The last scene: the four rings draw in, then the name and the line (s: drawing scale)."""
    W, H = img.size; d = ImageDraw.Draw(img)
    cx = W / 2; cy = H * (0.40 if layout == 'portrait' else 0.38)
    R = (180 if layout == 'portrait' else 150) * s; stroke = R * 0.16
    for i, col in enumerate(RINGS):
        r = R - i * stroke * 1.25
        p = ease_io((t - 0.10 - i * 0.12) / 0.55)
        if p <= 0: continue
        box = (cx - r, cy - r, cx + r, cy + r)
        d.arc(box, -90, -90 + 360 * p, fill=col, width=int(stroke))
    a = ease_out((t - 0.75) / 0.5)
    if a > 0:
        ink, cream = COLORS['ink'][0], (251, 247, 239)
        y0 = cy + R + ((110 if layout == 'portrait' else 80) + (1 - a) * 20) * s
        f1 = font(800, (120 if layout == 'portrait' else 104) * s)
        tw = d.textlength('Chitas', font=f1); d.text((cx - tw / 2, y0 - f1.size / 2), 'Chitas', font=f1, fill=mix(ink, cream, a))
        f2 = font(600, (44 if layout == 'portrait' else 38) * s)
        line = 'Chumash · Tehillim · Tanya · Rambam'
        tw = d.textlength(line, font=f2); d.text((cx - tw / 2, y0 + f1.size * 0.7), line, font=f2, fill=mix(ink, (216, 206, 188), a))
    b = ease_out((t - 1.35) / 0.5)
    if b > 0 and ENDING == 'soon':                    # coming soon, and where to use it now
        ink = COLORS['ink'][0]
        y = cy + R + ((110 if layout == 'portrait' else 80) + 120 * 0.7 + (92 if layout == 'portrait' else 76)) * s
        f3 = font(800, (40 if layout == 'portrait' else 34) * s); line = 'Coming soon to the App Store'
        tw = d.textlength(line, font=f3); d.text((cx - tw / 2, y + (1 - b) * 12 * s), line, font=f3, fill=mix(ink, (224, 160, 48), b))
        c = ease_out((t - 1.75) / 0.5)
        if c > 0:
            f4 = font(600, (36 if layout == 'portrait' else 30) * s); tw = d.textlength(SITE, font=f4)
            py = y + f3.size * 1.55; padx, pady = 26 * s, 14 * s
            d.rounded_rectangle((cx - tw / 2 - padx, py, cx + tw / 2 + padx, py + f4.size + 2 * pady), (f4.size + 2 * pady) / 2,
                                fill=mix(ink, (251, 247, 239), c))
            d.text((cx - tw / 2, py + pady - 2 * s), SITE, font=f4, fill=ink)

def end_frame(t, layout, size, bg):
    """The end card drawn at twice the size and shrunk: smooth curves and letters."""
    big = Image.new('RGB', (size[0] * 2, size[1] * 2), bg)
    end_card(big, t, layout, 2)
    return big.resize(size, Image.LANCZOS)

def scene_at(frame):
    i = max(j for j in range(len(SCENES)) if STARTS[j] <= frame); return i, frame - STARTS[i]

# ── Portrait: 886 x 1920 for the App Store ────────────────────────────────────
PW, PH = 886, 1920
SW = 736; SH = round(SW * 1920 / 886); SX = (PW - SW) // 2; SY = PH - SH        # the screen, to the bottom edge
P_MASK = rounded_mask(SW, SH, 44, top_only=True)
P_SHADOW = shadow(SW, SH, 44, 28, 70, 60)

def portrait(frame):
    i, f = scene_at(frame); sc = SCENES[i]
    prev = SCENES[i - 1] if i > 0 and f < DISSOLVE else None
    k = ease_io(f / DISSOLVE) if prev else 1.0
    bg, fg = COLORS[sc['color']]
    if prev: bg = mix(COLORS[prev['color']][0], bg, k)
    if sc['id'] == 'end':
        img = end_frame(f / FPS, 'portrait', (PW, PH), bg)
        if prev: img = Image.blend(layer_portrait(prev, LEN[i - 1] + f, COLORS[prev['color']][0]), img, k)   # the last screen fades out
        return img
    layer = layer_portrait(sc, f, bg)
    if prev:
        old = layer_portrait(prev, LEN[i - 1] + f, bg)
        img = Image.blend(old, layer, k)
    else:
        img = layer
    # The headline: rises and fades in at the cut
    d = ImageDraw.Draw(img); a = 1.0 if i == 0 else ease_out((f - 2) / 14)   # the first frame already has its headline (the still Apple shows)
    lines = sc['head'].split('\n'); fnt = fit(d, lines, 66, PW - 90)
    text_block(d, lines, fnt, fg, PW / 2, SY / 2 + (1 - a) * 26, alpha=a, base=bg)
    return img

def layer_portrait(sc, f, bg):
    img = Image.new('RGB', (PW, PH), bg)
    img.paste((0, 0, 0), (SX - 60, SY - 60), Image.composite(P_SHADOW, Image.new('L', P_SHADOW.size, 0), P_SHADOW).point(lambda v: v * 0.6))
    img.paste(screen(sc, f, SW, SH), (SX, SY), P_MASK)
    return img

# ── Landscape: 1920 x 1080 for Google Play / YouTube ─────────────────────────
LW, LH = 1920, 1080
LSH = 930; LSW = round(LSH * 886 / 1920); BEZ = 14
LX = 1400 - (LSW + 2 * BEZ) // 2; LY = (LH - LSH - 2 * BEZ) // 2
L_MASK = rounded_mask(LSW, LSH, 46)
L_BODY = rounded_mask(LSW + 2 * BEZ, LSH + 2 * BEZ, 46 + BEZ)
L_SHADOW = shadow(LSW + 2 * BEZ, LSH + 2 * BEZ, 60, 30, 90, 70)
L_RIM = rounded_mask(LSW + 2 * BEZ + 4, LSH + 2 * BEZ + 4, 48 + BEZ)

def brand_icon(size=52):
    """The four rings, small, drawn at 4x and shrunk (smooth)."""
    big = Image.new('RGBA', (size * 4, size * 4), (0, 0, 0, 0)); d = ImageDraw.Draw(big)
    for j, col in enumerate(RINGS):
        r = size * 2 - 4 - j * size * 0.42; c = size * 2
        d.ellipse((c - r, c - r, c + r, c + r), outline=col + (255,), width=int(size * 0.3))
    return big.resize((size, size), Image.LANCZOS)
BRAND = brand_icon()

def layer_landscape(sc, f, bg):
    img = Image.new('RGB', (LW, LH), bg)
    img.paste((0, 0, 0), (LX - 70, LY - 50), L_SHADOW.point(lambda v: v * 0.6))
    img.paste((58, 56, 54), (LX - 2, LY - 2), L_RIM)                    # a faint rim, so the phone shows on dark colours too
    img.paste((17, 17, 17), (LX, LY), L_BODY)
    img.paste(screen(sc, f, LSW, LSH), (LX + BEZ, LY + BEZ), L_MASK)
    return img

def landscape(frame):
    i, f = scene_at(frame); sc = SCENES[i]
    prev = SCENES[i - 1] if i > 0 and f < DISSOLVE else None
    k = ease_io(f / DISSOLVE) if prev else 1.0
    bg, fg = COLORS[sc['color']]
    if prev: bg = mix(COLORS[prev['color']][0], bg, k)
    if sc['id'] == 'end':
        img = end_frame(f / FPS, 'landscape', (LW, LH), bg)
        if prev: img = Image.blend(layer_landscape(prev, LEN[i - 1] + f, COLORS[prev['color']][0]), img, k)
        return img
    layer = layer_landscape(sc, f, bg)
    img = Image.blend(layer_landscape(prev, LEN[i - 1] + f, bg), layer, k) if prev else layer
    d = ImageDraw.Draw(img); a = 1.0 if i == 0 else ease_out((f - 2) / 14)
    # The name, small, with its rings, and the headline beside the phone
    cx0, cy0 = 160, 150
    img.paste(BRAND, (cx0 - 26, cy0 - 26), BRAND)
    d.text((cx0 + 40, cy0 - 24), 'Chitas', font=font(800, 40), fill=fg)
    text_block(d, sc['head'].split('\n'), fit(d, sc['head'].split('\n'), 86, LX - 150 - 70), fg, 150, LH / 2 + (1 - a) * 26, align='left', alpha=a, base=bg)
    return img

KINDS = {'preview': (PW, PH, 'portrait', 'store', 'chitas-app-preview.mp4'), 'promo': (LW, LH, 'landscape', 'store', 'chitas-promo.mp4'),
         'soon-vertical': (PW, PH, 'portrait', 'soon', 'chitas-coming-soon-vertical.mp4'), 'soon-wide': (LW, LH, 'landscape', 'soon', 'chitas-coming-soon-wide.mp4')}
def render(kind):
    global ENDING
    W, H, layout, ENDING, name = KINDS[kind]
    fn = portrait if layout == 'portrait' else landscape
    out = OUT / name
    ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                           '-i', str(HERE / 'music.wav'),
                           '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', str(FPS),
                           '-c:a', 'aac', '-b:a', '256k', '-ar', '44100', '-ac', '2', '-shortest', '-movflags', '+faststart', str(out)],
                          stdin=subprocess.PIPE)
    for frame in range(TOTAL):
        ff.stdin.write(fn(frame).tobytes())
        if frame % 120 == 0: print(f'  {kind} {frame}/{TOTAL}', flush=True)
    ff.stdin.close(); ff.wait()
    print('wrote', out.name)

if __name__ == '__main__':
    if sys.argv[1:2] == ['still']:                  # single frames to look at: compose.py still preview 0 120 ...
        global_kind = sys.argv[2]; ENDING = KINDS[global_kind][3]
        fn = portrait if KINDS[global_kind][2] == 'portrait' else landscape
        for n in sys.argv[3:]: fn(int(n)).save(OUT / f'still-{global_kind}-{n}.png')
    else:
        for kind in (sys.argv[1:] or list(KINDS)): render(kind)
