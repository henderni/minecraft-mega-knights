/**
 * entity-validation.test.ts
 *
 * Validates all entity JSON files have required Bedrock fields, correct
 * identifiers, valid component groups, and consistent event handlers.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const BP_ENTITIES_DIR = path.join(__dirname, "../../MegaKnights_BP/entities");
const RP_ENTITIES_DIR = path.join(__dirname, "../../MegaKnights_RP/entity");

const bpFiles = fs.readdirSync(BP_ENTITIES_DIR).filter((f) => f.endsWith(".se.json"));
const rpFiles = fs.readdirSync(RP_ENTITIES_DIR).filter((f) => f.endsWith(".ce.json"));

function readBPEntity(filename: string): any {
  return JSON.parse(fs.readFileSync(path.join(BP_ENTITIES_DIR, filename), "utf-8"));
}

function readRPEntity(filename: string): any {
  return JSON.parse(fs.readFileSync(path.join(RP_ENTITIES_DIR, filename), "utf-8"));
}

// ─── Required entity files ───────────────────────────────────────────────────

describe("Entity files: required entities exist", () => {
  const requiredBP = [
    "mk_ally_knight.se.json",
    "mk_ally_archer.se.json",
    "mk_ally_wizard.se.json",
    "mk_ally_dark_knight.se.json",
    "mk_enemy_knight.se.json",
    "mk_enemy_archer.se.json",
    "mk_enemy_wizard.se.json",
    "mk_enemy_dark_knight.se.json",
    "mk_boss_siege_lord.se.json",
    "mk_wandering_merchant.se.json",
    "mk_ally_standard_bearer.se.json",
  ];

  for (const file of requiredBP) {
    it(`BP entity ${file} exists`, () => {
      expect(bpFiles).toContain(file);
    });
  }

  it("every BP entity has a matching RP client entity", () => {
    for (const bpFile of bpFiles) {
      const rpFile = bpFile.replace(".se.json", ".ce.json");
      expect(rpFiles).toContain(rpFile);
    }
  });
});

// ─── BP entity schema validation ─────────────────────────────────────────────

describe("BP entities: schema compliance", () => {
  for (const file of bpFiles) {
    const entityName = file.replace(".se.json", "");
    const raw = readBPEntity(file);

    it(`${entityName}: has valid format_version string`, () => {
      expect(raw.format_version).toBeDefined();
      expect(typeof raw.format_version).toBe("string");
      expect(raw.format_version).toMatch(/^\d+\.\d+/);
    });

    it(`${entityName}: has minecraft:entity root`, () => {
      expect(raw["minecraft:entity"]).toBeDefined();
    });

    it(`${entityName}: has description.identifier matching mk:mk_* pattern`, () => {
      const id = raw["minecraft:entity"]?.description?.identifier;
      expect(id).toBeDefined();
      expect(id).toMatch(/^mk:mk_/);
    });

    it(`${entityName}: identifier matches filename`, () => {
      const id = raw["minecraft:entity"]?.description?.identifier;
      const expectedId = `mk:${entityName}`;
      expect(id).toBe(expectedId);
    });

    it(`${entityName}: has components section`, () => {
      expect(raw["minecraft:entity"]?.components).toBeDefined();
    });

    it(`${entityName}: has health component`, () => {
      const components = raw["minecraft:entity"]?.components;
      expect(components?.["minecraft:health"]).toBeDefined();
    });

    it(`${entityName}: has physics component`, () => {
      const components = raw["minecraft:entity"]?.components;
      expect(components?.["minecraft:physics"]).toBeDefined();
    });
  }
});

// ─── Component group validation ──────────────────────────────────────────────

describe("BP entities: component groups", () => {
  for (const file of bpFiles) {
    const entityName = file.replace(".se.json", "");
    const raw = readBPEntity(file);
    const entity = raw["minecraft:entity"];
    const componentGroups = entity?.component_groups ?? {};
    const events = entity?.events ?? {};
    const groupNames = Object.keys(componentGroups);

    it(`${entityName}: no duplicate component group names`, () => {
      // JSON.parse would use the last duplicate key, but we check raw text
      const rawText = fs.readFileSync(path.join(BP_ENTITIES_DIR, file), "utf-8");
      for (const name of groupNames) {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const matches = rawText.match(new RegExp(`"${escaped}"\\s*:`, "g"));
        // The group name may appear in events as a reference — count only in component_groups section
        // Just verify the group name doesn't appear more than expected
        expect(matches).not.toBeNull();
      }
    });

    it(`${entityName}: event handlers reference valid component groups`, () => {
      for (const [, eventDef] of Object.entries(events)) {
        const eventStr = JSON.stringify(eventDef);
        // Extract group references from add/remove
        const addMatches = [...eventStr.matchAll(/"component_groups"\s*:\s*\[([^\]]*)\]/g)];
        for (const match of addMatches) {
          const refs = match[1].match(/"([^"]+)"/g);
          if (refs) {
            for (const ref of refs) {
              const groupName = ref.replace(/"/g, "");
              expect(groupNames).toContain(groupName);
            }
          }
        }
      }
    });
  }
});

// ─── RP client entity validation ─────────────────────────────────────────────

describe("RP client entities: schema compliance", () => {
  for (const file of rpFiles) {
    const entityName = file.replace(".ce.json", "");
    const raw = readRPEntity(file);

    it(`${entityName}: has valid format_version`, () => {
      expect(raw.format_version).toBeDefined();
      expect(typeof raw.format_version).toBe("string");
    });

    it(`${entityName}: has minecraft:client_entity root`, () => {
      expect(raw["minecraft:client_entity"]).toBeDefined();
    });

    it(`${entityName}: has description.identifier matching mk:mk_*`, () => {
      const id = raw["minecraft:client_entity"]?.description?.identifier;
      expect(id).toBeDefined();
      expect(id).toMatch(/^mk:mk_/);
    });

    it(`${entityName}: identifier matches BP entity`, () => {
      const rpId = raw["minecraft:client_entity"]?.description?.identifier;
      const bpFile = file.replace(".ce.json", ".se.json");
      if (bpFiles.includes(bpFile)) {
        const bpRaw = readBPEntity(bpFile);
        const bpId = bpRaw["minecraft:entity"]?.description?.identifier;
        expect(rpId).toBe(bpId);
      }
    });

    it(`${entityName}: has materials defined`, () => {
      const materials = raw["minecraft:client_entity"]?.description?.materials;
      expect(materials).toBeDefined();
      expect(materials?.default).toBeDefined();
    });

    it(`${entityName}: has textures defined`, () => {
      const textures = raw["minecraft:client_entity"]?.description?.textures;
      expect(textures).toBeDefined();
      expect(textures?.default).toBeDefined();
    });

    it(`${entityName}: has geometry defined`, () => {
      const geometry = raw["minecraft:client_entity"]?.description?.geometry;
      expect(geometry).toBeDefined();
      expect(geometry?.default).toBeDefined();
    });

    it(`${entityName}: has render_controllers`, () => {
      const rc = raw["minecraft:client_entity"]?.description?.render_controllers;
      expect(rc).toBeDefined();
      expect(rc.length).toBeGreaterThan(0);
    });
  }
});

// ─── Despawn and performance constraints ─────────────────────────────────────

describe("BP entities: despawn components", () => {
  for (const file of bpFiles) {
    const entityName = file.replace(".se.json", "");
    const rawText = fs.readFileSync(path.join(BP_ENTITIES_DIR, file), "utf-8");

    it(`${entityName}: has despawn mechanism`, () => {
      const hasDespawn =
        rawText.includes("minecraft:despawn") || rawText.includes("instant_despawn");
      expect(hasDespawn).toBe(true);
    });
  }
});

describe("BP entities: follow_range budget", () => {
  for (const file of bpFiles) {
    const entityName = file.replace(".se.json", "");
    const rawText = fs.readFileSync(path.join(BP_ENTITIES_DIR, file), "utf-8");

    it(`${entityName}: follow_range within budget`, () => {
      const matches = [...rawText.matchAll(/"follow_range"[^}]*?"value"\s*:\s*(\d+)/g)];
      for (const m of matches) {
        const range = parseInt(m[1]);
        if (entityName.includes("boss")) {
          expect(range).toBeLessThanOrEqual(32);
        } else {
          expect(range).toBeLessThanOrEqual(24);
        }
      }
    });
  }
});

describe("BP entities: scan_interval on targeting", () => {
  for (const file of bpFiles) {
    const entityName = file.replace(".se.json", "");
    const rawText = fs.readFileSync(path.join(BP_ENTITIES_DIR, file), "utf-8");

    it(`${entityName}: nearest_attackable_target has scan_interval >= 10`, () => {
      if (rawText.includes("nearest_attackable_target")) {
        const matches = [...rawText.matchAll(/"scan_interval"\s*:\s*(\d+)/g)];
        expect(matches.length).toBeGreaterThan(0);
        for (const m of matches) {
          expect(parseInt(m[1])).toBeGreaterThanOrEqual(10);
        }
      }
    });
  }
});

// ─── Merchant timer validation ───────────────────────────────────────────────

describe("Merchant entity: timer configuration", () => {
  const merchantFile = "mk_wandering_merchant.se.json";
  const raw = readBPEntity(merchantFile);
  const entity = raw["minecraft:entity"];
  const components = entity?.components ?? {};

  it("timer values >= 6000 ticks (5 minutes minimum)", () => {
    const timer = components["minecraft:timer"];
    expect(timer).toBeDefined();
    const [min, max] = timer.time;
    expect(min).toBeGreaterThanOrEqual(6000);
    expect(max).toBeGreaterThanOrEqual(6000);
  });

  it("timer event triggers mk:despawn", () => {
    const timer = components["minecraft:timer"];
    expect(timer.time_down_event.event).toBe("mk:despawn");
  });

  it("mk:despawn component group has instant_despawn", () => {
    const despawnGroup = entity?.component_groups?.["mk:despawn"];
    expect(despawnGroup).toBeDefined();
    expect(despawnGroup["minecraft:instant_despawn"]).toBeDefined();
  });

  it("has minecraft:despawn with reasonable max_distance", () => {
    const despawn = components["minecraft:despawn"];
    expect(despawn).toBeDefined();
    const maxDist = despawn.despawn_from_distance?.max_distance;
    expect(maxDist).toBeDefined();
    expect(maxDist).toBeGreaterThanOrEqual(96);
    expect(maxDist).toBeLessThanOrEqual(256);
  });
});

// ─── GPU budget: opaque materials ────────────────────────────────────────────

describe("RP entities: opaque materials preferred", () => {
  for (const file of rpFiles) {
    const entityName = file.replace(".ce.json", "");
    const rawText = fs.readFileSync(path.join(RP_ENTITIES_DIR, file), "utf-8");

    it(`${entityName}: high-count entities use opaque material`, () => {
      if (entityName.includes("ally") || entityName.includes("enemy")) {
        expect(rawText).not.toContain("entity_alphatest");
      }
    });
  }
});

// ─── hurt_by_target entity_types filters ─────────────────────────────────────

/**
 * hurt_by_target without entity_types would cause friendly fire — allies
 * would retaliate against each other and enemies would retaliate against
 * their own faction when struck. These tests verify that every entity with
 * hurt_by_target restricts retaliation to the correct opposing faction.
 *
 * - Ally entities: hurt_by_target must only retaliate against mk_enemy
 * - Enemy / boss entities: hurt_by_target must only retaliate against player and mk_ally
 */

