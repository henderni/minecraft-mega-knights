#!/usr/bin/env python3
"""Generate all 46 Mega Knights pixel art textures.

Creates:
  - 9 entity skins (64x64)
  - 10 armor model textures (64x32)
  - 20 armor item icons (16x16)
  - 4 token icons (16x16)
  - 3 blueprint icons (16x16)
"""

from PIL import Image
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENTITY_DIR = os.path.join(ROOT, "MegaKnights_RP", "textures", "entity")
ITEMS_DIR  = os.path.join(ROOT, "MegaKnights_RP", "textures", "items")
ARMOR_DIR  = os.path.join(ROOT, "MegaKnights_RP", "textures", "models", "armor")

# ====================================================================
#  UV LAYOUT — box-UV face coordinates as (x, y, w, h)
# ====================================================================

def _faces(origin, whd):
    U, V = origin; W, H, D = whd
    return dict(
        top=(U+D, V, W, D), bottom=(U+D+W, V, W, D),
        right=(U, V+D, D, H), front=(U+D, V+D, W, H),
        left=(U+D+W, V+D, D, H), back=(U+D+W+D, V+D, W, H))

SKIN = dict(
    head=_faces((0,0),(8,8,8)),     body=_faces((16,16),(8,12,4)),
    r_arm=_faces((40,16),(4,12,4)), r_leg=_faces((0,16),(4,12,4)),
    l_arm=_faces((32,48),(4,12,4)), l_leg=_faces((16,48),(4,12,4)))

ARM_PARTS = ['r_arm','l_arm']
LEG_PARTS = ['r_leg','l_leg']

# ====================================================================
#  DRAWING PRIMITIVES
# ====================================================================

def fill(img, x, y, w, h, c):
    for py in range(y, y+h):
        for px in range(x, x+w):
            img.putpixel((px, py), c)

def shade(img, x, y, w, h, base, hi, lo):
    """Top-left lit face: highlight on top/left edges, shadow on bottom/right."""
    fill(img, x, y, w, h, base)
    for i in range(w):     img.putpixel((x+i, y), hi)
    for i in range(1,h-1): img.putpixel((x, y+i), hi)
    for i in range(w):     img.putpixel((x+i, y+h-1), lo)
    for i in range(1,h-1): img.putpixel((x+w-1, y+i), lo)

def hl(img, x, y, n, c):
    for i in range(n): img.putpixel((x+i, y), c)

def vl(img, x, y, n, c):
    for i in range(n): img.putpixel((x, y+i), c)

def px(img, x, y, c):
    img.putpixel((x, y), c)

def paint_part(img, faces, base, hi, lo, top_c=None, bot_c=None):
    """Paint all 6 faces of a body part with orientation-aware shading."""
    top_c = top_c or hi
    bot_c = bot_c or lo
    for name, (fx, fy, fw, fh) in faces.items():
        if name == 'top':
            shade(img, fx, fy, fw, fh, top_c, hi, base)
        elif name == 'bottom':
            shade(img, fx, fy, fw, fh, bot_c, lo, lo)
        elif name == 'back':
            shade(img, fx, fy, fw, fh, lo, base, lo)
        else:
            shade(img, fx, fy, fw, fh, base, hi, lo)

# ====================================================================
#  COLOR PALETTES  (R, G, B, A)
# ====================================================================

T = (0, 0, 0, 0)  # transparent

# --- Ally Knight ---
AK_STEEL_HI  = (208, 208, 216, 255)
AK_STEEL     = (138, 142, 150, 255)
AK_STEEL_LO  = (74,  78,  90,  255)
AK_BLUE_HI   = (91,  141, 217, 255)
AK_BLUE      = (46,  91,  168, 255)
AK_BLUE_LO   = (26,  58,  110, 255)
AK_GOLD      = (212, 168, 50,  255)
AK_GOLD_LO   = (139, 105, 20,  255)
AK_DARK      = (30,  30,  40,  255)
AK_EYE       = (180, 210, 255, 255)
AK_BROWN     = (101, 80,  52,  255)
AK_BROWN_LO  = (70,  55,  36,  255)

# --- Enemy Knight ---
EK_STEEL_HI  = (144, 144, 152, 255)
EK_STEEL     = (88,  88,  96,  255)
EK_STEEL_LO  = (42,  42,  50,  255)
EK_RED_HI    = (224, 80,  80,  255)
EK_RED       = (160, 24,  24,  255)
EK_RED_LO    = (96,  16,  16,  255)
EK_DARK      = (25,  20,  20,  255)
EK_EYE       = (255, 60,  60,  255)

# --- Ally Archer ---
AA_GREEN_HI  = (106, 174, 74,  255)
AA_GREEN     = (60,  122, 40,  255)
AA_GREEN_LO  = (30,  78,  20,  255)
AA_LEATH_HI  = (196, 154, 108, 255)
AA_LEATH     = (139, 105, 65,  255)
AA_LEATH_LO  = (90,  62,  34,  255)
AA_SKIN      = (212, 165, 116, 255)
AA_SKIN_LO   = (180, 130, 90,  255)
AA_HAIR      = (100, 70,  40,  255)
AA_EYE       = (60,  40,  20,  255)
AA_TAN_HI    = (232, 216, 176, 255)
AA_TAN       = (196, 170, 120, 255)
AA_TAN_LO    = (138, 122, 80,  255)
AA_QUIVER    = (90,  58,  30,  255)
AA_ARROW     = (196, 160, 96,  255)
AA_FLETCH    = (200, 50,  50,  255)

# --- Enemy Archer ---
EA_GREEN_HI  = (58,  64,  48,  255)
EA_GREEN     = (42,  45,  42,  255)
EA_GREEN_LO  = (21,  24,  21,  255)
EA_MAROON_HI = (90,  48,  48,  255)
EA_MAROON    = (74,  26,  26,  255)
EA_MAROON_LO = (45,  15,  15,  255)
EA_LEATH_HI  = (90,  68,  48,  255)
EA_LEATH     = (58,  40,  24,  255)
EA_LEATH_LO  = (42,  28,  16,  255)
EA_EYE       = (200, 50,  30,  255)
EA_SKIN_LO   = (50,  35,  25,  255)

# --- Ally Wizard ---
AW_PURP_HI   = (139, 95,  199, 255)
AW_PURP      = (106, 49,  144, 255)
AW_PURP_LO   = (68,  10,  95,  255)
AW_GOLD      = (251, 194, 0,   255)
AW_GOLD_LO   = (180, 140, 0,   255)
AW_SKIN      = (212, 165, 116, 255)
AW_SKIN_LO   = (180, 130, 90,  255)
AW_BEARD_HI  = (240, 240, 245, 255)
AW_BEARD     = (210, 210, 215, 255)
AW_BEARD_LO  = (175, 175, 185, 255)
AW_CYAN      = (127, 212, 255, 255)
AW_CYAN_LO   = (80,  160, 210, 255)

# --- Enemy Wizard ---
EW_DARK_HI   = (46,  24,  52,  255)
EW_DARK      = (27,  0,   54,  255)
EW_DARK_LO   = (15,  0,   32,  255)
EW_RED       = (220, 20,  60,  255)
EW_FIRE_HI   = (255, 100, 30,  255)
EW_FIRE      = (255, 69,  0,   255)
EW_FIRE_LO   = (180, 40,  0,   255)
EW_SHADOW    = (20,  15,  20,  255)
EW_EYE       = (255, 0,   0,   255)

# --- Ally Dark Knight ---
AD_NAVY_HI   = (30,  40,  70,  255)
AD_NAVY      = (26,  26,  46,  255)
AD_NAVY_LO   = (15,  15,  26,  255)
AD_BLUE      = (0,   102, 255, 255)
AD_BLUE_HI   = (102, 178, 255, 255)
AD_BLUE_LO   = (0,   60,  160, 255)
AD_SILVER    = (136, 153, 170, 255)

# --- Enemy Dark Knight ---
ED_BLACK_HI  = (28,  28,  28,  255)
ED_BLACK     = (13,  13,  13,  255)
ED_BLACK_LO  = (0,   0,   0,   255)
ED_CRIM      = (139, 0,   0,   255)
ED_CRIM_HI   = (204, 0,   0,   255)
ED_RUST      = (74,  32,  32,  255)

