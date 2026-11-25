import cv2, numpy as np
src = cv2.imread('/home/claude/totem/public/avatars/att_head.jpg').astype(np.float32)  # BGR
H, W = src.shape[:2]
img = src.copy()
yy, xx = np.mgrid[0:H, 0:W]
lum = img.mean(2)
# 1) remove Guis's mustache (inpaint from the surrounding skin)
m = np.zeros((H, W), np.uint8)
cv2.ellipse(m, (512, 506), (100, 22), 0, 0, 360, 255, -1)
m &= ((lum < 150) * 255).astype(np.uint8)
m = cv2.dilate(m, np.ones((7, 7), np.uint8))
img = cv2.inpaint(np.clip(img, 0, 255).astype(np.uint8), m, 9, cv2.INPAINT_TELEA).astype(np.float32)
# 2) hair: darker, cooler brown (photo: very dark brown)
face = np.zeros((H, W), np.uint8)
cv2.ellipse(face, (512, 420), (215, 250), 0, 0, 360, 255, -1)
hair = (lum < 125) & (yy < 640) & ~((face > 0) & (yy > 250))
hair_f = cv2.GaussianBlur(hair.astype(np.float32), (9, 9), 0)[..., None]
dark = img * np.array([0.42, 0.44, 0.50], np.float32)          # B,G,R multipliers
img = img * (1 - hair_f) + dark * hair_f
# 3) skin a touch warmer/less pink, like the photo
skin = (~hair) & (yy < 1024)
img[..., 2] = np.where(skin, img[..., 2] * 0.99, img[..., 2])
img[..., 0] = np.where(skin, img[..., 0] * 0.96, img[..., 0])
rng = np.random.default_rng(7)
def paint(mask, color, alpha):
    a = (mask * alpha)[..., None]
    img[:] = img * (1 - a) + np.array(color, np.float32) * a
# 4) thick, dark brows: tapered shape made of short hair strokes
for cx, sgn in ((425, -1), (598, 1)):
    b = np.zeros((H, W), np.float32)
    inner, outer = cx - 50 * sgn, cx + 42 * sgn
    for i in range(700):
        t = rng.random(); x = inner + (outer - inner) * t
        yc = 291 - 8 * np.sin(np.pi * min(1, t * 1.2)) + 5 * t       # arch peaks 2/3 out
        th = 19 * (1 - 0.5 * t)                                       # thick inside, thin tail
        y = yc + (rng.random() - 0.5) * th
        L = 7 + 5 * rng.random(); ang = -sgn * (0.25 + 0.35 * t)       # hairs lean outward
        p0 = (int(x), int(y)); p1 = (int(x + L * np.cos(ang) * sgn), int(y + L * np.sin(ang)))
        cv2.line(b, p0, p1, 0.55 + 0.45 * rng.random(), 1, cv2.LINE_AA)
    b = np.clip(cv2.GaussianBlur(b, (3, 3), 0) * 1.6, 0, 1)
    paint(b, (20, 24, 32), 0.95)
# 5) mustache: medium thickness, ends drooping to the mouth corners
mu = np.zeros((H, W), np.float32)
for i in range(1400):
    t = rng.random() * 2 - 1                                          # -1 .. 1 across the lip
    x = 512 + 64 * t; yc = 497 + 13 * t * t + 8 * t ** 4
    th = 15 * (1 - 0.4 * abs(t)); y = yc + (rng.random() - 0.5) * th
    L = 6 + 4 * rng.random(); ang = 1.25 + 0.35 * t                    # hairs point down and out
    cv2.line(mu, (int(x), int(y)), (int(x + L * np.cos(ang) * np.sign(t + 1e-6) * 0.6), int(y + L * np.sin(ang))), 0.5 + 0.5 * rng.random(), 1, cv2.LINE_AA)
mu = np.clip(cv2.GaussianBlur(mu, (3, 3), 0) * 1.5, 0, 1)
paint(mu, (30, 36, 46), 0.9)
# 6) stubble beard: chin, jaw line, soul patch
st = np.zeros((H, W), np.float32)
cv2.ellipse(st, (512, 590), (170, 62), 0, 0, 360, 1.0, -1)              # chin / lower face
cv2.ellipse(st, (512, 640), (265, 60), 0, 180, 360, 0.8, 40)             # jaw line
st[yy < 548] *= 0
cv2.ellipse(st, (512, 562), (16, 12), 0, 0, 360, 1.0, -1)                # soul patch
st = cv2.GaussianBlur(st, (41, 41), 0)
noise = (rng.random((H, W)) > 0.55).astype(np.float32)
noise = cv2.GaussianBlur(noise, (3, 3), 0)
st[yy >= 640] = 0
img[:] = img * (1 - 0.22 * st[..., None] * np.array([0.8, 0.9, 1.0], np.float32))   # shaved shadow, slightly blue
fine = (rng.random((H, W)) > 0.72).astype(np.float32)
paint(np.clip(st * fine, 0, 1), (30, 36, 46), 0.5)                          # bluish shadow of the shave
cv2.imwrite('/home/claude/totem/public/avatars/diniz_head.jpg', np.clip(img, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 92])
