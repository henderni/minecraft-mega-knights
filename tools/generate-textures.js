#!/usr/bin/env node
/**
 * Generates improved 16x16 pixel art textures for tokens, blueprints, and scroll.
 * Run: node tools/generate-textures.js
 */
const { PNG } = require("pngjs");
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(
  __dirname,
  "..",
  "MegaKnights_RP",
  "textures",
  "items",
);

/** Create a 16x16 RGBA PNG */
function createPNG() {
  const png = new PNG({ width: 16, height: 16 });
  // Initialize fully transparent
  for (let i = 0; i < 16 * 16 * 4; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }
  return png;
}

/** Set pixel at (x, y) with RGBA */
function px(png, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= 16 || y < 0 || y >= 16) return;
  const idx = (y * 16 + x) * 4;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = a;
}

/** Fill rectangle */
function rect(png, x1, y1, x2, y2, r, g, b, a = 255) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      px(png, x, y, r, g, b, a);
    }
  }
}

/** Draw outline rectangle */
function outline(png, x1, y1, x2, y2, r, g, b, a = 255) {
  for (let x = x1; x <= x2; x++) {
    px(png, x, y1, r, g, b, a);
    px(png, x, y2, r, g, b, a);
  }
  for (let y = y1; y <= y2; y++) {
    px(png, x1, y, r, g, b, a);
    px(png, x2, y, r, g, b, a);
  }
}

/** Draw a circle-ish shape (medal/seal) */
function circle(png, cx, cy, r, cr, cg, cb, a = 255) {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r + r) {
        px(png, x, y, cr, cg, cb, a);
      }
    }
  }
}

/** Save PNG to file */
function save(png, filename) {
  const filepath = path.join(OUT_DIR, filename);
  const buffer = PNG.sync.write(png);
  fs.writeFileSync(filepath, buffer);
  console.log(`  Written: ${filepath}`);
}

// ─── TOKEN TEXTURES (medal/seal designs) ───────────────────────────

function generateToken(filename, colors) {
  const { dark, mid, light, accent } = colors;
  const png = createPNG();

  // Ribbon tails (bottom, V shape)
  px(png, 5, 13, ...dark);
  px(png, 4, 14, ...dark);
  px(png, 3, 15, ...dark);
  px(png, 10, 13, ...dark);
  px(png, 11, 14, ...dark);
  px(png, 12, 15, ...dark);
  // Ribbon inner
  px(png, 6, 13, ...mid);
  px(png, 5, 14, ...mid);
  px(png, 4, 15, ...mid);
  px(png, 9, 13, ...mid);
  px(png, 10, 14, ...mid);
  px(png, 11, 15, ...mid);

  // Ribbon top band
  rect(png, 5, 11, 10, 12, ...mid);
  rect(png, 6, 11, 9, 11, ...light);

  // Medal body (circular disc)
  circle(png, 7, 6, 5, ...mid);

  // Medal rim (darker outline)
  for (let angle = 0; angle < 360; angle += 5) {
    const rad = (angle * Math.PI) / 180;
    const mx = Math.round(7 + 5 * Math.cos(rad));
    const my = Math.round(6 + 5 * Math.sin(rad));
    px(png, mx, my, ...dark);
  }

  // Inner disc (lighter)
  circle(png, 7, 6, 3, ...light);

  // Center emblem (star/cross shape)
  px(png, 7, 4, ...accent);
  px(png, 7, 5, ...accent);
  px(png, 7, 6, ...accent);
  px(png, 7, 7, ...accent);
  px(png, 7, 8, ...accent);
  px(png, 6, 6, ...accent);
  px(png, 5, 6, ...accent);
  px(png, 8, 6, ...accent);
  px(png, 9, 6, ...accent);
  // Diagonal accents
  px(png, 6, 5, ...accent);
  px(png, 8, 5, ...accent);
  px(png, 6, 7, ...accent);
  px(png, 8, 7, ...accent);

  // Highlight on medal (top-left shine)
  px(png, 5, 3, 255, 255, 255, 100);
  px(png, 4, 4, 255, 255, 255, 80);

  save(png, filename);
}

console.log("Generating token textures...");

generateToken("mk_squire_token.png", {
  dark: [100, 100, 110],
  mid: [150, 150, 160],
  light: [190, 190, 200],
  accent: [80, 80, 90],
});

generateToken("mk_knight_token.png", {
  dark: [30, 60, 150],
  mid: [50, 100, 200],
  light: [100, 150, 230],
  accent: [20, 40, 120],
});

generateToken("mk_champion_token.png", {
  dark: [170, 120, 20],
  mid: [220, 170, 40],
  light: [250, 210, 80],
  accent: [140, 90, 10],
});

generateToken("mk_mega_knight_token.png", {
  dark: [80, 20, 140],
  mid: [130, 50, 200],
  light: [170, 100, 230],
  accent: [60, 10, 110],
});

// ─── BLUEPRINT TEXTURES (building silhouettes on blueprint paper) ──

function generateBlueprint(filename, drawBuilding) {
  const png = createPNG();

  // Blueprint paper background (slightly worn parchment blue)
  rect(png, 1, 1, 14, 14, 60, 90, 140);

  // Paper edge/border
  outline(png, 1, 1, 14, 14, 40, 60, 100);

  // Grid lines (faint)
  for (let i = 4; i <= 12; i += 4) {
    for (let x = 2; x <= 13; x++) px(png, x, i, 50, 75, 120, 180);
    for (let y = 2; y <= 13; y++) px(png, i, y, 50, 75, 120, 180);
  }

  // Corner fold (top-right)
  px(png, 13, 1, 40, 60, 100);
  px(png, 14, 1, 40, 60, 100);
  px(png, 14, 2, 40, 60, 100);
  px(png, 13, 2, 70, 100, 150);

  // Draw the building silhouette
  drawBuilding(png);

  save(png, filename);
}