# --- Boss: Siege Lord ---
SL_BLACK_HI  = (28,  28,  28,  255)
SL_BLACK     = (13,  13,  13,  255)
SL_BLACK_LO  = (0,   0,   0,   255)
SL_CRIM      = (180, 0,   0,   255)
SL_CRIM_HI   = (220, 30,  30,  255)
SL_GOLD_HI   = (255, 215, 0,   255)
SL_GOLD      = (218, 165, 32,  255)
SL_GOLD_LO   = (139, 105, 20,  255)

# --- Armor Tier Colors ---
PAGE_HI      = (232, 212, 168, 255)
PAGE         = (210, 180, 140, 255)
PAGE_LO      = (139, 105, 65,  255)
PAGE_STITCH  = (120, 85,  50,  255)

SQUIRE_HI    = (200, 200, 200, 255)
SQUIRE       = (168, 168, 168, 255)
SQUIRE_LO    = (80,  80,  80,  255)
SQUIRE_ALT   = (130, 130, 140, 255)

KNIGHT_HI    = (160, 192, 216, 255)
KNIGHT       = (70,  130, 180, 255)
KNIGHT_LO    = (30,  61,  107, 255)
KNIGHT_SPEC  = (255, 255, 255, 255)

CHAMP_HI     = (255, 215, 0,   255)
CHAMP        = (218, 165, 32,  255)
CHAMP_LO     = (139, 105, 20,  255)
CHAMP_SPEC   = (255, 248, 220, 255)
CHAMP_GEM    = (220, 20,  60,  255)

MEGA_HI      = (155, 89,  182, 255)
MEGA         = (75,  0,   130, 255)
MEGA_LO      = (26,  26,  46,  255)
MEGA_GOLD    = (255, 215, 0,   255)
MEGA_GOLD_LO = (180, 140, 0,   255)
MEGA_GLOW    = (200, 160, 255, 255)

# ====================================================================
#  ENTITY SKIN PAINTERS (64x64)
# ====================================================================

def new_skin():
    return Image.new('RGBA', (64, 64), T)

def new_armor_tex():
    return Image.new('RGBA', (64, 32), T)

def new_icon():
    return Image.new('RGBA', (16, 16), T)

# ---- Ally Knight ----
def paint_ally_knight(img):
    # Base: steel armor everywhere
    for pname, faces in SKIN.items():
        paint_part(img, faces, AK_STEEL, AK_STEEL_HI, AK_STEEL_LO)

    # HEAD FRONT (8x8 at 8,8): closed helmet with visor
    hx, hy = 8, 8
    fill(img, hx, hy, 8, 8, AK_STEEL)
    hl(img, hx, hy, 8, AK_STEEL_HI)       # brow highlight
    hl(img, hx, hy+1, 8, AK_STEEL_HI)     # second highlight row
    # Visor slit at row 3-4
    hl(img, hx+1, hy+3, 6, AK_DARK)        # visor dark
    hl(img, hx+1, hy+4, 6, AK_DARK)        # visor second row
    px(img, hx+2, hy+3, AK_EYE)            # left eye
    px(img, hx+5, hy+3, AK_EYE)            # right eye
    # Lower face plate
    hl(img, hx, hy+7, 8, AK_STEEL_LO)      # chin shadow
    vl(img, hx+7, hy, 8, AK_STEEL_LO)      # right edge shadow

    # Head top: steel with blue plume stripe
    tx, ty = 8, 0
    fill(img, tx, ty, 8, 8, AK_STEEL)
    for i in range(8): px(img, tx+3, ty+i, AK_BLUE)
    for i in range(8): px(img, tx+4, ty+i, AK_BLUE)

    # BODY FRONT (8x12 at 20,20): blue tabard over steel
    bx, by = 20, 20
    fill(img, bx, by, 8, 12, AK_BLUE)
    hl(img, bx, by, 8, AK_BLUE_HI)         # top highlight
    vl(img, bx, by, 12, AK_BLUE_HI)        # left highlight
    # Steel shoulders (top 2 rows)
    fill(img, bx, by, 8, 2, AK_STEEL)
    hl(img, bx, by, 8, AK_STEEL_HI)
    # Gold cross emblem
    vl(img, bx+3, by+4, 5, AK_GOLD)        # vertical bar
    hl(img, bx+1, by+6, 6, AK_GOLD)        # horizontal bar
    # Belt at row 9
    hl(img, bx, by+9, 8, AK_BROWN)
    px(img, bx+3, by+9, AK_GOLD)           # buckle
    px(img, bx+4, by+9, AK_GOLD)           # buckle
    # Bottom shadow
    hl(img, bx, by+11, 8, AK_BLUE_LO)
    vl(img, bx+7, by, 12, AK_BLUE_LO)

    # Body back: blue cape
    bkx, bky = 32, 20
    fill(img, bkx, bky, 8, 12, AK_BLUE)
    hl(img, bkx, bky, 8, AK_BLUE_HI)
    vl(img, bkx+2, bky+1, 10, AK_BLUE_LO)  # fold line
    vl(img, bkx+5, bky+1, 10, AK_BLUE_LO)  # fold line
    hl(img, bkx, bky+11, 8, AK_BLUE_LO)

    # Specular highlight on chest
    px(img, bx+2, by+3, AK_STEEL_HI)

    # Arms: steel with blue stripe
    for part in ARM_PARTS:
        for face_n, (fx, fy, fw, fh) in SKIN[part].items():
            if face_n == 'front':
                shade(img, fx, fy, fw, fh, AK_STEEL, AK_STEEL_HI, AK_STEEL_LO)
                # Blue stripe on outer column
                vl(img, fx+1, fy+2, 8, AK_BLUE)
                # Gauntlet (bottom 3 rows)
                fill(img, fx, fy+fh-3, fw, 3, AK_STEEL_LO)
                hl(img, fx, fy+fh-3, fw, AK_STEEL)

    # Legs: blue/steel with brown boots
    for part in LEG_PARTS:
        f = SKIN[part]['front']
        fx, fy, fw, fh = f
        shade(img, fx, fy, fw, fh, AK_BLUE, AK_BLUE_HI, AK_BLUE_LO)
        # Brown boots (bottom 4 rows)
        fill(img, fx, fy+fh-4, fw, 4, AK_BROWN)
        hl(img, fx, fy+fh-4, fw, AK_BROWN)
        hl(img, fx, fy+fh-1, fw, AK_BROWN_LO)

    return img

# ---- Enemy Knight ----
def paint_enemy_knight(img):
    for pname, faces in SKIN.items():
        paint_part(img, faces, EK_STEEL, EK_STEEL_HI, EK_STEEL_LO)

    # HEAD: dark helmet, narrow visor, red eyes
    hx, hy = 8, 8
    fill(img, hx, hy, 8, 8, EK_STEEL)
    hl(img, hx, hy, 8, EK_STEEL_HI)
    # Narrow visor (1 row)
    hl(img, hx+1, hy+3, 6, EK_DARK)
    px(img, hx+2, hy+3, EK_EYE)
    px(img, hx+5, hy+3, EK_EYE)
    # Scratches/damage
    px(img, hx+6, hy+1, EK_STEEL_LO)
    px(img, hx+5, hy+2, EK_STEEL_LO)
    hl(img, hx, hy+7, 8, EK_STEEL_LO)
    vl(img, hx+7, hy, 8, EK_STEEL_LO)

    # Head top: dark with small horn nubs
    fill(img, 8, 0, 8, 8, EK_STEEL)
    px(img, 10, 0, EK_STEEL_HI)  # horn
    px(img, 13, 0, EK_STEEL_HI)  # horn

    # BODY: dark steel with red accents
    bx, by = 20, 20
    fill(img, bx, by, 8, 12, EK_STEEL)
    hl(img, bx, by, 8, EK_STEEL_HI)
    vl(img, bx, by, 12, EK_STEEL_HI)
    # Crimson X mark (corrupted)
    px(img, bx+2, by+3, EK_RED); px(img, bx+5, by+3, EK_RED)
    px(img, bx+3, by+4, EK_RED); px(img, bx+4, by+4, EK_RED)
    px(img, bx+3, by+5, EK_RED); px(img, bx+4, by+5, EK_RED)
    px(img, bx+2, by+6, EK_RED); px(img, bx+5, by+6, EK_RED)
    # Belt
    hl(img, bx, by+9, 8, EK_DARK)
    # Bottom
    hl(img, bx, by+11, 8, EK_STEEL_LO)
    vl(img, bx+7, by, 12, EK_STEEL_LO)

    # Body back: dark, no cape
    bkx = 32
    fill(img, bkx, 20, 8, 12, EK_STEEL_LO)
    # Scratch marks
    vl(img, bkx+2, 22, 6, EK_DARK)
    vl(img, bkx+5, 23, 5, EK_DARK)

    # Arms: dark steel
    for part in ARM_PARTS:
        f = SKIN[part]['front']
        shade(img, *f, EK_STEEL, EK_STEEL_HI, EK_STEEL_LO)
        # Red accent stripe
        vl(img, f[0]+1, f[1]+2, 4, EK_RED_LO)

    # Legs: dark steel with dark boots
    for part in LEG_PARTS:
        f = SKIN[part]['front']
        fx, fy, fw, fh = f
        shade(img, fx, fy, fw, fh, EK_STEEL, EK_STEEL_HI, EK_STEEL_LO)
        fill(img, fx, fy+fh-4, fw, 4, EK_STEEL_LO)
        hl(img, fx, fy+fh-4, fw, EK_STEEL)

    return img

