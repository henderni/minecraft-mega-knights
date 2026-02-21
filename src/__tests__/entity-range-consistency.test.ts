import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";

const ENTITIES_DIR = join(__dirname, "../../MegaKnights_BP/entities");

/** Read and parse all .se.json entity files */
function loadEntityFiles(): { name: string; data: any }[] {
  const files = readdirSync(ENTITIES_DIR).filter(f => f.endsWith(".se.json"));
  return files.map(f => ({
    name: f,
    data: JSON.parse(readFileSync(join(ENTITIES_DIR, f), "utf-8")),
  }));
}

/** Extract follow_range and max_dist values from an entity definition */
function extractRanges(entity: any): { followRange: number | null; maxDists: number[] } {
  const components = entity["minecraft:entity"]?.components ?? {};
  const followRange = components["minecraft:follow_range"]?.value ?? null;

  const maxDists: number[] = [];
  const nat = components["minecraft:behavior.nearest_attackable_target"];
  if (nat?.entity_types) {
    for (const et of nat.entity_types) {
      if (et.max_dist !== undefined) {
        maxDists.push(et.max_dist);
      }
    }
  }

  return { followRange, maxDists };
}

describe("Entity follow_range vs max_dist consistency", () => {
  const entities = loadEntityFiles();

  it("loads all entity files", () => {
    expect(entities.length).toBeGreaterThanOrEqual(10);
  });

  it("every non-boss entity with both follow_range and max_dist has matching values", () => {
    const mismatches: string[] = [];

    for (const { name, data } of entities) {
      // Boss entities use progressive phase-based ranges (intentional mismatch)
      if (name.includes("boss")) {
        continue;
      }
      const { followRange, maxDists } = extractRanges(data);
      if (followRange === null || maxDists.length === 0) {
        continue;
      }

      for (const md of maxDists) {
        if (md !== followRange) {
          mismatches.push(`${name}: follow_range=${followRange}, max_dist=${md}`);
        }
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("dark knight entities specifically have matching ranges", () => {
    for (const { name, data } of entities) {
      if (!name.includes("dark_knight")) {
        continue;
      }
      const { followRange, maxDists } = extractRanges(data);
      expect(followRange).toBe(24);
      for (const md of maxDists) {
        expect(md).toBe(24);
      }
    }
  });

  it("wizard entities specifically have matching ranges", () => {
    for (const { name, data } of entities) {
      if (!name.includes("wizard")) {
        continue;
      }
      const { followRange, maxDists } = extractRanges(data);
      if (followRange !== null && maxDists.length > 0) {
        for (const md of maxDists) {
          expect(md).toBe(followRange);
        }
      }
    }
  });

  it("no entity has max_dist greater than follow_range", () => {
    for (const { name, data } of entities) {
      const { followRange, maxDists } = extractRanges(data);
      if (followRange === null || maxDists.length === 0) {
        continue;
      }
      for (const md of maxDists) {
        expect(md).toBeLessThanOrEqual(followRange);
      }
    }
  });
});
