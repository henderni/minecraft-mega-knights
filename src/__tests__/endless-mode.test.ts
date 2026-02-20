/**
 * endless-mode.test.ts
 *
 * Tests for endless mode wave escalation logic and entity budget compliance.
 * Uses source-as-text pattern since SiegeSystem imports @minecraft/server.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.join(__dirname, "..");
const BP_ROOT = path.join(__dirname, "../../MegaKnights_BP");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf-8");
}

const siegeSrc = readSource("systems/SiegeSystem.ts");

// ─── Extract ENDLESS_WAVES from source text ─────────────────────────────────

interface EndlessSpawn {
  entityId: string;
  count: number;
}

function parseEndlessWaves(): EndlessSpawn[][] {
  // Extract the ENDLESS_WAVES block from source
  const startIdx = siegeSrc.indexOf("const ENDLESS_WAVES");
  if (startIdx === -1) throw new Error("ENDLESS_WAVES not found in source");
  const endIdx = siegeSrc.indexOf("];", startIdx);
  if (endIdx === -1) throw new Error("ENDLESS_WAVES closing not found");
  const block = siegeSrc.slice(startIdx, endIdx + 2);

  // Each inner array [...] contains only {…} objects — no nested brackets
  const innerArrayRegex = /\[[^\[\]]+\]/g;
  const waves: EndlessSpawn[][] = [];
  let m;
  while ((m = innerArrayRegex.exec(block)) !== null) {
    const spawns: EndlessSpawn[] = [];
    const spawnRegex = /entityId:\s*"([^"]+)".*?count:\s*(\d+)/g;
    let sm;
    while ((sm = spawnRegex.exec(m[0])) !== null) {
      spawns.push({ entityId: sm[1], count: parseInt(sm[2]) });
    }
    if (spawns.length > 0) {
      waves.push(spawns);
    }
  }
  return waves;
}

const endlessWaves = parseEndlessWaves();

// ─── ENDLESS_WAVES structure tests ──────────────────────────────────────────

describe("ENDLESS_WAVES array structure", () => {
  it("has 3 wave sets (light, medium, heavy)", () => {
    expect(endlessWaves).toHaveLength(3);
  });

  it("each wave set has at least 2 spawn entries", () => {
    for (const wave of endlessWaves) {
      expect(wave.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("wave sets escalate in total entity count", () => {
    const totals = endlessWaves.map((wave) =>
      wave.reduce((sum, s) => sum + s.count, 0),
    );
    for (let i = 1; i < totals.length; i++) {
      expect(totals[i]).toBeGreaterThan(totals[i - 1]);
    }
  });

  it("all entity IDs use mk: namespace", () => {
    for (const wave of endlessWaves) {
      for (const spawn of wave) {
        expect(spawn.entityId).toMatch(/^mk:mk_/);
      }
    }
  });

  it("entity IDs match defined entities in BP", () => {
    // Read all entity files to get valid identifiers
    const entityDir = path.join(BP_ROOT, "entities");
    const entityFiles = fs.readdirSync(entityDir).filter((f) => f.endsWith(".se.json"));
    const validIds = new Set<string>();
    for (const file of entityFiles) {
      const content = JSON.parse(
        fs.readFileSync(path.join(entityDir, file), "utf-8"),
      );
      const id =
        content["minecraft:entity"]?.description?.identifier;
      if (id) validIds.add(id);
    }

    for (const wave of endlessWaves) {
      for (const spawn of wave) {
        expect(validIds).toContain(spawn.entityId);
      }
    }
  });

  it("no boss entities in endless waves", () => {
    for (const wave of endlessWaves) {
      for (const spawn of wave) {
        expect(spawn.entityId).not.toContain("boss");
      }
    }
  });
});

// ─── Wave index selection formula ───────────────────────────────────────────

describe("Endless wave index selection", () => {
  // Formula from source: Math.min(Math.floor((day - 100) / 40), ENDLESS_WAVES.length - 1)
  function waveIndex(day: number): number {
    return Math.min(Math.floor((day - 100) / 40), endlessWaves.length - 1);
  }

  it("day 100-139 maps to wave set 0 (light)", () => {
    expect(waveIndex(100)).toBe(0);
    expect(waveIndex(120)).toBe(0);
    expect(waveIndex(139)).toBe(0);
  });

  it("day 140-179 maps to wave set 1 (medium)", () => {
    expect(waveIndex(140)).toBe(1);
    expect(waveIndex(160)).toBe(1);
    expect(waveIndex(179)).toBe(1);
  });

  it("day 180+ maps to wave set 2 (heavy)", () => {
    expect(waveIndex(180)).toBe(2);
    expect(waveIndex(200)).toBe(2);
    expect(waveIndex(300)).toBe(2);
  });

  it("wave index is clamped for very high days (500+)", () => {
    expect(waveIndex(500)).toBe(endlessWaves.length - 1);
    expect(waveIndex(1000)).toBe(endlessWaves.length - 1);
    expect(waveIndex(10000)).toBe(endlessWaves.length - 1);
  });

  it("source uses Math.min for clamping", () => {
    expect(siegeSrc).toContain("Math.min(Math.floor((day - 100) / 40)");
  });

  it("source uses ENDLESS_WAVES.length - 1 as upper bound", () => {
    expect(siegeSrc).toContain("ENDLESS_WAVES.length - 1");
  });
});

// ─── Endless mode entity budget (performance) ──────────────────────────────

const MAX_ACTIVE_SIEGE_MOBS = 25;
const HARD_MULTIPLIER = 1.5;

function scaledCount(
  baseCount: number,
  enemyMultiplier: number,
  mpScale: number,
): number {
  return Math.max(1, Math.round(baseCount * enemyMultiplier * mpScale));
}

describe("Endless mode entity budget", () => {
  it("no endless wave set exceeds MAX_ACTIVE_SIEGE_MOBS at normal difficulty", () => {
    for (const wave of endlessWaves) {
      const total = wave.reduce(
        (sum, s) => sum + scaledCount(s.count, 1.0, 1.0),
        0,
      );
      expect(total).toBeLessThanOrEqual(MAX_ACTIVE_SIEGE_MOBS);
    }
  });

  it("no endless wave set exceeds MAX_ACTIVE_SIEGE_MOBS at hard difficulty (solo)", () => {
    for (const wave of endlessWaves) {
      const total = wave.reduce(
        (sum, s) => sum + scaledCount(s.count, HARD_MULTIPLIER, 1.0),
        0,
      );
      // Hard difficulty may exceed the soft cap — the mid-wave gating handles this
      // But verify it's not wildly over budget
      expect(total).toBeLessThanOrEqual(MAX_ACTIVE_SIEGE_MOBS * 2);
    }
  });

  it("endless wave sets with multiplayer scaling (3+ players) stay reasonable", () => {
    const MP_SCALE_3PLUS = 0.6;
    for (const wave of endlessWaves) {
      const total = wave.reduce(
        (sum, s) =>
          sum + scaledCount(s.count, HARD_MULTIPLIER, MP_SCALE_3PLUS),
        0,
      );
      // Per-player counts should be modest
      expect(total).toBeLessThanOrEqual(MAX_ACTIVE_SIEGE_MOBS);
    }
  });

  it("mid-wave cap gating mechanism exists in source", () => {
    expect(siegeSrc).toContain("MAX_ACTIVE_SIEGE_MOBS");
    // The gating is used in tick() to pause wave progression when too many mobs are alive
    expect(siegeSrc).toContain("siegeMobCount");
  });
});

// ─── Endless mode source patterns ───────────────────────────────────────────

describe("Endless mode source patterns", () => {
  it("startEndlessSiege method exists", () => {
    expect(siegeSrc).toContain("startEndlessSiege(");
  });

  it("endless siege sets isEndlessSiege flag", () => {
    expect(siegeSrc).toContain("this.isEndlessSiege = true");
  });

  it("endless siege uses spawnEndlessWave (not multi-wave progression)", () => {
    expect(siegeSrc).toContain("this.spawnEndlessWave(spawns)");
  });

  it("endSiege handles both victory and defeat for endless mode", () => {
    expect(siegeSrc).toContain("ENDLESS_WAVE_CLEARED");
    expect(siegeSrc).toContain("ENDLESS_DEFEAT");
  });

  it("SPAWNS_PER_TICK is 1 (Switch-safe staggered spawning)", () => {
    expect(siegeSrc).toContain("SPAWNS_PER_TICK = 1");
  });
});