# ---- Ally Archer ----
def paint_ally_archer(img):
    for pname, faces in SKIN.items():
        paint_part(img, faces, AA_GREEN, AA_GREEN_HI, AA_GREEN_LO)

    # HEAD: green hood, visible face
    hx, hy = 8, 8
    # Hood top portion (rows 0-2)
    fill(img, hx, hy, 8, 3, AA_GREEN)
    hl(img, hx, hy, 8, AA_GREEN_HI)
    # Hood shadow line
    hl(img, hx+1, hy+2, 6, AA_GREEN_LO)
    # Face (rows 3-7)
    fill(img, hx+1, hy+3, 6, 4, AA_SKIN)
    px(img, hx, hy+3, AA_GREEN); px(img, hx+7, hy+3, AA_GREEN)  # hood wraps
    px(img, hx, hy+4, AA_GREEN); px(img, hx+7, hy+4, AA_GREEN)
    px(img, hx, hy+5, AA_GREEN); px(img, hx+7, hy+5, AA_GREEN)
    # Eyes
    px(img, hx+2, hy+4, AA_EYE)
    px(img, hx+5, hy+4, AA_EYE)
    # Mouth line
    hl(img, hx+3, hy+6, 2, AA_SKIN_LO)
    # Chin
    fill(img, hx, hy+7, 8, 1, AA_GREEN_LO)

    # Head top: all hood
    fill(img, 8, 0, 8, 8, AA_GREEN)
    hl(img, 8, 0, 8, AA_GREEN_HI)

    # Head sides: hood with face peek
    for face_n in ['right','left']:
        fx, fy, fw, fh = SKIN['head'][face_n]
        fill(img, fx, fy, fw, fh, AA_GREEN)
        fill(img, fx, fy+3, fw, 4, AA_GREEN_LO)
        fill(img, fx+2, fy+3, fw-3, 3, AA_SKIN)

    # Head back: hood with drawstring
    bkf = SKIN['head']['back']
    fill(img, bkf[0], bkf[1], bkf[2], bkf[3], AA_GREEN)
    px(img, bkf[0]+3, bkf[1]+6, AA_GREEN_LO)
    px(img, bkf[0]+4, bkf[1]+6, AA_GREEN_LO)

    # BODY: leather tunic with quiver strap
    bx, by = 20, 20
    fill(img, bx, by, 8, 12, AA_TAN)
    hl(img, bx, by, 8, AA_TAN_HI)
    vl(img, bx, by, 12, AA_TAN_HI)
    # Green collar
    hl(img, bx+1, by, 6, AA_GREEN)
    # Quiver strap diagonal (top-right to bottom-left)
    px(img, bx+6, by+1, AA_QUIVER)
    px(img, bx+5, by+2, AA_QUIVER)
    px(img, bx+4, by+3, AA_QUIVER)
    px(img, bx+3, by+4, AA_QUIVER)
    px(img, bx+2, by+5, AA_QUIVER)
    px(img, bx+1, by+6, AA_QUIVER)
    # Belt
    hl(img, bx, by+8, 8, AA_LEATH)
    px(img, bx+3, by+8, AA_GREEN_HI)   # buckle
    # Lower tunic
    fill(img, bx, by+9, 8, 3, AA_TAN_LO)
    hl(img, bx, by+11, 8, AA_TAN_LO)
    vl(img, bx+7, by, 12, AA_TAN_LO)

    # Body back: quiver with arrows
    bkx, bky = 32, 20
    fill(img, bkx, bky, 8, 12, AA_TAN)
    hl(img, bkx, bky, 8, AA_TAN_HI)
    # Quiver body (upper right)
    fill(img, bkx+5, bky+1, 2, 6, AA_QUIVER)
    # Arrow shafts
    vl(img, bkx+5, bky+1, 5, AA_ARROW)
    vl(img, bkx+6, bky+1, 4, AA_ARROW)
    # Fletching
    px(img, bkx+5, bky+1, AA_FLETCH)
    px(img, bkx+6, bky+1, AA_FLETCH)
    # Strap
    px(img, bkx+4, bky+2, AA_QUIVER)
    px(img, bkx+3, bky+3, AA_QUIVER)
    hl(img, bkx, bky+11, 8, AA_TAN_LO)

    # Arms: green sleeves with leather bracers
    for part in ARM_PARTS:
        f = SKIN[part]['front']
        fx, fy, fw, fh = f
        shade(img, fx, fy, fw, fh, AA_GREEN, AA_GREEN_HI, AA_GREEN_LO)
        # Leather bracer (bottom 4 rows)
        fill(img, fx, fy+fh-4, fw, 4, AA_LEATH)
        hl(img, fx, fy+fh-4, fw, AA_LEATH_HI)
        hl(img, fx, fy+fh-3, fw, AA_LEATH_LO)  # wrap line
        hl(img, fx, fy+fh-1, fw, AA_LEATH_LO)

    # Legs: green with leather boots
    for part in LEG_PARTS:
        f = SKIN[part]['front']
        fx, fy, fw, fh = f
        shade(img, fx, fy, fw, fh, AA_GREEN, AA_GREEN_HI, AA_GREEN_LO)
        fill(img, fx, fy+fh-5, fw, 5, AA_LEATH)
        hl(img, fx, fy+fh-5, fw, AA_LEATH_HI)
        hl(img, fx, fy+fh-1, fw, AA_LEATH_LO)

    return img

# ---- Enemy Archer ----
def paint_enemy_archer(img):
    for pname, faces in SKIN.items():
        paint_part(img, faces, EA_GREEN, EA_GREEN_HI, EA_GREEN_LO)

    # HEAD: dark hood, face hidden, slit eyes
    hx, hy = 8, 8
    fill(img, hx, hy, 8, 8, EA_GREEN)
    hl(img, hx, hy, 8, EA_GREEN_HI)
    # Heavy shadow over face
    fill(img, hx+1, hy+3, 6, 4, EA_GREEN_LO)
    # Slit eyes (just 1px each, menacing)
    px(img, hx+2, hy+4, EA_EYE)
    px(img, hx+5, hy+4, EA_EYE)
    hl(img, hx, hy+7, 8, EA_GREEN_LO)
    vl(img, hx+7, hy, 8, EA_GREEN_LO)

    # Head top
    fill(img, 8, 0, 8, 8, EA_GREEN)

    # BODY: dark maroon with quiver strap
    bx, by = 20, 20
    fill(img, bx, by, 8, 12, EA_MAROON)
    hl(img, bx, by, 8, EA_MAROON_HI)
    # Quiver strap
    px(img, bx+6, by+1, EA_LEATH_LO)
    px(img, bx+5, by+2, EA_LEATH_LO)
    px(img, bx+4, by+3, EA_LEATH_LO)
    px(img, bx+3, by+4, EA_LEATH_LO)
    px(img, bx+2, by+5, EA_LEATH_LO)
    # Belt
    hl(img, bx, by+8, 8, EA_LEATH_LO)
    hl(img, bx, by+11, 8, EA_MAROON_LO)
    vl(img, bx+7, by, 12, EA_MAROON_LO)

    # Body back: dark quiver
    bkx, bky = 32, 20
    fill(img, bkx, bky, 8, 12, EA_MAROON_LO)
    fill(img, bkx+5, bky+1, 2, 6, EA_LEATH_LO)
    vl(img, bkx+5, bky+1, 5, EA_LEATH)
    vl(img, bkx+6, bky+1, 4, EA_LEATH)
    # Dark fletching
    px(img, bkx+5, bky+1, EA_MAROON)
    px(img, bkx+6, bky+1, EA_MAROON)

    # Arms: dark with leather bracers
    for part in ARM_PARTS:
        f = SKIN[part]['front']
        fx, fy, fw, fh = f
        shade(img, fx, fy, fw, fh, EA_GREEN, EA_GREEN_HI, EA_GREEN_LO)
        fill(img, fx, fy+fh-4, fw, 4, EA_LEATH)
        hl(img, fx, fy+fh-4, fw, EA_LEATH_HI)

    # Legs: dark with dark boots
    for part in LEG_PARTS:
        f = SKIN[part]['front']
        fx, fy, fw, fh = f
        shade(img, fx, fy, fw, fh, EA_MAROON, EA_MAROON_HI, EA_MAROON_LO)
        fill(img, fx, fy+fh-5, fw, 5, EA_LEATH)
        hl(img, fx, fy+fh-5, fw, EA_LEATH_HI)

    return img

