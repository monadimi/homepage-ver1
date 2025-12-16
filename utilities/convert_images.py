import os
import sys
from PIL import Image

def convert_to_dot_svg(input_path, output_path, dot_size=2, spacing=4, color="white"):
    try:
        img = Image.open(input_path).convert("RGBA")
    except Exception as e:
        print(f"Failed to load {input_path}: {e}")
        return

    # Resize to reduce complexity if needed, or rely on spacing
    # Better to sample pixels based on spacing rather than resizing blindly
    # effectively, we scan every 'spacing' pixels
    
    width, height = img.size
    
    # Calculate SVG dimensions
    svg_width = width
    svg_height = height
    
    svg_content = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {svg_width} {svg_height}" width="{svg_width}" height="{svg_height}">'
    ]
    
    # Iterate with spacing
    for y in range(0, height, spacing):
        for x in range(0, width, spacing):
            r, g, b, a = img.getpixel((x, y))
            
            # Threshold for visibility
            if a > 128:
                # Use pixel color or fixed color? User said "점 글씨" (dot text) previously, 
                # implying the style mostly. 
                # Usually monochrome dots look cleanest for this effect, but let's check.
                # The user just said "dot svg". Let's stick to the color of the pixel or white?
                # The previous request context was "MONAD... appearing/disappearing".
                # The images are deco-images. They were grayscale/white in CSS.
                # Let's make the dots fill with the pixel color but maybe simplified.
                # Or just white/current color. 
                # Let's use the pixel color to be safe, or just "currentColor" if requested.
                # Let's use hex from rgb.
                
                # hex_color = "#{:02x}{:02x}{:02x}".format(r, g, b)
                # Actually, these are for decoration. Let's make them white with some opacity maybe?
                # Or just use the pixel color. 
                # Let's use the pixel color for versatility.
                hex_color = "#{:02x}{:02x}{:02x}".format(r, g, b)
                
                cx = x + spacing / 2
                cy = y + spacing / 2
                svg_content.append(f'  <circle cx="{cx}" cy="{cy}" r="{dot_size}" fill="{hex_color}" opacity="{a/255:.2f}" />')

    svg_content.append('</svg>')
    
    with open(output_path, 'w') as f:
        f.write('\n'.join(svg_content))
    
    print(f"Converted {input_path} -> {output_path}")

def main():
    src_dir = "./src"
    if not os.path.exists(src_dir):
        print(f"Directory {src_dir} not found.")
        return

    files = [f for f in os.listdir(src_dir) if f.lower().endswith('.png')]
    
    if not files:
        print("No PNG files found in src.")
        return

    for file in files:
        input_path = os.path.join(src_dir, file)
        output_path = os.path.join(src_dir, os.path.splitext(file)[0] + '.svg')
        convert_to_dot_svg(input_path, output_path, dot_size=1.5, spacing=6)

if __name__ == "__main__":
    main()