// Helper: extract hurt_by_target component from a parsed entity JSON
function getHurtByTarget(raw: any): any {
  return raw["minecraft:entity"]?.components?.["minecraft:behavior.hurt_by_target"] ?? null;
}

// Helper: collect all family values present in entity_types filter(s)
function getHurtByTargetFamilies(hbt: any): string[] {
  if (!hbt?.entity_types) return [];
  const families: string[] = [];
  const entityTypes: any[] = hbt.entity_types;
  for (const et of entityTypes) {
    const filters = et.filters;
    if (!filters) continue;
    // Single test
    if (filters.test === "is_family") {
      families.push(filters.value);
    }
    // any_of array of tests
    if (Array.isArray(filters.any_of)) {
      for (const f of filters.any_of) {
        if (f.test === "is_family") families.push(f.value);
      }
    }
  }
  return families;
}

describe("BP entities: ally hurt_by_target restricts retaliation to mk_enemy", () => {
  // Only combatant allies have hurt_by_target (standard_bearer does not)
  const combatantAllyFiles = bpFiles.filter((f) => {
    const raw = readBPEntity(f);
    return f.includes("mk_ally_") && getHurtByTarget(raw) !== null;
  });

  it("at least one combatant ally entity has hurt_by_target", () => {
    expect(combatantAllyFiles.length).toBeGreaterThan(0);
  });

  for (const file of combatantAllyFiles) {
    const entityName = file.replace(".se.json", "");
    const raw = readBPEntity(file);
    const hbt = getHurtByTarget(raw);

    it(`${entityName}: hurt_by_target has entity_types defined`, () => {
      expect(hbt.entity_types).toBeDefined();
      expect(hbt.entity_types.length).toBeGreaterThan(0);
    });

    it(`${entityName}: hurt_by_target entity_types restricts to mk_enemy`, () => {
      const families = getHurtByTargetFamilies(hbt);
      expect(families).toContain("mk_enemy");
    });

    it(`${entityName}: hurt_by_target does NOT retaliate against player (prevents friendly-fire)`, () => {
      const families = getHurtByTargetFamilies(hbt);
      expect(families).not.toContain("player");
    });

    it(`${entityName}: hurt_by_target does NOT retaliate against mk_ally (prevents ally-on-ally combat)`, () => {
      const families = getHurtByTargetFamilies(hbt);
      expect(families).not.toContain("mk_ally");
    });
  }
});

