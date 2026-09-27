#!/usr/bin/env python3
"""Tile stills into a labelled contact sheet: sheet.py out.png img1.png img2.png ... [--cols 2] [--w 960]"""
import sys
from PIL import Image, ImageDraw, ImageFont
args = sys.argv[1:]
cols, tw = 2, 960
if '--cols' in args:
    i = args.index('--cols'); cols = int(args[i + 1]); del args[i:i + 2]
if '--w' in args:
    i = args.index('--w'); tw = int(args[i + 1]); del args[i:i + 2]
out, files = args[0], args[1:]
th = tw * 9 // 16
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * th), (0, 0, 0))
d = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
except Exception:
    font = None
for k, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS)
    x, y = (k % cols) * tw, (k // cols) * th
    sheet.paste(im, (x, y))
    label = f.split('/')[-1].replace('.png', '')
    d.rectangle([x, y, x + 12 * len(label) + 16, y + 30], fill=(0, 0, 0))
    d.text((x + 8, y + 3), label, fill=(255, 255, 0), font=font)
sheet.save(out)
print(out, sheet.size)
