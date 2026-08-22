#!/usr/bin/env python3
"""MedleaPlus app icon — same basics as the original (plum squircle + white
submission card with a green spine and two text lines) plus the MEDLEA+ "+"
badge. Drawn at 8x and downsampled with LANCZOS, so every exported size is
genuinely resolved rather than a resize of a 128px bitmap."""
from PIL import Image, ImageDraw, ImageFilter

SS = 8  # supersample factor

INK    = (33, 26, 46)       # #211A2E  — card text lines (design token: ink)
PAPER  = (255, 255, 255)
MUTED  = (151, 145, 168)    # #9791A8  — second, lighter text line
SPINE  = (86, 146, 96)      # #569260  — the original's green spine
TOP    = (28, 15, 46)       # #1C0F2E  — plum gradient, top
BOT    = (71, 21, 107)      # #47156B  — plum gradient, bottom
VIOLET = (139, 92, 246)     # #8B5CF6
ORCHID = (209, 139, 255)    # #D18BFF


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def vgrad(size, top, bot):
    g = Image.new('RGB', (1, size))
    for y in range(size):
        g.putpixel((0, y), lerp(top, bot, y / max(1, size - 1)))
    return g.resize((size, size), Image.BILINEAR)


def dgrad(size, a, b):
    """diagonal gradient, top-left -> bottom-right"""
    g = Image.new('RGB', (size, size))
    px = g.load()
    for y in range(size):
        for x in range(size):
            px[x, y] = lerp(a, b, (x + y) / max(1, 2 * size - 2))
    return g


def rr(dr, box, r, fill):
    dr.rounded_rectangle(box, radius=r, fill=fill)


def build(px, simple):
    S = px * SS
    u = lambda f: f * S          # fraction of the canvas -> device px

    # ── plum squircle ────────────────────────────────────────────────────────
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=u(.225), fill=255)
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    img.paste(vgrad(S, TOP, BOT), (0, 0), mask)
    # aurora bloom at the lower-left, the same violet the skin bleeds through glass
    bloom = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(bloom).ellipse(
        [u(-.30), u(.45), u(.72), u(1.35)], fill=VIOLET + (76,))
    bloom = bloom.filter(ImageFilter.GaussianBlur(u(.10)))
    img.alpha_composite(Image.composite(bloom, Image.new('RGBA', (S, S), (0, 0, 0, 0)), mask))

    # ── the submission card: green spine + paper, one rounded silhouette ─────
    cx0, cy0, cx1, cy1 = u(.219), u(.301), u(.777), u(.695)
    if simple:                                    # 16px: chunkier, fewer parts
        cx0, cy0, cx1, cy1 = u(.160), u(.265), u(.700), u(.695)
    bar = u(.085 if simple else .078)
    crad = u(.048)
    cmask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(cmask).rounded_rectangle([cx0, cy0, cx1, cy1], radius=crad, fill=255)
    card = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    cd.rectangle([cx0, cy0, cx0 + bar, cy1], fill=SPINE + (255,))
    cd.rectangle([cx0 + bar, cy0, cx1, cy1], fill=PAPER + (255,))
    img.alpha_composite(Image.composite(card, Image.new('RGBA', (S, S), (0, 0, 0, 0)), cmask))

    # ── text lines ───────────────────────────────────────────────────────────
    d = ImageDraw.Draw(img)
    lx = cx0 + bar + u(.047)
    if simple:
        h = u(.095)
        y = (cy0 + cy1) / 2 - h / 2
        rr(d, [lx, y, lx + u(.235), y + h], h / 2, INK + (255,))
    else:
        h1 = u(.0625)
        rr(d, [lx, u(.391), lx + u(.273), u(.391) + h1], h1 / 2, INK + (255,))
        h2 = u(.055)
        rr(d, [lx, u(.508), lx + u(.180), u(.508) + h2], h2 / 2, MUTED + (255,))

    # ── the "+" badge ────────────────────────────────────────────────────────
    bcx, bcy, br = u(.792), u(.762), u(.172)
    if simple:
        bcx, bcy, br = u(.780), u(.755), u(.225)
    ring = br + u(.048 if simple else .026)
    d.ellipse([bcx - ring, bcy - ring, bcx + ring, bcy + ring], fill=(18, 10, 34, 255))
    badge = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    bmask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(bmask).ellipse([bcx - br, bcy - br, bcx + br, bcy + br], fill=255)
    badge.paste(dgrad(S, ORCHID, VIOLET), (0, 0), bmask)
    img.alpha_composite(badge)
    arm, th = br * (.56 if simple else .52), br * (.34 if simple else .26)
    rr(d, [bcx - arm, bcy - th / 2, bcx + arm, bcy + th / 2], th / 2, PAPER + (255,))
    rr(d, [bcx - th / 2, bcy - arm, bcx + th / 2, bcy + arm], th / 2, PAPER + (255,))

    return img.resize((px, px), Image.LANCZOS)


if __name__ == '__main__':
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else 'icons'
    for px in (16, 32, 48, 64, 128, 256, 512):
        build(px, simple=px <= 16).save('%s/icon%d.png' % (out, px))
        print('wrote %s/icon%d.png' % (out, px))