# ---- Ally Wizard ----
def paint_ally_wizard(img):
    for pname, faces in SKIN.items():
        paint_part(img, faces, AW_PURP, AW_PURP_HI, AW_PURP_LO)

    # HEAD: pointed hat with gold brim, visible face, white beard
    hx, hy = 8, 8
    # Hat (top 3 rows)
    fill(img, hx, hy, 8, 3, AW_PURP)
    hl(img, hx, hy, 8, AW_PURP_HI)
    hl(img, hx+1, hy+1, 6, AW_PURP_HI)
    # Gold brim line
    hl(img, hx, hy+2, 8, AW_GOLD)
    # Face (row 3-4)
    fill(img, hx+1, hy+3, 6, 2, AW_SKIN)
    px(img, hx, hy+3, AW_PURP_LO)
    px(img, hx+7, hy+3, AW_PURP_LO)
    # Eyes
    px(img, hx+2, hy+3, (50, 50, 80, 255))
    px(img, hx+5, hy+3, (50, 50, 80, 255))
    # Beard (rows 5-7)
    fill(img, hx+1, hy+5, 6, 2, AW_BEARD)
    fill(img, hx+2, hy+4, 4, 1, AW_BEARD_HI)  # upper beard
    px(img, hx, hy+5, AW_PURP_LO)
    px(img, hx+7, hy+5, AW_PURP_LO)
    fill(img, hx+2, hy+6, 4, 1, AW_BEARD)
    fill(img, hx+3, hy+7, 2, 1, AW_BEARD_LO)

    # Head top: pointed hat (triangle on top face)
    tx, ty = 8, 0
    fill(img, tx, ty, 8, 8, AW_PURP)
    # Hat point: narrowing toward center
    fill(img, tx+2, ty, 4, 2, AW_PURP_HI)
    fill(img, tx+3, ty, 2, 1, AW_PURP_HI)
    # Gold band on edges
    hl(img, tx, ty+7, 8, AW_GOLD)

    # BODY: purple robes with gold accents
    bx, by = 20, 20
    fill(img, bx, by, 8, 12, AW_PURP)
    hl(img, bx, by, 8, AW_PURP_HI)
    vl(img, bx, by, 12, AW_PURP_HI)
    # Gold collar
    hl(img, bx+1, by, 6, AW_GOLD)
    # Robe fold lines
    vl(img, bx+2, by+2, 8, AW_PURP_LO)
    vl(img, bx+5, by+2, 8, AW_PURP_LO)
    # Gold star emblem on chest
    px(img, bx+3, by+3, AW_GOLD)  # center
    px(img, bx+4, by+3, AW_GOLD)  # center
    px(img, bx+3, by+2, AW_GOLD)  # top
    px(img, bx+4, by+4, AW_GOLD)  # bottom
    px(img, bx+2, by+3, AW_GOLD)  # left
    px(img, bx+5, by+3, AW_GOLD)  # right
    # Gold belt/sash
    hl(img, bx, by+7, 8, AW_GOLD)
    hl(img, bx+1, by+7, 6, AW_GOLD_LO)
    # Robe hem
    hl(img, bx, by+11, 8, AW_PURP_LO)
    # Gold trim at bottom
    hl(img, bx+1, by+11, 6, AW_GOLD_LO)
    vl(img, bx+7, by, 12, AW_PURP_LO)

    # Body back: robe with fold lines
    bkx, bky = 32, 20
    fill(img, bkx, bky, 8, 12, AW_PURP_LO)
    vl(img, bkx+2, bky+1, 10, AW_PURP)
    vl(img, bkx+5, bky+1, 10, AW_PURP)
    hl(img, bkx+1, bky+11, 6, AW_GOLD_LO)

    # Arms: purple robe sleeves, cyan-tinted hands
    for part in ARM_PARTS:
        f = SKIN[part]['front']
        fx, fy, fw, fh = f
        shade(img, fx, fy, fw, fh, AW_PURP, AW_PURP_HI, AW_PURP_LO)
        # Wide sleeve opening at bottom
        hl(img, fx, fy+fh-2, fw, AW_PURP_HI)
        # Cyan glowing hands
        fill(img, fx, fy+fh-2, fw, 2, AW_CYAN)
        hl(img, fx, fy+fh-1, fw, AW_CYAN_LO)

    # Legs: purple robe continuation
    for part in LEG_PARTS:
        f = SKIN[part]['front']
        fx, fy, fw, fh = f
        shade(img, fx, fy, fw, fh, AW_PURP, AW_PURP_HI, AW_PURP_LO)
        # Robe continuation with fold
        vl(img, fx+1, fy+1, fh-2, AW_PURP_LO)
        # Dark boots peeking out at bottom
        fill(img, fx, fy+fh-2, fw, 2, AW_PURP_LO)

    return img

# ---- Enemy Wizard ----
def paint_enemy_wizard(img):
    for pname, faces in SKIN.items():
        paint_part(img, faces, EW_DARK, EW_DARK_HI, EW_DARK_LO)

    # HEAD: deep hood, only red eyes visible
    hx, hy = 8, 8
    fill(img, hx, hy, 8, 8, EW_DARK)
    hl(img, hx, hy, 8, EW_DARK_HI)
    # Hood covers most of face
    fill(img, hx+1, hy+3, 6, 4, EW_SHADOW)
    # Glowing red eyes
    px(img, hx+2, hy+4, EW_EYE)
    px(img, hx+5, hy+4, EW_EYE)
    # Red glow halo around eyes
    px(img, hx+1, hy+4, (80, 10, 20, 255))
    px(img, hx+6, hy+4, (80, 10, 20, 255))
    px(img, hx+2, hy+3, (60, 5, 15, 255))
    px(img, hx+5, hy+3, (60, 5, 15, 255))
    hl(img, hx, hy+7, 8, EW_DARK_LO)
    vl(img, hx+7, hy, 8, EW_DARK_LO)

    # Head top: dark hood
    fill(img, 8, 0, 8, 8, EW_DARK)

    # BODY: near-black robes with red runes
    bx, by = 20, 20
    fill(img, bx, by, 8, 12, EW_DARK)
    hl(img, bx, by, 8, EW_DARK_HI)
    # Robe fold lines (barely visible)
    vl(img, bx+2, by+2, 8, EW_DARK_LO)
    vl(img, bx+5, by+2, 8, EW_DARK_LO)
    # Red rune symbol on chest
    px(img, bx+3, by+3, EW_RED); px(img, bx+4, by+3, EW_RED)
    px(img, bx+2, by+4, EW_RED); px(img, bx+5, by+4, EW_RED)
    px(img, bx+3, by+5, EW_RED); px(img, bx+4, by+5, EW_RED)
    # Dark red belt
    hl(img, bx, by+7, 8, EW_RED)
    # Bottom hem
    hl(img, bx, by+11, 8, EW_DARK_LO)
    vl(img, bx+7, by, 12, EW_DARK_LO)

    # Body back: skull motif
    bkx, bky = 32, 20
    fill(img, bkx, bky, 8, 12, EW_DARK_LO)
    # Subtle skull
    px(img, bkx+2, bky+3, EW_DARK_HI); px(img, bkx+5, bky+3, EW_DARK_HI)  # eyes
    px(img, bkx+3, bky+4, EW_DARK_HI); px(img, bkx+4, bky+4, EW_DARK_HI)  # nose
    hl(img, bkx+2, bky+5, 4, EW_DARK_HI)  # jaw

    # Arms: dark robes, fire hands
    for part in ARM_PARTS:
        f = SKIN[part]['front']
        fx, fy, fw, fh = f
        shade(img, fx, fy, fw, fh, EW_DARK, EW_DARK_HI, EW_DARK_LO)
        # Fire glowing hands
        fill(img, fx, fy+fh-2, fw, 2, EW_FIRE)
        px(img, fx+1, fy+fh-2, EW_FIRE_HI)
        hl(img, fx, fy+fh-1, fw, EW_FIRE_LO)

    # Legs: dark robes
    for part in LEG_PARTS:
        f = SKIN[part]['front']
        fx, fy, fw, fh = f
        shade(img, fx, fy, fw, fh, EW_DARK, EW_DARK_HI, EW_DARK_LO)
        vl(img, fx+1, fy+1, fh-2, EW_DARK_LO)

    return img

