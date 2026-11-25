import cv2, numpy as np
img = cv2.imread('/tmp/tex/prof_head_base.jpg').astype(np.float32)
H, W = img.shape[:2]; yy, xx = np.mgrid[0:H, 0:W]
rng = np.random.default_rng(5)
def paint(mask, color, alpha):
    a = (mask * alpha)[..., None]; img[:] = img * (1 - a) + np.array(color, np.float32) * a
hsv = cv2.cvtColor(np.clip(img, 0, 255).astype(np.uint8), cv2.COLOR_BGR2HSV)
face = np.zeros((H, W), np.uint8); cv2.ellipse(face, (512, 420), (215, 250), 0, 0, 360, 255, -1)
hair = (hsv[..., 1] < 40) & (hsv[..., 2] > 120) & (yy < 650) & ~((face > 0) & (yy > 250))
hf = cv2.GaussianBlur(hair.astype(np.float32), (9, 9), 0)[..., None]
# skin: no freckles, tanned / olive
facem = (face > 0) & (yy > 170) & (yy < 470)
sm = cv2.bilateralFilter(np.clip(img, 0, 255).astype(np.uint8), 9, 40, 9).astype(np.float32)
img = np.where(facem[..., None], sm, img)
SKIN = np.array([0.76, 0.83, 0.92], np.float32)
img = np.where(hair[..., None], img, img * SKIN)
# hair: warm light grey / white
img = img * (1 - hf) + (img * np.array([0.94, 0.98, 1.02], np.float32) * 1.03) * hf
# thick dark brows
for cx, sgn in ((425, -1), (598, 1)):
    b = np.zeros((H, W), np.float32); inner, outer = cx - 52 * sgn, cx + 48 * sgn
    for i in range(800):
        t = rng.random(); x = inner + (outer - inner) * t
        yc = 290 - 6 * np.sin(np.pi * min(1, t * 1.2)) + 5 * t; th = 18 * (1 - 0.45 * t); y = yc + (rng.random() - 0.5) * th
        L = 7 + 5 * rng.random(); ang = -sgn * (0.2 + 0.3 * t)
        cv2.line(b, (int(x), int(y)), (int(x + L * np.cos(ang) * sgn), int(y + L * np.sin(ang))), 0.5 + 0.5 * rng.random(), 1, cv2.LINE_AA)
    paint(np.clip(cv2.GaussianBlur(b, (3, 3), 0) * 1.6, 0, 1), (28, 30, 36), 0.93)
# wrinkles: forehead lines, nasolabial folds, under-eye
wr = np.zeros((H, W), np.float32)
for y0 in (205, 228, 250):
    pts = np.array([[430 + 8 * k, y0 + 3 * np.sin(k / 2.5)] for k in range(22)], np.int32); cv2.polylines(wr, [pts], False, 0.55, 3, cv2.LINE_AA)
for sgn in (-1, 1):
    pts = np.array([[512 + sgn * (52 + 9 * k ** 0.8), 470 + 11 * k] for k in range(8)], np.int32); cv2.polylines(wr, [pts], False, 1.0, 4, cv2.LINE_AA)
    cv2.ellipse(wr, (512 + sgn * 88, 372), (30, 9), 0, 10, 170, 0.6, 3, cv2.LINE_AA)
wr = cv2.GaussianBlur(wr, (9, 9), 0)
img[:] = img * (1 - 0.14 * wr[..., None])
# five o'clock shadow: grey-dark stubble on upper lip, chin, jaw
st = np.zeros((H, W), np.float32)
cv2.ellipse(st, (512, 585), (235, 85), 0, 0, 360, 1.0, -1); cv2.ellipse(st, (512, 520), (285, 115), 0, 0, 180, 0.8, -1)
cv2.ellipse(st, (512, 505), (70, 16), 0, 0, 360, 0.9, -1)
st[yy < 488] = 0; st[(yy > 522) & (yy < 548) & (np.abs(xx - 512) < 60)] = 0; st[yy >= 640] = 0
st = cv2.GaussianBlur(st, (35, 35), 0)
img[:] = img * (1 - 0.13 * st[..., None] * np.array([0.85, 0.95, 1.0], np.float32))
paint(np.clip(st * (rng.random((H, W)) > 0.8), 0, 1), (70, 72, 78), 0.35)
out = np.clip(img, 0, 255).astype(np.uint8)
cv2.imwrite('/home/claude/totem/public/avatars/prof_head.jpg', out, [cv2.IMWRITE_JPEG_QUALITY, 92])
# wet version: hair darker and clumped
wet = img * (1 - hf) + img * 0.62 * hf
cv2.imwrite('/home/claude/totem/public/avatars/prof_head_wet.jpg', np.clip(wet, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 92])
