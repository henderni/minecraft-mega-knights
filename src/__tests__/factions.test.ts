import { describe, it, expect } from "vitest";
import { FACTIONS, getFactionForBiome, FACTION_GUARD_WEIGHTS } from "../data/FactionDefinitions";

describe("FactionDefinitions: structure", () => {
  it("has exactly 3 factions", () => {
    expect(FACTIONS).toHaveLength(3);
  });

  it("all factions have non-empty displayName", () => {
    for (const f of FACTIONS) {
      expect(f.displayName.length).toBeGreaterThan(0);
    }
  });

  it("all factions have non-empty campPrefix", () => {
    for (const f of FACTIONS) {
      expect(f.campPrefix.length).toBeGreaterThan(0);
    }
  });

  it("exactly one faction is the default (empty biomeKeywords)", () => {
    const defaults = FACTIONS.filter((f) => f.biomeKeywords.length === 0);
    expect(defaults).toHaveLength(1);
  });

  it("grave_walkers faction exists", () => {
    expect(FACTIONS.find((f) => f.id === "grave_walkers")).toBeDefined();
  });

  it("ironclad_raiders faction exists", () => {
    expect(FACTIONS.find((f) => f.id === "ironclad_raiders")).toBeDefined();
  });

  it("marauders faction exists and is the default", () => {
    const m = FACTIONS.find((f) => f.id === "marauders");
    expect(m).toBeDefined();
    expect(m!.biomeKeywords).toHaveLength(0);
  });
});

describe("getFactionForBiome()", () => {
  it("returns grave_walkers for swamp biome", () => {
    expect(getFactionForBiome("minecraft:swamp").id).toBe("grave_walkers");
  });

  it("returns grave_walkers for dark_forest biome", () => {
    expect(getFactionForBiome("minecraft:dark_forest").id).toBe("grave_walkers");
  });

  it("returns ironclad_raiders for mountain biome", () => {
    expect(getFactionForBiome("minecraft:jagged_peaks").id).toBe("ironclad_raiders");
  });

  it("returns ironclad_raiders for taiga biome", () => {
    expect(getFactionForBiome("minecraft:taiga").id).toBe("ironclad_raiders");
  });

  it("returns marauders (default) for plains biome", () => {
    expect(getFactionForBiome("minecraft:plains").id).toBe("marauders");
  });

  it("returns marauders for unknown biome", () => {
    expect(getFactionForBiome("").id).toBe("marauders");
  });

  it("returns marauders for forest biome (not swamp/mountain/taiga)", () => {
    expect(getFactionForBiome("minecraft:forest").id).toBe("marauders");
  });
});

describe("FACTION_GUARD_WEIGHTS", () => {
  it("marauders are knight-heavy (knight weight > wizard weight)", () => {
    const w = FACTION_GUARD_WEIGHTS["marauders"];
    expect(w["mk:mk_enemy_knight"]!).toBeGreaterThan(w["mk:mk_enemy_wizard"]!);
  });

  it("grave_walkers are wizard-heavy (wizard weight > knight weight)", () => {
    const w = FACTION_GUARD_WEIGHTS["grave_walkers"];
    expect(w["mk:mk_enemy_wizard"]!).toBeGreaterThan(w["mk:mk_enemy_knight"]!);
  });

  it("ironclad_raiders are dark_knight-heavy (dark_knight weight > wizard weight)", () => {
    const w = FACTION_GUARD_WEIGHTS["ironclad_raiders"];
    expect(w["mk:mk_enemy_dark_knight"]!).toBeGreaterThan(w["mk:mk_enemy_wizard"]!);
  });

  it("all factions have entries for all 4 enemy types", () => {
    const types = ["mk:mk_enemy_knight", "mk:mk_enemy_archer", "mk:mk_enemy_wizard", "mk:mk_enemy_dark_knight"];
    for (const factionId of ["marauders", "grave_walkers", "ironclad_raiders"] as const) {
      for (const t of types) {
        expect(FACTION_GUARD_WEIGHTS[factionId][t]).toBeDefined();
      }
    }
  });
});