console.log("Generating blueprint textures...");

// Small Tower: tall narrow tower with pointed roof
generateBlueprint("mk_blueprint_small_tower.png", (png) => {
  const c = [180, 210, 255]; // light blueprint ink

  // Tower body (narrow rectangle)
  rect(png, 6, 5, 9, 12, ...c);

  // Crenellations at top
  px(png, 5, 4, ...c);
  px(png, 6, 4, ...c);
  px(png, 9, 4, ...c);
  px(png, 10, 4, ...c);

  // Pointed roof
  px(png, 7, 3, ...c);
  px(png, 8, 3, ...c);
  px(png, 7, 2, ...c);
  px(png, 8, 2, ...c);

  // Door
  px(png, 7, 11, 60, 90, 140);
  px(png, 8, 11, 60, 90, 140);
  px(png, 7, 12, 60, 90, 140);
  px(png, 8, 12, 60, 90, 140);

  // Window
  px(png, 7, 7, 60, 90, 140);
  px(png, 8, 7, 60, 90, 140);
});

// Gatehouse: wide structure with archway and flanking towers
generateBlueprint("mk_blueprint_gatehouse.png", (png) => {
  const c = [180, 210, 255]; // light blueprint ink

  // Main body (wide, shorter)
  rect(png, 3, 6, 12, 12, ...c);

  // Archway (dark cutout in center)
  rect(png, 6, 8, 9, 12, 60, 90, 140);

  // Left tower turret
  rect(png, 3, 4, 5, 6, ...c);
  px(png, 2, 3, ...c);
  px(png, 3, 3, ...c);
  px(png, 5, 3, ...c);

  // Right tower turret
  rect(png, 10, 4, 12, 6, ...c);
  px(png, 10, 3, ...c);
  px(png, 12, 3, ...c);
  px(png, 13, 3, ...c);

  // Crenellations across top
  for (let x = 3; x <= 12; x += 2) {
    px(png, x, 5, ...c);
  }

  // Portcullis lines in archway
  for (let y = 8; y <= 11; y += 2) {
    px(png, 7, y, ...c);
    px(png, 8, y, ...c);
  }
});

// Great Hall: long wide building with peaked roof and pillars
generateBlueprint("mk_blueprint_great_hall.png", (png) => {
  const c = [180, 210, 255]; // light blueprint ink

  // Main hall body (wide and long)
  rect(png, 2, 6, 13, 12, ...c);

  // Peaked roof
  rect(png, 3, 5, 12, 5, ...c);
  rect(png, 4, 4, 11, 4, ...c);
  rect(png, 5, 3, 10, 3, ...c);
  rect(png, 6, 2, 9, 2, ...c);

  // Door
  rect(png, 7, 10, 8, 12, 60, 90, 140);

  // Windows (pairs)
  px(png, 4, 8, 60, 90, 140);
  px(png, 4, 9, 60, 90, 140);
  px(png, 11, 8, 60, 90, 140);
  px(png, 11, 9, 60, 90, 140);

  // Pillars
  for (let y = 6; y <= 12; y++) {
    px(png, 2, y, 140, 170, 220);
    px(png, 13, y, 140, 170, 220);
  }
});

// ─── SCROLL TEXTURE (rolled scroll with wax seal) ──────────────────

console.log("Generating scroll texture...");

(function generateScroll() {
  const png = createPNG();

  // Scroll body (parchment)
  const parch = [220, 200, 160]; // warm parchment
  const parchDk = [190, 170, 130]; // darker edge
  const parchLt = [235, 220, 185]; // highlight

  // Main scroll body
  rect(png, 3, 3, 12, 12, ...parch);

  // Top roll (cylinder effect)
  rect(png, 2, 2, 13, 3, ...parchDk);
  rect(png, 3, 2, 12, 2, ...parchLt);
  px(png, 2, 2, ...parchDk);
  px(png, 13, 2, ...parchDk);

  // Bottom roll
  rect(png, 2, 12, 13, 13, ...parchDk);
  rect(png, 3, 13, 12, 13, ...parchLt);

  // Roll end caps
  px(png, 1, 2, 160, 140, 100);
  px(png, 1, 3, 160, 140, 100);
  px(png, 14, 2, 160, 140, 100);
  px(png, 14, 3, 160, 140, 100);
  px(png, 1, 12, 160, 140, 100);
  px(png, 1, 13, 160, 140, 100);
  px(png, 14, 12, 160, 140, 100);
  px(png, 14, 13, 160, 140, 100);

  // Text lines (faint)
  const ink = [140, 120, 80];
  for (let y = 5; y <= 10; y += 2) {
    for (let x = 5; x <= 10; x++) {
      px(png, x, y, ...ink, 140);
    }
  }

  // Wax seal (red circle, bottom-center)
  circle(png, 8, 10, 2, 180, 30, 30);
  // Seal highlight
  px(png, 7, 9, 220, 60, 60);
  // Seal detail (cross)
  px(png, 8, 9, 140, 20, 20);
  px(png, 8, 11, 140, 20, 20);
  px(png, 7, 10, 140, 20, 20);
  px(png, 9, 10, 140, 20, 20);

  // Ribbon from seal
  px(png, 6, 11, 180, 30, 30);
  px(png, 10, 11, 180, 30, 30);
  px(png, 5, 12, 160, 25, 25);
  px(png, 11, 12, 160, 25, 25);

  save(png, "mk_standard_bearer_scroll.png");
})();

console.log("Done! All textures generated.");