# ---- Ally Dark Knight ----
def paint_ally_dark_knight(img):
    for pname, faces in SKIN.items():
        paint_part(img, faces, AD_NAVY, AD_NAVY_HI, AD_NAVY_LO)

    # HEAD: navy helmet with blue visor glow
    hx, hy = 8, 8
    fill(img, hx, hy, 8, 8, AD_NAVY)
    hl(img, hx, hy, 8, AD_NAVY_HI)
    hl(img, hx, hy+1, 8, AD_NAVY_HI)
    # Wide glowing visor (2 rows)
    hl(img, hx+1, hy+3, 6, AD_BLUE)
    hl(img, hx+1, hy+4, 6, AD_BLUE_LO)
    # Bright glow center
    px(img, hx+3, hy+3, AD_BLUE_HI)
    px(img, hx+4, hy+3, AD_BLUE_HI)
    # Cheek guards
    vl(img, hx, hy+3, 4, AD_NAVY_HI)
    vl(img, hx+7, hy+3, 4, AD_NAVY_LO)
    hl(img, hx, hy+7, 8, AD_NAVY_LO)

    # Head top
    fill(img, 8, 0, 8, 8, AD_NAVY)
    hl(img, 8, 0, 8, AD_NAVY_HI)

    # BODY: navy plate with blue energy lines
    bx, by = 20, 20
    fill(img, bx, by, 8, 12, AD_NAVY)
    hl(img, bx, by, 8, AD_NAVY_HI)
    vl(img, bx, by, 12, AD_NAVY_HI)
    # Blue diamond emblem
    px(img, bx+3, by+2, AD_BLUE)
    px(img, bx+4, by+2, AD_BLUE)
    px(img, bx+2, by+3, AD_BLUE); px(img, bx+5, by+3, AD_BLUE)
    px(img, bx+3, by+3, AD_BLUE_HI); px(img, bx+4, by+3, AD_BLUE_HI)
    px(img, bx+2, by+4, AD_BLUE); px(img, bx+5, by+4, AD_BLUE)
    px(img, bx+3, by+5, AD_BLUE)
    px(img, bx+4, by+5, AD_BLUE)
    # Plate lines
    hl(img, bx, by+6, 8, AD_NAVY_LO)
    hl(img, bx, by+9, 8, AD_NAVY_LO)
    # Silver pauldron rivets
    px(img, bx, by+1, AD_SILVER)
    px(img, bx+7, by+1, AD_SILVER)
    # Bottom
    hl(img, bx, by+11, 8, AD_NAVY_LO)
    vl(img, bx+7, by, 12, AD_NAVY_LO)

    # Body back: dark blue cape
    bkx, bky = 32, 20
    fill(img, bkx, bky, 8, 12, AD_NAVY_LO)
    hl(img, bkx, bky, 8, AD_BLUE_LO)
    vl(img, bkx+3, bky+1, 10, AD_NAVY)
    vl(img, bkx+5, bky+1, 10, AD_NAVY)

    # Arms: navy with blue energy stripe
    for part in ARM_PARTS:
        f = SKIN[part]['front']
        fx, fy, fw, fh = f
        shade(img, fx, fy, fw, fh, AD_NAVY, AD_NAVY_HI, AD_NAVY_LO)
        vl(img, fx+1, fy+2, 6, AD_BLUE)
        # Gauntlets
        fill(img, fx, fy+fh-3, fw, 3, AD_NAVY_LO)
        hl(img, fx, fy+fh-3, fw, AD_NAVY)

    # Legs: navy with silver toe caps
    for part in LEG_PARTS:
        f = SKIN[part]['front']
        fx, fy, fw, fh = f
        shade(img, fx, fy, fw, fh, AD_NAVY, AD_NAVY_HI, AD_NAVY_LO)
        fill(img, fx, fy+fh-4, fw, 4, AD_NAVY_LO)
        hl(img, fx, fy+fh-4, fw, AD_NAVY)
        px(img, fx+1, fy+fh-1, AD_SILVER)
        px(img, fx+2, fy+fh-1, AD_SILVER)

    return img

# ---- Enemy Dark Knight ----
def paint_enemy_dark_knight(img):
    for pname, faces in SKIN.items():
        paint_part(img, faces, ED_BLACK, ED_BLACK_HI, ED_BLACK_LO)

    # HEAD: black helmet, narrow red visor, horn nubs
    hx, hy = 8, 8
    fill(img, hx, hy, 8, 8, ED_BLACK)
    hl(img, hx, hy, 8, ED_BLACK_HI)
    # Narrow visor slit (1 row)
    hl(img, hx+1, hy+3, 6, (20, 5, 5, 255))
    px(img, hx+2, hy+3, ED_CRIM_HI)
    px(img, hx+5, hy+3, ED_CRIM_HI)
    # Red glow halo
    px(img, hx+1, hy+3, ED_CRIM)
    px(img, hx+6, hy+3, ED_CRIM)
    # Asymmetric damage
    px(img, hx+6, hy+1, ED_RUST)
    px(img, hx+5, hy+2, ED_RUST)
    px(img, hx+1, hy+6, ED_RUST)
    hl(img, hx, hy+7, 8, ED_BLACK_LO)

    # Head top: horn nubs
    fill(img, 8, 0, 8, 8, ED_BLACK)
    px(img, 10, 0, ED_BLACK_HI)
    px(img, 13, 0, ED_BLACK_HI)
    px(img, 10, 1, ED_BLACK_HI)
    px(img, 13, 1, ED_BLACK_HI)

    # BODY: black plate, crimson accents, asymmetric damage
    bx, by = 20, 20
    fill(img, bx, by, 8, 12, ED_BLACK)
    hl(img, bx, by, 8, ED_BLACK_HI)
    # Crimson slash mark (asymmetric)
    px(img, bx+2, by+3, ED_CRIM)
    px(img, bx+3, by+4, ED_CRIM)
    px(img, bx+4, by+5, ED_CRIM)
    px(img, bx+5, by+4, ED_CRIM)
    px(img, bx+4, by+3, ED_CRIM)
    # Rust patches
    px(img, bx+6, by+2, ED_RUST)
    px(img, bx+1, by+7, ED_RUST)
    px(img, bx+6, by+8, ED_RUST)
    # Jagged plate lines
    hl(img, bx, by+6, 4, ED_BLACK_LO)
    hl(img, bx+4, by+7, 4, ED_BLACK_LO)
    # Spiked shoulders
    px(img, bx, by+1, ED_CRIM)
    px(img, bx+7, by+1, ED_CRIM)
    hl(img, bx, by+11, 8, ED_BLACK_LO)
    vl(img, bx+7, by, 12, ED_BLACK_LO)

    # Body back: scratch marks
    bkx, bky = 32, 20
    fill(img, bkx, bky, 8, 12, ED_BLACK_LO)
    vl(img, bkx+2, bky+2, 6, ED_RUST)
    vl(img, bkx+5, bky+3, 5, ED_RUST)

    # Arms: black with crimson accent
    for part in ARM_PARTS:
        f = SKIN[part]['front']
        fx, fy, fw, fh = f
        shade(img, fx, fy, fw, fh, ED_BLACK, ED_BLACK_HI, ED_BLACK_LO)
        vl(img, fx+1, fy+2, 4, ED_CRIM)

    # Legs: black
    for part in LEG_PARTS:
        f = SKIN[part]['front']
        fx, fy, fw, fh = f
        shade(img, fx, fy, fw, fh, ED_BLACK, ED_BLACK_HI, ED_BLACK_LO)
        fill(img, fx, fy+fh-4, fw, 4, ED_BLACK_LO)

    return img

