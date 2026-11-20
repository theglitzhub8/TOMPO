"""Renders Tempo's brand images: the app icon ("The Spark"), the transparent
mark, the favicon and the horizontal logo. Run from anywhere:

    python3 apps/mobile/assets/brand/render_brand.py

Needs Pillow and NumPy. Uses the fonts bundled with the app."""
import math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
FONTS = str(HERE.parent / "fonts") + "/"
DEST = str(HERE) + "/"
S = 4096  # working size; exported at 1024


def lerp(a, b, t): return a + (b - a) * t
def hexrgb(h): return np.array([int(h[i:i+2], 16) for i in (1, 3, 5)], float)

def linear(size, c1, c2, angle_deg):
    h = w = size
    yy, xx = np.mgrid[0:h, 0:w] / size
    a = math.radians(angle_deg)
    t = np.clip((xx - 0.5) * math.cos(a) + (yy - 0.5) * math.sin(a) + 0.5, 0, 1)[..., None]
    return lerp(hexrgb(c1), hexrgb(c2), t)

def radial(size, cx, cy, r, stops):
    yy, xx = np.mgrid[0:size, 0:size].astype(float)
    d = np.clip(np.hypot(xx - cx, yy - cy) / r, 0, 1)
    out = np.zeros((size, size, 3))
    for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
        m = (d >= p0) & (d <= p1)
        t = ((d - p0) / (p1 - p0))[..., None]
        out = np.where(m[..., None], lerp(hexrgb(c0), hexrgb(c1), t), out)
    return out

def mask(draw_fn):
    m = Image.new("L", (S, S), 0)
    draw_fn(ImageDraw.Draw(m))
    return np.asarray(m, float)[..., None] / 255

def comp(base, color, m): return base * (1 - m) + color * m

def glow(m, radius, strength):
    img = Image.fromarray((m[..., 0] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(img, float)[..., None] / 255 * strength

def save(arr, name, alpha=None):
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    img = Image.fromarray(arr)
    if alpha is not None:
        img.putalpha(Image.fromarray(np.clip(alpha[..., 0] * 255, 0, 255).astype(np.uint8)))
    img.resize((1024, 1024), Image.LANCZOS).save(f"{OUT}/{name}.png")


# C — The Spark: bright electric gradient, white t, green sun. Bold and loud on a home screen.
def spark(bg, transparent=False):
    bright = linear(S, "#3A63FF", "#7B4DFF", 55)
    highlight = radial(S, S * 0.2, S * 0.1, S * 0.9, [(0, "#6F8CFF"), (1, "#2B57FF")])
    base = comp(bright, highlight, np.full((S, S, 1), 0.35))
    font = ImageFont.truetype(FONTS + "PlusJakartaSans_800ExtraBold.ttf", int(S * 0.66))
    c = S / 2
    t = mask(lambda d: d.text((c - S * 0.035, c + S * 0.04), "t", font=font, fill=255, anchor="mm"))
    out = comp(base, hexrgb("#1A1F7A"), glow(t, S * 0.025, 0.35))
    out = comp(out, hexrgb("#FFFFFF"), t)
    sr = S * 0.085; sx, sy = S * 0.69, S * 0.27
    sun = mask(lambda d: d.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=255))
    out = comp(out, radial(S, sx - sr * 0.4, sy - sr * 0.4, sr * 1.7, [(0, "#F0FFF8"), (0.45, "#5BE0AB"), (1, "#0E9F6E")]), sun)
    return out, np.maximum(t, sun)


icon, _ = spark(None)
img = Image.fromarray(np.clip(icon, 0, 255).astype(np.uint8))
img.resize((1024, 1024), Image.LANCZOS).save(DEST + "tempo-app-icon.png")
img.resize((1024, 1024), Image.LANCZOS).save(DEST + "tempo-app-icon-1024.png")
img.resize((256, 256), Image.LANCZOS).save(DEST + "tempo-favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

# The mark: white t and green sun on transparency, inside Android's safe zone.
font = ImageFont.truetype(FONTS + "PlusJakartaSans_800ExtraBold.ttf", int(S * 0.46))
c = S / 2
t = mask(lambda d: d.text((c - S * 0.025, c + S * 0.03), "t", font=font, fill=255, anchor="mm"))
sr = S * 0.06; sx, sy = S * 0.63, S * 0.335
sun = mask(lambda d: d.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=255))
sun_col = radial(S, sx - sr * 0.4, sy - sr * 0.4, sr * 1.7, [(0, "#F0FFF8"), (0.45, "#5BE0AB"), (1, "#0E9F6E")])
rgb = comp(np.full((S, S, 3), 255.0), sun_col, sun)
alpha = np.maximum(t, sun)
m = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))
m.putalpha(Image.fromarray((alpha[..., 0] * 255).astype(np.uint8)))
m.resize((1024, 1024), Image.LANCZOS).save(DEST + "tempo-mark.png")

# The horizontal logo: icon and lowercase wordmark on a light background.
W, H = 2172, 724
logo = Image.new("RGB", (W, H), (242, 244, 250))
small = img.resize((440, 440), Image.LANCZOS)
rm = Image.new("L", (440, 440), 0); ImageDraw.Draw(rm).rounded_rectangle([0, 0, 439, 439], radius=100, fill=255)
logo.paste(small, (150, (H - 440) // 2), rm)
word = ImageFont.truetype(FONTS + "PlusJakartaSans_800ExtraBold.ttf", 330)
ImageDraw.Draw(logo).text((680, H // 2 + 10), "tempo", font=word, fill=(17, 19, 29), anchor="lm")
logo.save(DEST + "tempo-logo.png")
print("exported")
