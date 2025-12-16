import re

def rgb_to_gray(hexcolor):
    r = int(hexcolor[1:3], 16)
    g = int(hexcolor[3:5], 16)
    b = int(hexcolor[5:7], 16)
    # perceptual luminance (sRGB)
    y = int(0.2126*r + 0.7152*g + 0.0722*b)
    return f"#{y:02x}{y:02x}{y:02x}"

with open("src/footprint.svg") as f:
    svg = f.read()

def repl(m):
    return f'fill="{rgb_to_gray(m.group(1))}"'

svg = re.sub(r'fill="(#[0-9a-fA-F]{6})"', repl, svg)

with open("src/foootprint.svg", "w") as f:
    f.write(svg)