import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const SRC_ROOT = join(__dirname, "..");
const CAMP_SRC = readFileSync(join(SRC_ROOT, "systems/EnemyCampSystem.ts"), "utf-8");

describe("Camp Cleared Idempotency (EnemyCampSystem.ts)", () => {
  describe("CampState interface", () => {
    it("CampState interface includes cleared: boolean field", () => {
      // The interface should declare a cleared boolean property
      expect(CAMP_SRC).toMatch(/interface\s+CampState\s*\{[^}]*cleared\s*:\s*boolean/s);
    });
  });

  describe("campCleared() method", () => {
    it("campCleared() sets camp.cleared = true", () => {
      expect(CAMP_SRC).toMatch(/camp\.cleared\s*=\s*true/);
    });

    it("campCleared() deletes the entry from activeCamps Map", () => {
      expect(CAMP_SRC).toMatch(/this\.activeCamps\.delete\s*\(\s*playerName\s*\)/);
    });

    it("campCleared() method exists on EnemyCampSystem", () => {
      expect(CAMP_SRC).toMatch(/private\s+campCleared\s*\(/);
    });
  });

  describe("Death listener guard", () => {
    it("death listener checks !camp.cleared before calling campCleared", () => {
      // The death handler must have a guard: guardCount <= 0 && spawningComplete && !camp.cleared
      expect(CAMP_SRC).toMatch(/!\s*camp\.cleared[\s\S]*?campCleared|campCleared[\s\S]*?!\s*camp\.cleared/);
    });

    it("death listener combines spawningComplete and !camp.cleared guards", () => {
      expect(CAMP_SRC).toMatch(/camp\.spawningComplete\s*&&\s*!\s*camp\.cleared/);
    });
  });

  describe("tick() recount guard", () => {
    it("tick() checks !camp.cleared before calling campCleared", () => {
      // Tick's safety recount path: if (camp.guardCount <= 0 && !camp.cleared)
      expect(CAMP_SRC).toMatch(/guardCount\s*<=\s*0\s*&&\s*!\s*camp\.cleared/);
    });
  });

  describe("New camp initialization", () => {
    it("new camps initialize with cleared: false", () => {
      expect(CAMP_SRC).toMatch(/cleared\s*:\s*false/);
    });

    it("new camp object is assigned to activeCamps Map", () => {
      expect(CAMP_SRC).toMatch(/this\.activeCamps\.set\s*\(/);
    });
  });
});
