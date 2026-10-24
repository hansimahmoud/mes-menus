"""Crée un logo de test PNG (cercle ambré avec un « M ») pour vérifier l'intégration QR."""
try:
    from PIL import Image, ImageDraw
except ImportError:
    raise SystemExit("PIL non disponible")

img = Image.new("RGBA", (300, 300), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
# Disque ambré avec bord blanc
d.ellipse([10, 10, 290, 290], fill=(217, 119, 6, 255), outline=(255, 255, 255, 255), width=12)
# Lettre M stylisée (simple rectangle trapèze)
d.rectangle([80, 190, 120, 250], fill=(255, 255, 255, 255))
d.rectangle([180, 190, 220, 250], fill=(255, 255, 255, 255))
d.polygon([(80, 190), (100, 120), (150, 170), (200, 120), (220, 190), (200, 190),
           (185, 150), (150, 190), (115, 150), (100, 190)], fill=(255, 255, 255, 255))
img.save("/home/z/my-project/scripts/logo-test.png")
print("Logo de test créé : scripts/logo-test.png")
