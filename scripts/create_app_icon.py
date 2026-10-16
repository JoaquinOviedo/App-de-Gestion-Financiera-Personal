from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "fintech-app.ico"
SIZE = 256

image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
pixels = image.load()
for y in range(SIZE):
    for x in range(SIZE):
        t = (x + y) / (2 * (SIZE - 1))
        pixels[x, y] = (
            int(79 + (124 - 79) * t),
            int(70 + (58 - 70) * t),
            int(229 + (237 - 229) * t),
            255,
        )

draw = ImageDraw.Draw(image)
draw.rounded_rectangle((18, 18, 238, 238), radius=48, outline=(255, 255, 255, 70), width=5)

font_candidates = [
    Path("C:/Windows/Fonts/segoeuib.ttf"),
    Path("C:/Windows/Fonts/arialbd.ttf"),
]
font_path = next((path for path in font_candidates if path.exists()), None)
font = ImageFont.truetype(str(font_path), 122) if font_path else ImageFont.load_default()

letter = "F"
box = draw.textbbox((0, 0), letter, font=font)
text_width = box[2] - box[0]
text_height = box[3] - box[1]
draw.text(((SIZE - text_width) / 2 - box[0], (SIZE - text_height) / 2 - box[1] - 5), letter, fill="white", font=font)

# Small upward trend mark to reinforce the finance identity.
draw.line((148, 181, 171, 158, 188, 169, 216, 132), fill=(224, 231, 255, 230), width=9, joint="curve")
draw.polygon(((208, 132), (217, 131), (215, 143)), fill=(224, 231, 255, 230))

image.save(OUTPUT, format="ICO", sizes=[(256, 256), (128, 128), (64, 64), (32, 32), (16, 16)])
print(OUTPUT)