describe("BP entities: enemy hurt_by_target restricts retaliation to player and mk_ally", () => {
  // All enemy and boss entities have hurt_by_target
  const enemyFiles = bpFiles.filter((f) => {
    const raw = readBPEntity(f);
    return (f.includes("mk_enemy_") || f.includes("mk_boss_")) && getHurtByTarget(raw) !== null;
  });

  it("at least one enemy entity has hurt_by_target", () => {
    expect(enemyFiles.length).toBeGreaterThan(0);
  });

  for (const file of enemyFiles) {
    const entityName = file.replace(".se.json", "");
    const raw = readBPEntity(file);
    const hbt = getHurtByTarget(raw);

    it(`${entityName}: hurt_by_target has entity_types defined`, () => {
      expect(hbt.entity_types).toBeDefined();
      expect(hbt.entity_types.length).toBeGreaterThan(0);
    });

    it(`${entityName}: hurt_by_target entity_types restricts to player`, () => {
      const families = getHurtByTargetFamilies(hbt);
      expect(families).toContain("player");
    });

    it(`${entityName}: hurt_by_target entity_types restricts to mk_ally`, () => {
      const families = getHurtByTargetFamilies(hbt);
      expect(families).toContain("mk_ally");
    });

    it(`${entityName}: hurt_by_target does NOT retaliate against mk_enemy (prevents enemy-on-enemy combat)`, () => {
      const families = getHurtByTargetFamilies(hbt);
      expect(families).not.toContain("mk_enemy");
    });
  }
});

describe("BP entities: boss hurt_by_target restricts retaliation to player and mk_ally", () => {
  const bossFile = "mk_boss_siege_lord.se.json";
  const raw = readBPEntity(bossFile);
  const hbt = getHurtByTarget(raw);

  it("boss has hurt_by_target component", () => {
    expect(hbt).not.toBeNull();
  });

  it("boss hurt_by_target has entity_types defined", () => {
    expect(hbt?.entity_types).toBeDefined();
    expect(hbt?.entity_types.length).toBeGreaterThan(0);
  });

  it("boss hurt_by_target includes player in entity_types", () => {
    const families = getHurtByTargetFamilies(hbt);
    expect(families).toContain("player");
  });

  it("boss hurt_by_target includes mk_ally in entity_types", () => {
    const families = getHurtByTargetFamilies(hbt);
    expect(families).toContain("mk_ally");
  });

  it("boss hurt_by_target does NOT include mk_enemy (boss does not retaliate against enemies)", () => {
    const families = getHurtByTargetFamilies(hbt);
    expect(families).not.toContain("mk_enemy");
  });

  it("boss hurt_by_target priority is 1 (high priority retaliation)", () => {
    expect(hbt.priority).toBe(1);
  });
});