# ---- Boss: Siege Lord ----
def paint_boss_siege_lord(img):
    for pname, faces in SKIN.items():
        paint_part(img, faces, SL_BLACK, SL_BLACK_HI, SL_BLACK_LO)

    # HEAD: black helmet with GOLD CROWN and dual eye slits
    hx, hy = 8, 8
    fill(img, hx, hy, 8, 8, SL_BLACK)
    hl(img, hx, hy, 8, SL_BLACK_HI)
    # Gold jaw trim
    hl(img, hx, hy+7, 8, SL_GOLD)
    # Two separate eye slits (not one visor)
    px(img, hx+1, hy+3, SL_CRIM); px(img, hx+2, hy+3, SL_CRIM_HI)
    px(img, hx+5, hy+3, SL_CRIM_HI); px(img, hx+6, hy+3, SL_CRIM)
    # Red glow around eyes
    px(img, hx+1, hy+2, (60, 0, 0, 255))
    px(img, hx+2, hy+2, (80, 5, 5, 255))
    px(img, hx+5, hy+2, (80, 5, 5, 255))
    px(img, hx+6, hy+2, (60, 0, 0, 255))
    # Gold horn suggestions at upper corners
    px(img, hx, hy, SL_GOLD_HI); px(img, hx+1, hy, SL_GOLD)
    px(img, hx+6, hy, SL_GOLD); px(img, hx+7, hy, SL_GOLD_HI)
    px(img, hx, hy+1, SL_GOLD)
    px(img, hx+7, hy+1, SL_GOLD)

    # Head top: GOLD CROWN zigzag
    tx, ty = 8, 0
    fill(img, tx, ty, 8, 8, SL_BLACK)
    # Crown crenellation along front edge
    hl(img, tx, ty+6, 8, SL_GOLD)
    hl(img, tx, ty+7, 8, SL_GOLD_HI)
    px(img, tx, ty+5, SL_GOLD_HI)
    px(img, tx+2, ty+5, SL_GOLD_HI)
    px(img, tx+4, ty+5, SL_GOLD_HI)
    px(img, tx+6, ty+5, SL_GOLD_HI)
    px(img, tx+1, ty+4, SL_GOLD)
    px(img, tx+3, ty+4, SL_GOLD)
    px(img, tx+5, ty+4, SL_GOLD)
    px(img, tx+7, ty+4, SL_GOLD)

    # Head sides: gold trim
    for fn in ['right','left']:
        fx, fy, fw, fh = SKIN['head'][fn]
        fill(img, fx, fy, fw, fh, SL_BLACK)
        hl(img, fx, fy+fh-1, fw, SL_GOLD)

    # BODY: black plate, gold borders, crimson skull emblem
    bx, by = 20, 20
    fill(img, bx, by, 8, 12, SL_BLACK)
    # Gold top border
    hl(img, bx, by, 8, SL_GOLD)
    # Gold side borders
    vl(img, bx, by, 12, SL_GOLD_LO)
    vl(img, bx+7, by, 12, SL_GOLD_LO)
    # Crimson skull emblem in gold frame
    # Gold frame
    hl(img, bx+1, by+2, 6, SL_GOLD_LO)
    hl(img, bx+1, by+7, 6, SL_GOLD_LO)
    vl(img, bx+1, by+2, 6, SL_GOLD_LO)
    vl(img, bx+6, by+2, 6, SL_GOLD_LO)
    # Skull face
    px(img, bx+2, by+3, SL_CRIM_HI); px(img, bx+5, by+3, SL_CRIM_HI)  # eyes
    px(img, bx+3, by+4, SL_CRIM); px(img, bx+4, by+4, SL_CRIM)        # nose
    px(img, bx+3, by+5, SL_CRIM_HI); px(img, bx+4, by+5, SL_CRIM_HI)  # jaw
    px(img, bx+2, by+5, SL_CRIM); px(img, bx+5, by+5, SL_CRIM)        # jaw sides
    px(img, bx+2, by+6, SL_CRIM); px(img, bx+5, by+6, SL_CRIM)        # teeth
    px(img, bx+3, by+6, SL_CRIM_HI); px(img, bx+4, by+6, SL_CRIM_HI)  # teeth
    # Gold belt
    hl(img, bx, by+8, 8, SL_GOLD)
    px(img, bx+3, by+8, SL_GOLD_HI)
    px(img, bx+4, by+8, SL_GOLD_HI)
    # Bottom
    hl(img, bx, by+11, 8, SL_GOLD_LO)

    # Body back: gold trim, crimson war cloak
    bkx, bky = 32, 20
    fill(img, bkx, bky, 8, 12, SL_CRIM)
    hl(img, bkx, bky, 8, SL_GOLD)
    vl(img, bkx, bky, 12, SL_GOLD_LO)
    vl(img, bkx+7, bky, 12, SL_GOLD_LO)
    # Cloak fold lines
    vl(img, bkx+2, bky+2, 8, (120, 0, 0, 255))
    vl(img, bkx+5, bky+2, 8, (120, 0, 0, 255))
    hl(img, bkx, bky+11, 8, SL_GOLD_LO)

    # Arms: black with gold trim and crimson accent
    for part in ARM_PARTS:
        f = SKIN[part]['front']
        fx, fy, fw, fh = f
        shade(img, fx, fy, fw, fh, SL_BLACK, SL_BLACK_HI, SL_BLACK_LO)
        # Gold shoulder trim
        hl(img, fx, fy, fw, SL_GOLD)
        # Crimson stripe
        vl(img, fx+1, fy+3, 4, SL_CRIM)
        # Gold wrist cuff
        hl(img, fx, fy+fh-3, fw, SL_GOLD_LO)
        # Dark gauntlets
        fill(img, fx, fy+fh-2, fw, 2, SL_BLACK_LO)

    # Legs: black with gold knee and boot trim
    for part in LEG_PARTS:
        f = SKIN[part]['front']
        fx, fy, fw, fh = f
        shade(img, fx, fy, fw, fh, SL_BLACK, SL_BLACK_HI, SL_BLACK_LO)
        # Gold kneecap
        px(img, fx+1, fy+4, SL_GOLD)
        px(img, fx+2, fy+4, SL_GOLD)
        px(img, fx+1, fy+5, SL_GOLD_LO)
        px(img, fx+2, fy+5, SL_GOLD_LO)
        # Gold boot trim
        hl(img, fx, fy+fh-4, fw, SL_GOLD_LO)
        # Dark boots
        fill(img, fx, fy+fh-3, fw, 3, SL_BLACK_LO)

    return img

# ====================================================================
#  ARMOR MODEL TEXTURES (64x32)
# ====================================================================

# For 64x32, same UV as skin top-half. Left limbs mirror right.
ARM_UV = _faces((40,16),(4,12,4))
LEG_UV = _faces((0,16),(4,12,4))
BODY_UV = _faces((16,16),(8,12,4))
HEAD_UV = _faces((0,0),(8,8,8))

