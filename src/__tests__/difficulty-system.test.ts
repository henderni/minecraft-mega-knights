/**
 * difficulty-system.test.ts
 *
 * Validates DifficultySystem constants and source patterns using source-as-text.
 * DifficultySystem imports @minecraft/server, so we read it as text.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.join(__dirname, "..");

const difficultySrc = fs.readFileSync(
  path.join(SRC_ROOT, "systems/DifficultySystem.ts"),
  "utf-8",
);

// ─── Difficulty level constants ─────────────────────────────────────────────

describe("DifficultySystem: difficulty level constants", () => {
  it("exports DIFFICULTY_NORMAL = 0", () => {
    expect(difficultySrc).toMatch(/export\s+const\s+DIFFICULTY_NORMAL\s*=\s*0/);
  });

  it("exports DIFFICULTY_HARD = 1", () => {
    expect(difficultySrc).toMatch(/export\s+const\s+DIFFICULTY_HARD\s*=\s*1/);
  });
});

// ─── Recruit chances ────────────────────────────────────────────────────────

describe("DifficultySystem: recruit chances", () => {
  it("defines RECRUIT_CHANCES mapping", () => {
    expect(difficultySrc).toContain("RECRUIT_CHANCES");
  });

  it("normal difficulty has 0.3 recruit chance", () => {
    expect(difficultySrc).toMatch(/DIFFICULTY_NORMAL\]:\s*0\.3/);
  });

  it("hard difficulty has 0.2 recruit chance", () => {
    expect(difficultySrc).toMatch(/DIFFICULTY_HARD\]:\s*0\.2/);
  });

  it("recruit chances are in reasonable range (0.1-0.5)", () => {
    const chances = difficultySrc.match(/RECRUIT_CHANCES[^}]+}/s);
    expect(chances).not.toBeNull();
    const values = chances![0].match(/:\s*(0\.\d+)/g);
    expect(values).not.toBeNull();
    for (const v of values!) {
      const num = parseFloat(v.replace(":", "").trim());
      expect(num).toBeGreaterThanOrEqual(0.1);
      expect(num).toBeLessThanOrEqual(0.5);
    }
  });
});

// ─── Enemy multipliers ──────────────────────────────────────────────────────

describe("DifficultySystem: enemy multipliers", () => {
  it("defines ENEMY_MULTIPLIERS mapping", () => {
    expect(difficultySrc).toContain("ENEMY_MULTIPLIERS");
  });

  it("normal difficulty has 1.0 multiplier", () => {
    expect(difficultySrc).toMatch(/DIFFICULTY_NORMAL\]:\s*1\.0/);
  });

  it("hard difficulty has 1.5 multiplier", () => {
    expect(difficultySrc).toMatch(/DIFFICULTY_HARD\]:\s*1\.5/);
  });
});

// ─── Dynamic property key ───────────────────────────────────────────────────

describe("DifficultySystem: persistence", () => {
  it('uses "mk:difficulty" as dynamic property key', () => {
    expect(difficultySrc).toContain('"mk:difficulty"');
  });

  it("caches difficulty value after first read", () => {
    expect(difficultySrc).toContain("cachedDifficulty");
  });

  it("getDifficulty returns cached value when available", () => {
    expect(difficultySrc).toMatch(/if\s*\(\s*this\.cachedDifficulty\s*!==\s*null/);
  });
});

// ─── Reset behavior ─────────────────────────────────────────────────────────

describe("DifficultySystem: reset", () => {
  it("has a reset() method", () => {
    expect(difficultySrc).toMatch(/reset\s*\(\s*\)/);
  });

  it("clears cached value on reset", () => {
    // reset should set cachedDifficulty to null
    expect(difficultySrc).toContain("cachedDifficulty = null");
  });

  it("clears dynamic property on reset", () => {
    expect(difficultySrc).toContain("setDynamicProperty");
    // Should set to undefined to clear
    expect(difficultySrc).toMatch(/setDynamicProperty\([^,]+,\s*undefined\)/);
  });
});

// ─── Public API methods ─────────────────────────────────────────────────────

describe("DifficultySystem: public API", () => {
  it("has getRecruitChance method", () => {
    expect(difficultySrc).toMatch(/getRecruitChance\s*\(\s*\)/);
  });

  it("has getEnemyMultiplier method", () => {
    expect(difficultySrc).toMatch(/getEnemyMultiplier\s*\(\s*\)/);
  });

  it("has getDifficultyName method", () => {
    expect(difficultySrc).toMatch(/getDifficultyName\s*\(\s*\)/);
  });

  it("has showDifficultySelect method", () => {
    expect(difficultySrc).toContain("showDifficultySelect");
  });
});
