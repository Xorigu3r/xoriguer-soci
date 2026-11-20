"""Genera el logo i les icones de Xoriguer Soci (falcó de la casa + micròfon amb ones de veu).

Ús:  python -I eines/genera_logo.py   (des de l'arrel del projecte)
Llenç de 512 com Notificacions: falcó a (36, 66) amb 440 d'ample, motiu del projecte a sota.
Rètol (logo complet): marca.py de LOGOS-XORIGUER (X original + Montserrat ExtraBold + Segoe UI).
Fons «Blau pissarra» #1E2A3B (mai negre).
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ARREL = Path(__file__).resolve().parent.parent
WWW = ARREL / 'www'
ICONS = WWW / 'icons'
ASSETS = ARREL / 'assets'
sys.path.insert(0, str(Path('D:/Projectes Xoriguer/LOGOS-XORIGUER/_eines')))
try:
    import marca  # noqa: E402
except Exception:  # sense la norma de la casa, el logo complet no porta rètol
    marca = None

FONS = (30, 42, 59, 255)
CREMA = (246, 239, 226, 255)
TARONJA = (255, 168, 46, 255)
TARONJA_FOSC = (242, 101, 15, 255)
S = 4


def degradat_vertical(N, c1, c2, y0, y1):
    g = Image.new('RGBA', (1, N))
    for y in range(N):
        t = min(1, max(0, (y - y0) / max(1, y1 - y0)))
        g.putpixel((0, y), tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(4)))
    return g.resize((N, N))


def dibuixa(mida, escala=1.0, amb_fons=True, rodo=False, amb_falco=True):
    N = 512 * S
    k = S
    capa = Image.new('RGBA', (N, N), (0, 0, 0, 0))

    g = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    ImageDraw.Draw(g).ellipse([156 * k, 236 * k, 356 * k, 456 * k], fill=TARONJA[:3] + (90,))
    capa.alpha_composite(g.filter(ImageFilter.GaussianBlur(40 * k)))

    if amb_falco:
        falco = Image.open(ICONS / 'falco.png').convert('RGBA')
        fw = 440 * k
        falco = falco.resize((fw, round(fw * falco.height / falco.width)), Image.LANCZOS)
        capa.alpha_composite(falco, (36 * k, 66 * k))

    d = ImageDraw.Draw(capa)
    cx, cy = 256, 318
    # ones de veu (crema a dins, taronja a fora)
    for r, col, obert in ((112, CREMA, 30), (150, TARONJA, 26)):
        for mig in (180, 0):
            d.arc([(cx - r) * k, (cy - r) * k, (cx + r) * k, (cy + r) * k], mig - obert, mig + obert, fill=col, width=10 * k)

    # càpsula del micròfon amb degradat
    m = Image.new('L', (N, N), 0)
    ImageDraw.Draw(m).rounded_rectangle([212 * k, 222 * k, 300 * k, 366 * k], radius=44 * k, fill=255)
    capa.paste(degradat_vertical(N, TARONJA, TARONJA_FOSC, 222 * k, 366 * k), (0, 0), m)
    d = ImageDraw.Draw(capa)
    d.rounded_rectangle([212 * k, 222 * k, 300 * k, 366 * k], radius=44 * k, outline=CREMA, width=6 * k)
    # reixeta
    for y in (262, 288, 314):
        d.line([(236 * k, y * k), (276 * k, y * k)], fill=(255, 236, 205, 170), width=5 * k)
    # suport
    d.arc([186 * k, 270 * k, 326 * k, 406 * k], 0, 180, fill=CREMA, width=10 * k)
    d.line([(256 * k, 406 * k), (256 * k, 436 * k)], fill=CREMA, width=10 * k)
    d.rounded_rectangle([214 * k, 432 * k, 298 * k, 446 * k], radius=7 * k, fill=CREMA)

    if escala != 1.0:
        mm = round(N * escala)
        petita = capa.resize((mm, mm), Image.LANCZOS)
        capa = Image.new('RGBA', (N, N), (0, 0, 0, 0))
        capa.alpha_composite(petita, ((N - mm) // 2, (N - mm) // 2))
    im = Image.new('RGBA', (N, N), FONS if amb_fons else (0, 0, 0, 0))
    im.alpha_composite(capa)
    if rodo:
        mk = Image.new('L', (N, N), 0)
        ImageDraw.Draw(mk).rounded_rectangle([0, 0, N - 1, N - 1], radius=N // 5, fill=255)
        im.putalpha(mk)
    return im.resize((mida, mida), Image.LANCZOS)


def logo_complet(mida=1024):
    im = Image.new('RGBA', (mida, mida), FONS)
    simbol = dibuixa(720, amb_fons=False)
    im.alpha_composite(simbol, ((mida - 720) // 2, 10))
    if marca:
        marca.enganxa(im, marca.rotul('XORIGUER', 'SOCI', amplada=int(mida * 0.74)), mida / 2, mida * 0.735)
    return im


if __name__ == '__main__':
    ASSETS.mkdir(exist_ok=True)
    dibuixa(512).save(ICONS / 'icon-512.png')
    dibuixa(192).save(ICONS / 'icon-192.png')
    dibuixa(512, escala=0.78).save(ICONS / 'maskable-512.png')
    dibuixa(180, escala=0.92).convert('RGB').save(ICONS / 'apple-touch-icon.png')
    dibuixa(64, rodo=True).save(ICONS / 'favicon.png')
    dibuixa(512, amb_fons=False).save(ICONS / 'simbol.png')
    logo_complet().convert('RGB').save(ICONS / 'logo-complet.png')
    dibuixa(1024, escala=0.92).convert('RGB').save(ASSETS / 'icon-only.png')
    dibuixa(1024, escala=0.6, amb_fons=False).save(ASSETS / 'icon-foreground.png')
    Image.new('RGB', (1024, 1024), FONS[:3]).save(ASSETS / 'icon-background.png')
    sp = Image.new('RGBA', (2732, 2732), FONS)
    sp.alpha_composite(logo_complet(1000), (866, 866))
    sp.convert('RGB').save(ASSETS / 'splash.png')
    sp.convert('RGB').save(ASSETS / 'splash-dark.png')
    print('Icones generades a', ICONS)