def paint_armor_tier(main_img, legs_img, base, hi, lo, spec=None,
                     accent=None, accent2=None, chainmail=False,
                     stitch=False, trim_all=False, glow=False):
    """Paint armor model textures for one tier."""

    # --- MAIN texture: helmet, chestplate, arms, boots ---

    # Helmet (head region)
    for fn, (fx, fy, fw, fh) in HEAD_UV.items():
        if fn == 'front':
            shade(main_img, fx, fy, fw, fh, base, hi, lo)
            # Visor opening (bottom 3 rows of face)
            fill(main_img, fx+1, fy+fh-3, fw-2, 2, lo)
            if spec:
                px(main_img, fx+2, fy+1, spec)
            if trim_all and accent:
                hl(main_img, fx, fy+fh-1, fw, accent)
        elif fn == 'top':
            shade(main_img, fx, fy, fw, fh, hi, hi, base)
            if trim_all and accent:
                hl(main_img, fx, fy+fh-1, fw, accent)
        else:
            shade(main_img, fx, fy, fw, fh, base, hi, lo)
            if trim_all and accent:
                hl(main_img, fx, fy+fh-1, fw, accent)

    # Chestplate (body region)
    for fn, (fx, fy, fw, fh) in BODY_UV.items():
        if fn == 'front':
            if chainmail:
                # Checkerboard dither
                for py in range(fy, fy+fh):
                    for ppx in range(fx, fx+fw):
                        if (ppx + py) % 2 == 0:
                            main_img.putpixel((ppx, py), base)
                        else:
                            main_img.putpixel((ppx, py), lo)
                hl(main_img, fx, fy, fw, hi)
                hl(main_img, fx, fy+fh-1, fw, lo)
            else:
                shade(main_img, fx, fy, fw, fh, base, hi, lo)
            if stitch:
                vl(main_img, fx+2, fy+1, fh-2, lo)
                vl(main_img, fx+5, fy+1, fh-2, lo)
            if spec:
                px(main_img, fx+3, fy+2, spec)
                px(main_img, fx+4, fy+2, spec)
            if accent and not chainmail:
                hl(main_img, fx, fy+fh//2, fw, accent)  # belt
            if accent2:  # gem accent
                px(main_img, fx+3, fy+4, accent2)
                px(main_img, fx+4, fy+4, accent2)
            if trim_all and accent:
                hl(main_img, fx, fy, fw, accent)
                hl(main_img, fx, fy+fh-1, fw, accent)
                vl(main_img, fx, fy, fh, accent)
                vl(main_img, fx+fw-1, fy, fh, accent)
            if glow:
                px(main_img, fx+2, fy+3, (200, 160, 255, 255))
                px(main_img, fx+5, fy+3, (200, 160, 255, 255))
        else:
            shade(main_img, fx, fy, fw, fh, base, hi, lo)
            if chainmail:
                for py in range(fy+1, fy+fh-1):
                    for ppx in range(fx+1, fx+fw-1):
                        if (ppx + py) % 2 == 0:
                            main_img.putpixel((ppx, py), base)
                        else:
                            main_img.putpixel((ppx, py), lo)

    # Arms (right arm region, mirrored for left)
    for fn, (fx, fy, fw, fh) in ARM_UV.items():
        if chainmail:
            for py in range(fy, fy+fh):
                for ppx in range(fx, fx+fw):
                    if (ppx + py) % 2 == 0:
                        main_img.putpixel((ppx, py), base)
                    else:
                        main_img.putpixel((ppx, py), lo)
        else:
            shade(main_img, fx, fy, fw, fh, base, hi, lo)
        if trim_all and accent:
            hl(main_img, fx, fy, fw, accent)

    # Boots (leg region)
    for fn, (fx, fy, fw, fh) in LEG_UV.items():
        shade(main_img, fx, fy, fw, fh, base, hi, lo)
        if trim_all and accent:
            hl(main_img, fx, fy, fw, accent)

    # --- LEGS texture: leggings ---
    for fn, (fx, fy, fw, fh) in BODY_UV.items():
        shade(legs_img, fx, fy, fw, fh, base, hi, lo)
        if chainmail and fn in ('front','back'):
            for py in range(fy+1, fy+fh-1):
                for ppx in range(fx+1, fx+fw-1):
                    if (ppx + py) % 2 == 0:
                        legs_img.putpixel((ppx, py), base)
                    else:
                        legs_img.putpixel((ppx, py), lo)

    for fn, (fx, fy, fw, fh) in LEG_UV.items():
        if chainmail:
            for py in range(fy, fy+fh):
                for ppx in range(fx, fx+fw):
                    if (ppx + py) % 2 == 0:
                        legs_img.putpixel((ppx, py), base)
                    else:
                        legs_img.putpixel((ppx, py), lo)
            hl(legs_img, fx, fy, fw, hi)
            hl(legs_img, fx, fy+fh-1, fw, lo)
        else:
            shade(legs_img, fx, fy, fw, fh, base, hi, lo)
        if stitch:
            vl(legs_img, fx+1, fy+1, fh-2, lo)
        if trim_all and accent:
            hl(legs_img, fx, fy, fw, accent)

# ====================================================================
#  ITEM ICON SHAPES (16x16 templates)
# ====================================================================

# Shape templates: '#' = filled, '.' = transparent
HELMET_SHAPE = [
    "................",
    "................",
    ".....######.....",
    "....########....",
    "...##########...",
    "...##########...",
    "...##########...",
    "...##########...",
    "...##########...",
    "...##########...",
    "...###....###...",
    "...##......##...",
    "....#......#....",
    "................",
    "................",
    "................",
]

CHEST_SHAPE = [
    "................",
    "................",
    "...##......##...",
    "...############.",  # wider shoulders
    "....##########..",
    "....##########..",
    "....##########..",
    "....##########..",
    "....##########..",
    "....##########..",
    "....##########..",
    ".....########...",
    ".....###..###...",
    "................",
    "................",
    "................",
]

LEGS_SHAPE = [
    "................",
    "................",
    "....##########..",
    "....##########..",
    "....##########..",
    "....####..####..",
    "....####..####..",
    "....####..####..",
    "....####..####..",
    "....####..####..",
    "....####..####..",
    "....####..####..",
    "....####..####..",
    "................",
    "................",
    "................",
]

BOOTS_SHAPE = [
    "................",
    "................",
    "................",
    "................",
    "................",
    "....###..###....",
    "....###..###....",
    "....###..###....",
    "....###..###....",
    "....###..###....",
    "...####..####...",
    "...####..####...",
    "..#####..#####..",
    "................",
    "................",
    "................",
]

TOKEN_SHAPE = [
    "................",
    "................",
    ".....######.....",
    "....########....",
    "...##########...",
    "...##......##...",
    "...##......##...",
    "...##......##...",
    "...##......##...",
    "...##......##...",
    "...##########...",
    "....########....",
    ".....######.....",
    "................",
    "................",
    "................",
]

BLUEPRINT_SHAPE = [
    "................",
    "...##########...",
    "..############..",
    "..##........##..",
    "..##........##..",
    "..##........##..",
    "..##........##..",
    "..##........##..",
    "..##........##..",
    "..##........##..",
    "..##........##..",
    "..##........##..",
    "..############..",
    "...##########...",
    "................",
    "................",
]

def paint_icon_from_shape(img, shape, base, hi, lo, outline=None):
    """Paint a 16x16 icon from a shape template with shading."""
    outline = outline or lo
    for y, row in enumerate(shape):
        for x, ch in enumerate(row):
            if ch == '#':
                # Determine if edge pixel
                above = y > 0 and shape[y-1][x] == '#'
                below = y < 15 and shape[y+1][x] == '#'
                left = x > 0 and shape[y][x-1] == '#'
                right = x < 15 and shape[y][x+1] == '#'

                if not above or not below or not left or not right:
                    # Edge pixel: check which edge for shading
                    if not above or not left:
                        img.putpixel((x, y), hi)
                    elif not below or not right:
                        img.putpixel((x, y), lo)
                    else:
                        img.putpixel((x, y), base)
                else:
                    img.putpixel((x, y), base)

def paint_icon_detail(img, shape, detail_pixels, color):
    """Add detail pixels on top of a shape."""
    for x, y in detail_pixels:
        if 0 <= y < 16 and 0 <= x < 16 and shape[y][x] == '#':
            img.putpixel((x, y), color)

# Token center symbols (relative pixel positions)
TOKEN_CROSS = [(7,5),(8,5),(7,6),(8,6),(6,7),(9,7),(7,7),(8,7),(6,8),(9,8),(7,8),(8,8),(7,9),(8,9),(7,10),(8,10)]
TOKEN_STAR = [(7,5),(8,5),(6,6),(9,6),(7,6),(8,6),(5,7),(6,7),(7,7),(8,7),(9,7),(10,7),(5,8),(6,8),(7,8),(8,8),(9,8),(10,8),(6,9),(9,9),(7,9),(8,9),(7,10),(8,10)]
TOKEN_CROWN = [(5,6),(6,5),(7,6),(8,6),(9,5),(10,6),(5,7),(6,7),(7,7),(8,7),(9,7),(10,7),(5,8),(6,8),(7,8),(8,8),(9,8),(10,8),(5,9),(6,9),(7,9),(8,9),(9,9),(10,9)]

# Blueprint inner drawings
BP_TOWER = [(7,4),(8,4),(7,5),(8,5),(6,6),(7,6),(8,6),(9,6),(6,7),(7,7),(8,7),(9,7),(7,8),(8,8),(7,9),(8,9),(7,10),(8,10),(7,11),(8,11)]
BP_GATE = [(5,4),(6,4),(9,4),(10,4),(5,5),(6,5),(9,5),(10,5),(5,6),(6,6),(7,6),(8,6),(9,6),(10,6),(5,7),(6,7),(7,7),(8,7),(9,7),(10,7),(5,8),(6,8),(9,8),(10,8),(5,9),(6,9),(9,9),(10,9),(5,10),(6,10),(7,10),(8,10),(9,10),(10,10)]
BP_HALL = [(4,5),(5,5),(6,5),(7,5),(8,5),(9,5),(10,5),(11,5),(4,6),(5,6),(6,6),(7,6),(8,6),(9,6),(10,6),(11,6),(5,7),(6,7),(7,7),(8,7),(9,7),(10,7),(5,8),(6,8),(7,8),(8,8),(9,8),(10,8),(5,9),(6,9),(7,9),(8,9),(9,9),(10,9),(5,10),(6,10),(7,10),(8,10),(9,10),(10,10)]

# ====================================================================
#  GENERATION FUNCTIONS
# ====================================================================

def generate_entity_skins():
    """Generate all 9 entity skin PNGs."""
    skins = {
        'mk_ally_knight':       paint_ally_knight,
        'mk_ally_archer':       paint_ally_archer,
        'mk_ally_wizard':       paint_ally_wizard,
        'mk_ally_dark_knight':  paint_ally_dark_knight,
        'mk_enemy_knight':      paint_enemy_knight,
        'mk_enemy_archer':      paint_enemy_archer,
        'mk_enemy_wizard':      paint_enemy_wizard,
        'mk_enemy_dark_knight': paint_enemy_dark_knight,
        'mk_boss_siege_lord':   paint_boss_siege_lord,
    }
    for name, painter in skins.items():
        img = new_skin()
        painter(img)
        path = os.path.join(ENTITY_DIR, f"{name}.png")
        img.save(path)
        print(f"  [skin] {name}.png")

def generate_armor_textures():
    """Generate all 10 armor model texture PNGs (5 tiers x 2 files)."""
    tiers = {
        'mk_page':        dict(base=PAGE, hi=PAGE_HI, lo=PAGE_LO, stitch=True),
        'mk_squire':      dict(base=SQUIRE, hi=SQUIRE_HI, lo=SQUIRE_LO, chainmail=True),
        'mk_knight':      dict(base=KNIGHT, hi=KNIGHT_HI, lo=KNIGHT_LO, spec=KNIGHT_SPEC),
        'mk_champion':    dict(base=CHAMP, hi=CHAMP_HI, lo=CHAMP_LO, spec=CHAMP_SPEC, accent=CHAMP_GEM, accent2=CHAMP_GEM),
        'mk_mega_knight': dict(base=MEGA, hi=MEGA_HI, lo=MEGA_LO, accent=MEGA_GOLD, trim_all=True, glow=True),
    }
    for name, params in tiers.items():
        main_img = new_armor_tex()
        legs_img = new_armor_tex()
        paint_armor_tier(main_img, legs_img, **params)
        main_img.save(os.path.join(ARMOR_DIR, f"{name}_main.png"))
        legs_img.save(os.path.join(ARMOR_DIR, f"{name}_legs.png"))
        print(f"  [armor] {name}_main.png + {name}_legs.png")

def generate_item_icons():
    """Generate all 27 item icon PNGs."""
    tier_colors = {
        'page':        (PAGE, PAGE_HI, PAGE_LO),
        'squire':      (SQUIRE, SQUIRE_HI, SQUIRE_LO),
        'knight':      (KNIGHT, KNIGHT_HI, KNIGHT_LO),
        'champion':    (CHAMP, CHAMP_HI, CHAMP_LO),
        'mega_knight': (MEGA, MEGA_HI, MEGA_LO),
    }

    # Armor piece icons
    pieces = {
        'helmet':     HELMET_SHAPE,
        'chestplate': CHEST_SHAPE,
        'leggings':   LEGS_SHAPE,
        'boots':      BOOTS_SHAPE,
    }

    for tier, (base, hi, lo) in tier_colors.items():
        for piece, shape in pieces.items():
            img = new_icon()
            paint_icon_from_shape(img, shape, base, hi, lo)
            # Add tier-specific details
            if tier == 'champion':
                # Gem accent on chestplate
                if piece == 'chestplate':
                    px(img, 7, 6, CHAMP_GEM)
                    px(img, 8, 6, CHAMP_GEM)
                # Crown point on helmet
                if piece == 'helmet':
                    px(img, 7, 2, CHAMP_HI)
                    px(img, 8, 2, CHAMP_HI)
            if tier == 'mega_knight':
                # Gold trim on all pieces
                for y_row, row in enumerate(shape):
                    for x_col, ch in enumerate(row):
                        if ch == '#':
                            above = y_row > 0 and shape[y_row-1][x_col] == '#'
                            if not above:
                                px(img, x_col, y_row, MEGA_GOLD)
                # Glow pixel
                if piece == 'chestplate':
                    px(img, 7, 6, MEGA_GLOW)
                    px(img, 8, 6, MEGA_GLOW)
            name = f"mk_{tier}_{piece}"
            img.save(os.path.join(ITEMS_DIR, f"{name}.png"))
            print(f"  [item] {name}.png")

    # Token icons
    token_configs = [
        ('mk_squire_token',   SQUIRE, SQUIRE_HI, SQUIRE_LO, TOKEN_CROSS),
        ('mk_knight_token',   KNIGHT, KNIGHT_HI, KNIGHT_LO, TOKEN_CROSS),
        ('mk_champion_token', CHAMP,  CHAMP_HI,  CHAMP_LO,  TOKEN_STAR),
        ('mk_mega_knight_token', MEGA, MEGA_HI,  MEGA_LO,   TOKEN_CROWN),
    ]
    for name, base, hi, lo, symbol in token_configs:
        img = new_icon()
        paint_icon_from_shape(img, TOKEN_SHAPE, base, hi, lo)
        # Paint symbol in contrasting color
        sym_color = (255, 255, 255, 255) if base == MEGA else (255, 240, 200, 255)
        if base == MEGA:
            sym_color = MEGA_GOLD
        for sx, sy in symbol:
            if 0 <= sy < 16 and 0 <= sx < 16 and TOKEN_SHAPE[sy][sx] == '#':
                px(img, sx, sy, sym_color)
        img.save(os.path.join(ITEMS_DIR, f"{name}.png"))
        print(f"  [token] {name}.png")

    # Blueprint icons
    bp_paper    = (212, 228, 247, 255)  # light blue paper
    bp_paper_hi = (232, 242, 255, 255)
    bp_paper_lo = (170, 190, 220, 255)
    bp_ink      = (40,  70,  120, 255)  # dark blue ink
    bp_seal     = (180, 40,  40,  255)  # red wax seal

    bp_configs = [
        ('mk_blueprint_small_tower', BP_TOWER),
        ('mk_blueprint_gatehouse',   BP_GATE),
        ('mk_blueprint_great_hall',  BP_HALL),
    ]
    for name, drawing in bp_configs:
        img = new_icon()
        paint_icon_from_shape(img, BLUEPRINT_SHAPE, bp_paper, bp_paper_hi, bp_paper_lo)
        # Draw building outline
        for dx, dy in drawing:
            if 0 <= dy < 16 and 0 <= dx < 16 and BLUEPRINT_SHAPE[dy][dx] == '#':
                px(img, dx, dy, bp_ink)
        # Wax seal in corner
        px(img, 10, 10, bp_seal)
        px(img, 11, 10, bp_seal)
        px(img, 10, 11, bp_seal)
        px(img, 11, 11, bp_seal)
        img.save(os.path.join(ITEMS_DIR, f"{name}.png"))
        print(f"  [blueprint] {name}.png")

# ====================================================================
#  MAIN
# ====================================================================

def main():
    print("Generating Mega Knights textures...")
    print()

    os.makedirs(ENTITY_DIR, exist_ok=True)
    os.makedirs(ITEMS_DIR, exist_ok=True)
    os.makedirs(ARMOR_DIR, exist_ok=True)

    print("Entity skins (64x64):")
    generate_entity_skins()
    print()

    print("Armor model textures (64x32):")
    generate_armor_textures()
    print()

    print("Item icons (16x16):")
    generate_item_icons()
    print()

    print("Done! All 46 textures generated.")

if __name__ == '__main__':
    main()
