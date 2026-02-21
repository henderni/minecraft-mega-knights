import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";

const readSource = (relPath: string) =>
  readFileSync(join(__dirname, "..", relPath), "utf-8");

const diffSrc = readSource("systems/DifficultySystem.ts");

// ─── Constants ──────────────────────────────────────────────────────────────

describe("DifficultySystem: constants", () => {
  it("exports DIFFICULTY_NORMAL = 0", () => {
    expect(diffSrc).toMatch(/export\s+const\s+DIFFICULTY_NORMAL\s*=\s*0/);
  });

  it("exports DIFFICULTY_HARD = 1", () => {
    expect(diffSrc).toMatch(/export\s+const\s+DIFFICULTY_HARD\s*=\s*1/);
  });

  it("defines RECRUIT_CHANCES for both difficulties", () => {
    expect(diffSrc).toContain("RECRUIT_CHANCES");
    expect(diffSrc).toContain("[DIFFICULTY_NORMAL]: 0.3");
    expect(diffSrc).toContain("[DIFFICULTY_HARD]: 0.2");
  });

  it("defines ENEMY_MULTIPLIERS for both difficulties", () => {
    expect(diffSrc).toContain("ENEMY_MULTIPLIERS");
    expect(diffSrc).toContain("[DIFFICULTY_NORMAL]: 1.0");
    expect(diffSrc).toContain("[DIFFICULTY_HARD]: 1.5");
  });

  it("defines DIFFICULTY_NAMES for display", () => {
    expect(diffSrc).toContain("DIFFICULTY_NAMES");
    expect(diffSrc).toContain('"Normal"');
    expect(diffSrc).toContain('"Hard"');
  });
});

// ─── getDifficulty typeof guard ─────────────────────────────────────────────

describe("DifficultySystem: getDifficulty safety", () => {
  it("uses typeof guard on getDynamicProperty (not raw cast)", () => {
    expect(diffSrc).toMatch(/typeof\s+raw\s*===\s*"number"/);
  });

  it("does NOT use unsafe `as number` cast", () => {
    expect(diffSrc).not.toContain("as number | undefined");
  });

  it("caches result after first read", () => {
    expect(diffSrc).toContain("cachedDifficulty");
    expect(diffSrc).toMatch(/if\s*\(this\.cachedDifficulty\s*!==\s*null\)/);
  });

  it("defaults to DIFFICULTY_NORMAL when property is unset", () => {
    expect(diffSrc).toMatch(/stored\s*\?\?\s*DIFFICULTY_NORMAL/);
  });
});

// ─── getRecruitChance ───────────────────────────────────────────────────────

describe("DifficultySystem: getRecruitChance", () => {
  it("looks up from RECRUIT_CHANCES using getDifficulty()", () => {
    expect(diffSrc).toMatch(/RECRUIT_CHANCES\[this\.getDifficulty\(\)\]/);
  });

  it("falls back to 0.3 if difficulty is unknown", () => {
    expect(diffSrc).toMatch(/RECRUIT_CHANCES\[.*\]\s*\?\?\s*0\.3/);
  });
});

// ─── getEnemyMultiplier ─────────────────────────────────────────────────────

describe("DifficultySystem: getEnemyMultiplier", () => {
  it("looks up from ENEMY_MULTIPLIERS using getDifficulty()", () => {
    expect(diffSrc).toMatch(/ENEMY_MULTIPLIERS\[this\.getDifficulty\(\)\]/);
  });

  it("falls back to 1.0 if difficulty is unknown", () => {
    expect(diffSrc).toMatch(/ENEMY_MULTIPLIERS\[.*\]\s*\?\?\s*1\.0/);
  });
});

// ─── showDifficultySelect ───────────────────────────────────────────────────

describe("DifficultySystem: showDifficultySelect", () => {
  it("creates ActionFormData with title and body", () => {
    expect(diffSrc).toContain("new ActionFormData()");
    expect(diffSrc).toContain(".title(DIFFICULTY_TITLE)");
    expect(diffSrc).toContain(".body(DIFFICULTY_BODY)");
  });

  it("has 2 buttons (Normal and Hard)", () => {
    const buttonMatches = diffSrc.match(/\.button\(/g);
    expect(buttonMatches).toBeTruthy();
    expect(buttonMatches!.length).toBe(2);
  });

  it("defaults to DIFFICULTY_NORMAL if form is cancelled", () => {
    expect(diffSrc).toContain("response.canceled");
    expect(diffSrc).toMatch(/setDifficulty\(DIFFICULTY_NORMAL\)/);
  });

  it("defaults to DIFFICULTY_NORMAL on UI exception", () => {
    const showIdx = diffSrc.indexOf("showDifficultySelect");
    const catchIdx = diffSrc.indexOf("catch", showIdx + 100);
    const defaultIdx = diffSrc.indexOf("setDifficulty(DIFFICULTY_NORMAL)", catchIdx);
    expect(defaultIdx).toBeGreaterThan(catchIdx);
  });

  it("maps selection === 1 to DIFFICULTY_HARD", () => {
    expect(diffSrc).toMatch(/response\.selection\s*===\s*1\s*\?\s*DIFFICULTY_HARD/);
  });

  it("sends DIFFICULTY_SET message after selection", () => {
    expect(diffSrc).toContain("DIFFICULTY_SET(name)");
  });
});

// ─── setDifficulty ──────────────────────────────────────────────────────────

describe("DifficultySystem: setDifficulty", () => {
  it("caches the value", () => {
    expect(diffSrc).toContain("this.cachedDifficulty = level");
  });

  it("persists to world dynamic property", () => {
    expect(diffSrc).toContain('world.setDynamicProperty(DifficultySystem.KEY, level)');
  });
});

// ─── reset ──────────────────────────────────────────────────────────────────

describe("DifficultySystem: reset", () => {
  it("clears cached difficulty", () => {
    expect(diffSrc).toContain("this.cachedDifficulty = null");
  });

  it("clears world dynamic property", () => {
    expect(diffSrc).toContain("world.setDynamicProperty(DifficultySystem.KEY, undefined)");
  });
});
