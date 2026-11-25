import cv2, numpy as np
src = cv2.imread('/tmp/tex/att_head_orig.jpg').astype(np.float32)
H, W = src.shape[:2]; yy, xx = np.mgrid[0:H, 0:W]
img = src.copy(); lum = img.mean(2)
rng = np.random.default_rng(11)
def paint(mask, color, alpha):
    a = (mask * alpha)[..., None]; img[:] = img * (1 - a) + np.array(color, np.float32) * a
# remove the big mustache
m = np.zeros((H, W), np.uint8); cv2.ellipse(m, (512, 506), (100, 22), 0, 0, 360, 255, -1)
m &= ((lum < 150) * 255).astype(np.uint8); m = cv2.dilate(m, np.ones((7, 7), np.uint8))
img = cv2.inpaint(np.clip(img, 0, 255).astype(np.uint8), m, 9, cv2.INPAINT_TELEA).astype(np.float32)
# hair: short, dark brown
face = np.zeros((H, W), np.uint8); cv2.ellipse(face, (512, 420), (215, 250), 0, 0, 360, 255, -1)
hair = (lum < 125) & (yy < 640) & ~((face > 0) & (yy > 250))
hf = cv2.GaussianBlur(hair.astype(np.float32), (9, 9), 0)[..., None]
img = img * (1 - hf) + img * np.array([0.55, 0.58, 0.66], np.float32) * hf
# skin: a bit more tan
skin = ~hair
img[..., 0] = np.where(skin, img[..., 0] * 0.93, img[..., 0]); img[..., 1] = np.where(skin, img[..., 1] * 0.97, img[..., 1])
# freckles: nose bridge, cheeks, forehead (lighter)
fr = np.zeros((H, W), np.float32)
for cx, cy, rx, ry, n in ((512, 400, 150, 70, 420), (512, 250, 120, 45, 90)):
    for _ in range(n):
        x = int(cx + rng.normal(0, rx / 2)); y = int(cy + rng.normal(0, ry / 2))
        cv2.circle(fr, (x, y), int(1 + rng.random() * 2), 0.4 + 0.6 * rng.random(), -1, cv2.LINE_AA)
fr[(face == 0)] = 0
paint(cv2.GaussianBlur(fr, (3, 3), 0), (55, 85, 135), 0.55)
# brows: straight, medium-dark, medium thickness
for cx, sgn in ((425, -1), (598, 1)):
    b = np.zeros((H, W), np.float32); inner, outer = cx - 52 * sgn, cx + 50 * sgn
    for i in range(520):
        t = rng.random(); x = inner + (outer - inner) * t
        yc = 291 - 8 * np.sin(np.pi * min(1, t * 1.2)) + 5 * t; th = 12 * (1 - 0.5 * t); y = yc + (rng.random() - 0.5) * th
        L = 6 + 4 * rng.random(); ang = -sgn * (0.2 + 0.3 * t)
        cv2.line(b, (int(x), int(y)), (int(x + L * np.cos(ang) * sgn), int(y + L * np.sin(ang))), 0.5 + 0.5 * rng.random(), 1, cv2.LINE_AA)
    paint(np.clip(cv2.GaussianBlur(b, (3, 3), 0) * 1.5, 0, 1), (30, 40, 58), 0.88)
# thin, sparse mustache
mu = np.zeros((H, W), np.float32)
for i in range(420):
    t = rng.random() * 2 - 1; x = 512 + 58 * t; yc = 499 + 8 * t * t
    th = 7 * (1 - 0.4 * abs(t)); y = yc + (rng.random() - 0.5) * th; L = 4 + 3 * rng.random(); ang = 1.3 + 0.4 * t
    cv2.line(mu, (int(x), int(y)), (int(x + L * np.cos(ang) * 0.5 * np.sign(t + 1e-6)), int(y + L * np.sin(ang))), 0.4 + 0.6 * rng.random(), 1, cv2.LINE_AA)
paint(np.clip(cv2.GaussianBlur(mu, (3, 3), 0) * 1.3, 0, 1), (40, 52, 70), 0.75)
# light chin stubble (goatee-ish), nothing on the cheeks
st = np.zeros((H, W), np.float32); cv2.ellipse(st, (512, 588), (95, 48), 0, 0, 360, 1.0, -1)
st[yy < 550] = 0; st = cv2.GaussianBlur(st, (35, 35), 0)
fine = (rng.random((H, W)) > 0.78).astype(np.float32)
img[:] = img * (1 - 0.12 * st[..., None]); paint(np.clip(st * fine, 0, 1), (35, 45, 60), 0.45)
cv2.imwrite('/home/claude/totem/public/avatars/att_head.jpg', np.clip(img, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 92])
