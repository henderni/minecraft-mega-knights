import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const SRC_ROOT = join(__dirname, "..");
const SIEGE_SRC = readFileSync(join(SRC_ROOT, "systems/SiegeSystem.ts"), "utf-8");

describe("Siege Mob Cleanup (SiegeSystem.ts)", () => {
  describe("cleanupSiegeMobs() method", () => {
    it("cleanupSiegeMobs method exists", () => {
      expect(SIEGE_SRC).toMatch(/private\s+cleanupSiegeMobs\s*\(\s*\)/);
    });

    it("cleanup queries entities tagged with mk_siege_mob", () => {
      // Should call getEntities with the mk_siege_mob tag filter
      expect(SIEGE_SRC).toMatch(/getEntities\s*\(\s*\{[^}]*["']mk_siege_mob["']/s);
    });

    it("cleanup uses staggered removal via system.runJob", () => {
      // The cleanup body should use system.runJob (generator) for Switch performance
      const cleanupBlock = SIEGE_SRC.match(/private\s+cleanupSiegeMobs[\s\S]*?^\s*\}/m);
      expect(cleanupBlock).not.toBeNull();
      expect(cleanupBlock![0]).toMatch(/system\.runJob/);
    });

    it("siegeMobCount is reset to 0 at start of cleanup", () => {
      // The first thing cleanup does is reset the counter
      expect(SIEGE_SRC).toMatch(/cleanupSiegeMobs[\s\S]*?this\.siegeMobCount\s*=\s*0/s);
    });

    it("CLEANUP_PER_TICK constant exists for Switch performance", () => {
      expect(SIEGE_SRC).toMatch(/const\s+CLEANUP_PER_TICK\s*=\s*\d+/);
    });

    it("CLEANUP_PER_TICK is used inside cleanup loop", () => {
      expect(SIEGE_SRC).toMatch(/CLEANUP_PER_TICK/);
      // Should appear in modulo expression for yield cadence
      expect(SIEGE_SRC).toMatch(/%\s*CLEANUP_PER_TICK/);
    });

    it("cleanup uses siegeDimensionId instead of hardcoding 'overworld'", () => {
      // The dimId variable inside cleanup must come from this.siegeDimensionId
      expect(SIEGE_SRC).toMatch(/this\.siegeDimensionId/);
      // Inside the cleanup closure, it should reference dimId (captured from siegeDimensionId)
      const cleanupBlock = SIEGE_SRC.match(/private\s+cleanupSiegeMobs\s*\(\s*\)[\s\S]*?^\s*\}/m);
      expect(cleanupBlock).not.toBeNull();
      // Either references this.siegeDimensionId directly or captures it as dimId
      expect(cleanupBlock![0]).toMatch(/siegeDimensionId|dimId/);
    });
  });

  describe("endSiege() calls cleanupSiegeMobs()", () => {
    it("endSiege() method exists", () => {
      expect(SIEGE_SRC).toMatch(/private\s+endSiege\s*\(/);
    });

    it("endSiege() calls this.cleanupSiegeMobs()", () => {
      expect(SIEGE_SRC).toMatch(/this\.cleanupSiegeMobs\s*\(\s*\)/);
    });

    it("cleanupSiegeMobs is called before the wasEndless branch check", () => {
      // In the full source, `this.cleanupSiegeMobs()` appears before `if (wasEndless)`.
      // We verify this by comparing their character positions in the file.
      // We look for the *second* occurrence of cleanupSiegeMobs (the call site in endSiege,
      // not the method declaration below it) — but simply comparing the first occurrence
      // of the call "this.cleanupSiegeMobs()" with the first "if (wasEndless)" is sufficient
      // because the declaration "private cleanupSiegeMobs" appears after endSiege in the file.
      const callPos = SIEGE_SRC.indexOf("this.cleanupSiegeMobs()");
      const branchPos = SIEGE_SRC.indexOf("if (wasEndless)");
      expect(callPos).toBeGreaterThan(-1);
      expect(branchPos).toBeGreaterThan(-1);
      expect(callPos).toBeLessThan(branchPos);
    });
  });

  describe("Victory and defeat paths both trigger cleanup", () => {
    it("victory path calls endSiege(true)", () => {
      expect(SIEGE_SRC).toMatch(/this\.endSiege\s*\(\s*true\s*\)/);
    });

    it("defeat path calls endSiege(false)", () => {
      expect(SIEGE_SRC).toMatch(/this\.endSiege\s*\(\s*false\s*\)/);
    });
  });
});
