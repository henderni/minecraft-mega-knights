import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const SRC_ROOT = join(__dirname, "..");
const MAIN_SRC = readFileSync(join(SRC_ROOT, "main.ts"), "utf-8");
const SIEGE_SRC = readFileSync(join(SRC_ROOT, "systems/SiegeSystem.ts"), "utf-8");
const CAMP_SRC = readFileSync(join(SRC_ROOT, "systems/EnemyCampSystem.ts"), "utf-8");

describe("mk:reset Handler — Entity Cleanup (main.ts lines 241-271)", () => {
  describe("Handler invokes system reset methods", () => {
    it("mk:reset handler exists and calls siege.reset()", () => {
      expect(MAIN_SRC).toMatch(/event\.id\s*===\s*["']mk:reset["']/);
      expect(MAIN_SRC).toMatch(/siege\.reset\s*\(\s*\)/);
    });

    it("calls dayCounter.reset() to reset day counter", () => {
      expect(MAIN_SRC).toMatch(/dayCounter\.reset\s*\(\s*\)/);
    });

    it("calls difficulty.reset() to reset difficulty", () => {
      expect(MAIN_SRC).toMatch(/difficulty\.reset\s*\(\s*\)/);
    });

    it("calls campSystem.clearAllCamps() to clear all enemy camps", () => {
      expect(MAIN_SRC).toMatch(/campSystem\.clearAllCamps\s*\(\s*\)/);
    });
  });

  describe("Handler removes custom entities by tag", () => {
    it("removes mk_army tagged entities", () => {
      expect(MAIN_SRC).toMatch(/["']mk_army["']/);
      // Verify it's in the tag removal loop
      const resetBlock = MAIN_SRC.match(/event\.id\s*===\s*["']mk:reset["'][\s\S]*?else if/);
      expect(resetBlock).not.toBeNull();
      expect(resetBlock![0]).toMatch(/["']mk_army["']/);
    });

    it("removes mk_siege_mob tagged entities", () => {
      expect(MAIN_SRC).toMatch(/["']mk_siege_mob["']/);
      // Verify in reset handler
      const resetBlock = MAIN_SRC.match(/event\.id\s*===\s*["']mk:reset["'][\s\S]*?else if/);
      expect(resetBlock).not.toBeNull();
      expect(resetBlock![0]).toMatch(/["']mk_siege_mob["']/);
    });

    it("removes mk_camp_guard tagged entities", () => {
      expect(MAIN_SRC).toMatch(/["']mk_camp_guard["']/);
      // Verify in reset handler
      const resetBlock = MAIN_SRC.match(/event\.id\s*===\s*["']mk:reset["'][\s\S]*?else if/);
      expect(resetBlock).not.toBeNull();
      expect(resetBlock![0]).toMatch(/["']mk_camp_guard["']/);
    });

    it("iterates over tags array with for...of", () => {
      expect(MAIN_SRC).toMatch(/for\s*\(\s*const\s+\w+\s+of\s+\[["']mk_army["']/);
    });

    it("calls getEntities with tag filter", () => {
      expect(MAIN_SRC).toMatch(/dim\.getEntities\s*\(\s*\{\s*tags\s*:/);
    });

    it("removes entities with try-catch for safety", () => {
      const resetBlock = MAIN_SRC.match(/event\.id\s*===\s*["']mk:reset["'][\s\S]*?else if/);
      expect(resetBlock).not.toBeNull();
      expect(resetBlock![0]).toMatch(/try\s*\{[\s\S]*?e\.remove\s*\(\s*\)/);
      expect(resetBlock![0]).toMatch(/catch/);
    });
  });

  describe("Handler clears player dynamic properties", () => {
    it("iterates getAllPlayers()", () => {
      expect(MAIN_SRC).toMatch(/world\.getAllPlayers\s*\(\s*\)/);
    });

    it("clears mk:kills property", () => {
      expect(MAIN_SRC).toMatch(/setDynamicProperty\s*\(\s*["']mk:kills["']/);
    });

    it("clears mk:army_size property", () => {
      expect(MAIN_SRC).toMatch(/setDynamicProperty\s*\(\s*["']mk:army_size["']/);
    });

    it("clears mk:current_tier property", () => {
      expect(MAIN_SRC).toMatch(/setDynamicProperty\s*\(\s*["']mk:current_tier["']/);
    });

    it("clears mk:army_bonus property", () => {
      expect(MAIN_SRC).toMatch(/setDynamicProperty\s*\(\s*["']mk:army_bonus["']/);
    });

    it("clears mk:has_started property", () => {
      expect(MAIN_SRC).toMatch(/setDynamicProperty\s*\(\s*["']mk:has_started["']/);
    });

    it("clears all mk:tier_unlocked_* properties in a loop", () => {
      expect(MAIN_SRC).toMatch(/for\s*\(\s*let\s+i\s*=\s*0;\s*i\s*<\s*ARMOR_TIERS\.length/);
      expect(MAIN_SRC).toMatch(/setDynamicProperty\s*\(\s*`mk:tier_unlocked_\$\{i\}`/);
    });

    it("clears bestiary kill counters for all BESTIARY entries", () => {
      expect(MAIN_SRC).toMatch(/for\s*\(\s*const\s+entry\s+of\s+BESTIARY\s*\)/);
      expect(MAIN_SRC).toMatch(/setDynamicProperty\s*\(\s*entry\.killKey/);
    });

    it("wraps player property resets in try-catch", () => {
      const resetBlock = MAIN_SRC.match(/event\.id\s*===\s*["']mk:reset["'][\s\S]*?else if/);
      expect(resetBlock).not.toBeNull();
      // Check for try-catch around player iteration
      expect(resetBlock![0]).toMatch(/for\s*\(\s*const\s+player[\s\S]*?try/);
      expect(resetBlock![0]).toMatch(/catch/);
    });

    it("sends DEBUG_QUEST_RESET message after cleanup", () => {
      expect(MAIN_SRC).toMatch(/world\.sendMessage\s*\(\s*DEBUG_QUEST_RESET\s*\)/);
    });
  });

  describe("SiegeSystem.reset() method implementation", () => {
    it("SiegeSystem has public reset() method", () => {
      expect(SIEGE_SRC).toMatch(/reset\s*\(\s*\)\s*:\s*void/);
    });

    it("reset() checks if siege is active before cleanup", () => {
      // Should guard with this.siegeActive check
      expect(SIEGE_SRC).toMatch(/reset\s*\(\s*\)[\s\S]*?if\s*\(\s*this\.siegeActive/);
    });

    it("reset() calls endSiege(false) to abort siege", () => {
      expect(SIEGE_SRC).toMatch(/reset\s*\(\s*\)[\s\S]*?this\.endSiege\s*\(\s*false\s*\)/);
    });
  });

  describe("EnemyCampSystem.clearAllCamps() method implementation", () => {
    it("EnemyCampSystem has public clearAllCamps() method", () => {
      expect(CAMP_SRC).toMatch(/clearAllCamps\s*\(\s*\)\s*:\s*void/);
    });

    it("clearAllCamps() clears activeCamps", () => {
      // Should call this.activeCamps.clear()
      expect(CAMP_SRC).toMatch(/clearAllCamps\s*\(\s*\)[\s\S]*?this\.activeCamps\.clear\s*\(\s*\)/);
    });

    it("clearAllCamps() clears lastCampDay", () => {
      // Should call this.lastCampDay.clear()
      expect(CAMP_SRC).toMatch(/clearAllCamps\s*\(\s*\)[\s\S]*?this\.lastCampDay\.clear\s*\(\s*\)/);
    });

    it("clearAllCamps() clears cachedPlayerMap", () => {
      // Should call this.cachedPlayerMap.clear()
      expect(CAMP_SRC).toMatch(/clearAllCamps\s*\(\s*\)[\s\S]*?this\.cachedPlayerMap\.clear\s*\(\s*\)/);
    });
  });
});
