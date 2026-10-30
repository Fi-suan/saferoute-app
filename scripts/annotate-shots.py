# -*- coding: utf-8 -*-
"""
Аннотация скриншотов нумерованными бейджами + сборка итогового docx.

1. Берёт все картинки из shots/ (сортировка по имени = по времени).
2. Рисует оранжевые кружки с номерами (позиции — эвристики по макету,
   зелёная FAB-кнопка и синяя GPS-точка детектятся по цвету).
3. Пересобирает Sapa-Jol-нәтижелер.docx: раздел 5 = картинка + подпись.

Запуск:  python scripts/make-docx.py  (папка shots/ должна содержать 9 файлов)
"""
import os, glob
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(BASE, 'shots')
OUT = os.path.join(SHOTS, 'annotated')
FONT = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 52)

BRAND = (255, 122, 0)     # оранжевый бейдж
WHITE = (255, 255, 255)

# ── цветовой детектор ──────────────────────────────────────────────
def blob(img, pred, box=None):
    """Центроид пикселей, удовлетворяющих pred, внутри box (fractions)."""
    w, h = img.size
    small = img.resize((w // 4, h // 4))
    px = small.load()
    xs, ys = [], []
    x0, y0 = int((box or (0, 0, 1, 1))[0] * small.width), int((box or (0, 0, 1, 1))[1] * small.height)
    x1, y1 = int((box or (0, 0, 1, 1))[2] * small.width), int((box or (0, 0, 1, 1))[3] * small.height)
    for y in range(y0, y1):
        for x in range(x0, x1):
            if pred(*px[x, y][:3]):
                xs.append(x); ys.append(y)
    if not xs:
        return None
    return (sum(xs) / len(xs) * 4 / w, sum(ys) / len(ys) * 4 / h)

def find_fab(img):   # зелёная круглая кнопка «+» справа-снизу
    return blob(img, lambda r, g, b: g > 170 and r < 120 and b < 160, box=(0.55, 0.55, 1, 1))

def find_blue_dot(img):  # синяя точка GPS
    return blob(img, lambda r, g, b: b > 200 and g > 120 and r < 140, box=(0.15, 0.15, 0.85, 0.9))

def find_rings(img):  # оранжевые концентрические круги метки
    return blob(img, lambda r, g, b: r > 200 and 100 < g < 200 and b < 90, box=(0.05, 0.15, 0.95, 0.95))

# позиции по умолчанию (доли ширины/высоты), если детект не сработал
# ключи: списки (x, y) для бейджей 1, 2, 3, ...
POS = {
    1: [(0.50, 0.46), (0.50, 0.55), (0.30, 0.062), (0.12, 0.062), (0.87, 0.062), (0.15, 0.128), (0.80, 0.78)],   # карта
    2: [(0.06, 0.315), (0.30, 0.395), (0.22, 0.615), (0.72, 0.615)],                                              # карточка 0
    3: [(0.06, 0.315), (0.30, 0.395), (0.22, 0.615), (0.72, 0.615)],                                              # карточка 1
    4: [(0.06, 0.315), (0.30, 0.395), (0.22, 0.615), (0.72, 0.615)],                                              # карточка 2
    5: [(0.22, 0.615), (0.72, 0.615)],                                                                            # карточка 3 + Шешілген
    6: [(0.50, 0.24), (0.50, 0.40), (0.50, 0.86), (0.86, 0.055)],                                                 # Белгілер
    7: [(0.50, 0.48), (0.50, 0.56), (0.80, 0.78)],                                                                # карта без метки
    8: [(0.06, 0.315), (0.30, 0.395), (0.50, 0.55)],                                                              # офлайн карточка
    9: [(0.50, 0.40), (0.87, 0.35), (0.50, 0.26)],                                                                # журнал
}

def annotate(src, dst, fig_no):
    img = Image.open(src).convert('RGB')
    w, h = img.size
    draw = ImageDraw.Draw(img, 'RGBA')
    pos = POS.get(fig_no)

    # уточнение по цвету для карт
    if fig_no in (1, 7):
        rings = find_rings(img)
        dot = find_blue_dot(img)
        fab = find_fab(img)
        if fig_no == 1:
            if rings: pos[0] = rings; pos[1] = (rings[0], rings[1] + 0.04)
            if fab: pos[6] = (fab[0] - 0.02, fab[1] - 0.02)
        else:
            if dot: pos[1] = dot; pos[0] = (dot[0], dot[1] - 0.09)
            if fab: pos[2] = (fab[0] - 0.02, fab[1] - 0.02)

    for i, (fx, fy) in enumerate(pos, 1):
        cx, cy = int(fx * w), int(fy * h)
        r = int(w * 0.052)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BRAND + (230,), outline=WHITE + (255,), width=5)
        tb = draw.textbbox((0, 0), str(i), font=FONT)
        draw.text((cx - (tb[2] - tb[0]) / 2, cy - (tb[3] - tb[1]) / 2 - tb[1]), str(i),
                  font=FONT, fill=WHITE)
    img.save(dst, quality=92)
    print(f'fig {fig_no}: {os.path.basename(src)} -> {os.path.basename(dst)} ({len(pos)} badges)')

def main():
    os.makedirs(OUT, exist_ok=True)
    files = sorted(
        [f for f in glob.glob(os.path.join(SHOTS, '*.*'))
         if f.lower().endswith(('.png', '.jpg', '.jpeg')) and not f.startswith('~$')],
    )
    if not files:
        print('shots/ пуст — нечего аннотировать'); return
    print(f'найдено {len(files)} скриншотов')
    for i, src in enumerate(files[:9], 1):
        annotate(src, os.path.join(OUT, f'fig{i}.png'), i)

if __name__ == '__main__':
    main()
