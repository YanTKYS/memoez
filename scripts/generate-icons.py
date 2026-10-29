#!/usr/bin/env python3
"""Render editable icon.svg with CairoSVG 2.8.2; no npm dependencies."""
import copy
from pathlib import Path
import xml.etree.ElementTree as ET

import cairosvg
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
ET.register_namespace('', 'http://www.w3.org/2000/svg')
source = ET.parse(ASSETS / 'icon.svg').getroot()
background_color = next(e for e in source if e.get('id') == 'background').get('fill')


def render(filename, foreground=False, monochrome=False):
    svg = copy.deepcopy(source)
    background = next(e for e in svg if e.get('id') == 'background')
    note = next(e for e in svg if e.get('id') == 'note')
    if foreground:
        svg.remove(background)
    else:
        # Legacy icon has no adaptive viewport crop; increase the mark accordingly.
        note.set('transform', 'translate(512 512) scale(1.33) translate(-512 -512)')
    if monochrome:
        # A single alpha silhouette, with the two memo strokes as transparent holes.
        for e in note:
            e.set('fill', '#FFFFFF')
    cairosvg.svg2png(bytestring=ET.tostring(svg), write_to=str(ASSETS / filename))


render('icon.png')
render('adaptive-icon.png', foreground=True)
render('monochrome-icon.png', foreground=True, monochrome=True)
print('Generated icon.png, adaptive-icon.png, monochrome-icon.png (1024 × 1024)')

# Review the Android 72/108 viewport under common launcher masks, and theme tints.

fg = Image.open(ASSETS / 'adaptive-icon.png').convert('RGBA')
mono = Image.open(ASSETS / 'monochrome-icon.png').convert('RGBA')
alpha = fg.getchannel('A')
# Android guarantees a central 66 dp circle on the 108 dp foreground layer.
pixels = alpha.load()
assert all((x - 511.5) ** 2 + (y - 511.5) ** 2 <= (1024 * 33 / 108) ** 2
           for y in range(1024) for x in range(1024) if pixels[x, y]), 'Foreground outside safe circle'
assert fg.size == mono.size == (1024, 1024)
assert mono.getchannel('A').tobytes() == alpha.tobytes(), 'Themed silhouette differs'
preview = Image.new('RGB', (800, 180), '#ECEFF1')
labels = ['Circle', 'Rounded', 'Squircle', 'Theme / light', 'Theme / dark']
for i, label in enumerate(labels):
    mask = Image.new('L', (136, 136))
    draw = ImageDraw.Draw(mask)
    if i in (0, 3, 4):
        draw.ellipse((0, 0, 135, 135), fill=255)
    elif i == 1:
        draw.rounded_rectangle((0, 0, 135, 135), radius=30, fill=255)
    else:
        # Fourth-power superellipse approximation for a launcher squircle.
        mask.putdata([255 if abs((x - 67.5) / 67.5) ** 4 + abs((y - 67.5) / 67.5) ** 4 <= 1 else 0
                      for y in range(136) for x in range(136)])
    if i < 3:
        tile = Image.new('RGBA', (1024, 1024), background_color)
        tile.alpha_composite(fg)
    else:
        tile = Image.new('RGBA', (1024, 1024), '#D5E8D4' if i == 3 else '#263D32')
        tint = Image.new('RGBA', (1024, 1024), '#164D36' if i == 3 else '#BAF0CE')
        tile.paste(tint, mask=mono.getchannel('A'))
    tile = tile.crop((171, 171, 853, 853)).resize((136, 136), Image.Resampling.LANCZOS)
    preview.paste(tile.convert('RGB'), (12 + i * 160, 10), mask)
    ImageDraw.Draw(preview).text((12 + i * 160, 154), label, fill='#263238')
preview.save(ROOT / 'docs' / 'app-icon-preview.png')
print('Safe circle and monochrome alpha verified; wrote docs/app-icon-preview.png')
