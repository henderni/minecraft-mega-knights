/**
 * entity-performance.test.ts
 *
 * Comprehensive enforcement tests for entity JSON performance rules.
 * These rules exist to maintain 30 FPS on Nintendo Switch (Tegra X1).
 *
 * Rules enforced:
 * 1. scan_interval >= 10 on all nearest_attackable_target components
 * 2. follow_range: <=16 basic, <=24 elite, <=32 boss only
 * 3. No minecraft:persistent on allies (use despawn distances instead)
 * 4. All entities have minecraft:despawn component
 * 5. density_limit on all spawn rules
 * 6. Opaque materials on high-count entities (no entity_alphatest)
 * 7. Boss should_darken_sky must be false
 * 8. Ally/enemy stat parity (same types should have matching health/damage)
 * 9. All entities have required base components (health, movement, navigation, etc.)
 * 10. Events referenced in TypeScript exist in entity JSON files
 * 11. Spawn rule combined weights stay low to avoid crowding monster pool
 * 12. Nameable always_show=false on non-boss entities to save GPU
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BP_ENTITIES_DIR = path.join(__dirname, "../../MegaKnights_BP/entities");
const RP_ENTITY_DIR = path.join(__dirname, "../../MegaKnights_RP/entity");
const SPAWN_RULES_DIR = path.join(
  __dirname,
  "../../MegaKnights_BP/spawn_rules",
);

interface EntityFile {
  filename: string;
  json: any;
  entity: any;
  components: Record<string, any>;
  componentGroups: Record<string, any>;
  events: Record<string, any>;
}

interface ClientEntityFile {
  filename: string;
  json: any;
  description: any;
}

interface SpawnRuleFile {
  filename: string;
  json: any;
  spawnRule: any;
}

function loadAllBehaviorEntities(): EntityFile[] {
  return fs
    .readdirSync(BP_ENTITIES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((filename) => {
      const json = JSON.parse(
        fs.readFileSync(path.join(BP_ENTITIES_DIR, filename), "utf-8"),
      );
      const entity = json["minecraft:entity"];
      return {
        filename,
        json,
        entity,
        components: entity?.components ?? {},
        componentGroups: entity?.component_groups ?? {},
        events: entity?.events ?? {},
      };
    });
}

function loadAllClientEntities(): ClientEntityFile[] {
  return fs
    .readdirSync(RP_ENTITY_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((filename) => {
      const json = JSON.parse(
        fs.readFileSync(path.join(RP_ENTITY_DIR, filename), "utf-8"),
      );
      return {
        filename,
        json,
        description: json["minecraft:client_entity"]?.description ?? {},
      };
    });
}

function loadAllSpawnRules(): SpawnRuleFile[] {
  return fs
    .readdirSync(SPAWN_RULES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((filename) => {
      const json = JSON.parse(
        fs.readFileSync(path.join(SPAWN_RULES_DIR, filename), "utf-8"),
      );
      return {
        filename,
        json,
        spawnRule: json["minecraft:spawn_rules"],
      };
    });
}

function isBasicMob(filename: string): boolean {
  return (
    !filename.includes("boss") &&
    !filename.includes("dark_knight") &&
    !filename.includes("merchant")
  );
}

function isEliteMob(filename: string): boolean {
  return filename.includes("dark_knight");
}

function isBoss(filename: string): boolean {
  return filename.includes("boss");
}

function isAlly(filename: string): boolean {
  return filename.includes("ally");
}

function isEnemy(filename: string): boolean {
  return filename.includes("enemy");
}

/**
 * Recursively find all instances of a component key in an entity JSON,
 * including inside component_groups.
 */
function findAllComponentInstances(
  entity: any,
  componentKey: string,
): { location: string; value: any }[] {
  const results: { location: string; value: any }[] = [];

  // Check base components
  if (entity?.components?.[componentKey] !== undefined) {
    results.push({
      location: "components",
      value: entity.components[componentKey],
    });
  }

  // Check all component_groups
  if (entity?.component_groups) {
    for (const [groupName, group] of Object.entries(entity.component_groups)) {
      const g = group as Record<string, any>;
      if (g[componentKey] !== undefined) {
        results.push({
          location: `component_groups.${groupName}`,
          value: g[componentKey],
        });
      }
    }
  }

  return results;
}

// ─── Load all data once ──────────────────────────────────────────────────────

const allBehaviorEntities = loadAllBehaviorEntities();
const allClientEntities = loadAllClientEntities();
const allSpawnRules = loadAllSpawnRules();

// ─── 1. scan_interval enforcement ────────────────────────────────────────────

describe("Rule 1: scan_interval >= 10 on all nearest_attackable_target", () => {
  for (const ef of allBehaviorEntities) {
    const allTargeting = findAllComponentInstances(
      ef.entity,
      "minecraft:behavior.nearest_attackable_target",
    );

    if (allTargeting.length === 0) continue;

    for (const { location, value } of allTargeting) {
      it(`${ef.filename} [${location}]: scan_interval exists and >= 10`, () => {
        expect(value.scan_interval).toBeDefined();
        expect(value.scan_interval).toBeGreaterThanOrEqual(10);
      });
    }
  }
});

// ─── 2. follow_range limits ──────────────────────────────────────────────────

describe("Rule 2: follow_range within tier budget", () => {
  for (const ef of allBehaviorEntities) {
    const allFollowRange = findAllComponentInstances(
      ef.entity,
      "minecraft:follow_range",
    );

    for (const { location, value } of allFollowRange) {
      it(`${ef.filename} [${location}]: follow_range within budget`, () => {
        const range = value.value;
        expect(range).toBeDefined();
        expect(range).toBeGreaterThan(0);

        if (isBoss(ef.filename)) {
          expect(range).toBeLessThanOrEqual(32);
        } else if (isEliteMob(ef.filename)) {
          expect(range).toBeLessThanOrEqual(24);
        } else {
          // Basic mobs, merchant, standard bearer
          expect(range).toBeLessThanOrEqual(16);
        }
      });
    }
  }

  // Also check max_dist on nearest_attackable_target entity_types
  for (const ef of allBehaviorEntities) {
    const allTargeting = findAllComponentInstances(
      ef.entity,
      "minecraft:behavior.nearest_attackable_target",
    );

    for (const { location, value } of allTargeting) {
      if (value.entity_types) {
        for (const et of value.entity_types) {
          it(`${ef.filename} [${location}]: max_dist within follow_range budget`, () => {
            if (isBoss(ef.filename)) {
              expect(et.max_dist).toBeLessThanOrEqual(32);
            } else if (isEliteMob(ef.filename)) {
              expect(et.max_dist).toBeLessThanOrEqual(24);
            } else {
              expect(et.max_dist).toBeLessThanOrEqual(16);
            }
          });
        }
      }
    }
  }
});

// ─── 3. No minecraft:persistent — use despawn distances ──────────────────────

describe("Rule 3: no minecraft:persistent on any entity", () => {
  for (const ef of allBehaviorEntities) {
    it(`${ef.filename}: does not use minecraft:persistent`, () => {
      const raw = JSON.stringify(ef.json);
      expect(raw).not.toContain("minecraft:persistent");
    });
  }
});

// ─── 4. All entities have despawn mechanism ──────────────────────────────────

describe("Rule 4: every entity has a despawn component", () => {
  for (const ef of allBehaviorEntities) {
    it(`${ef.filename}: has minecraft:despawn in base components`, () => {
      // Every entity should have distance-based despawn in base components
      // (not just in component_groups which require an event to activate)
      const despawn = ef.components["minecraft:despawn"];
      expect(despawn).toBeDefined();
      expect(
        despawn?.despawn_from_distance?.max_distance,
      ).toBeGreaterThanOrEqual(54);
    });

    it(`${ef.filename}: has mk:despawn event for instant cleanup`, () => {
      expect(ef.events["mk:despawn"]).toBeDefined();
      expect(ef.componentGroups["mk:despawn"]).toBeDefined();
      const despawnGroup = ef.componentGroups["mk:despawn"];
      expect(despawnGroup["minecraft:instant_despawn"]).toBeDefined();
    });
  }
});

// ─── 5. Ally despawn distances are 96-128 ────────────────────────────────────

describe("Rule 5: ally despawn distances are large (96-128)", () => {
  for (const ef of allBehaviorEntities) {
    if (!isAlly(ef.filename)) continue;

    it(`${ef.filename}: despawn min_distance >= 96, max_distance <= 128`, () => {
      const despawn = ef.components["minecraft:despawn"];
      expect(despawn?.despawn_from_distance?.min_distance).toBeGreaterThanOrEqual(96);
      expect(despawn?.despawn_from_distance?.max_distance).toBeLessThanOrEqual(128);
    });
  }
});

// ─── 6. Spawn rules: density_limit required ──────────────────────────────────

describe("Rule 6: all spawn rules have density_limit", () => {
  for (const sr of allSpawnRules) {
    it(`${sr.filename}: every condition has minecraft:density_limit`, () => {
      expect(sr.spawnRule?.conditions).toBeDefined();
      expect(sr.spawnRule.conditions.length).toBeGreaterThan(0);

      for (const condition of sr.spawnRule.conditions) {
        expect(
          condition["minecraft:density_limit"],
        ).toBeDefined();
      }
    });
  }
});

// ─── 7. Spawn rule weights ───────────────────────────────────────────────────

describe("Rule 7: spawn rule combined weights stay low", () => {
  it("total combined spawn weight across all rules <= 40", () => {
    let totalWeight = 0;
    for (const sr of allSpawnRules) {
      for (const condition of sr.spawnRule?.conditions ?? []) {
        totalWeight += condition["minecraft:weight"]?.default ?? 0;
      }
    }
    // 40 is a reasonable cap — vanilla hostile weights total ~100,
    // we don't want to crowd more than ~40% of the pool
    expect(totalWeight).toBeLessThanOrEqual(40);
  });

  for (const sr of allSpawnRules) {
    it(`${sr.filename}: individual weight <= 15`, () => {
      for (const condition of sr.spawnRule?.conditions ?? []) {
        const weight = condition["minecraft:weight"]?.default;
        if (weight !== undefined) {
          expect(weight).toBeLessThanOrEqual(15);
        }
      }
    });
  }
});

// ─── 8. Client entity materials: opaque preferred ────────────────────────────

describe("Rule 8: client entities use opaque material", () => {
  for (const ce of allClientEntities) {
    it(`${ce.filename}: uses 'entity' material (not entity_alphatest)`, () => {
      const materials = ce.description?.materials ?? {};
      const defaultMaterial = materials.default;
      expect(defaultMaterial).toBe("entity");
    });
  }
});

// ─── 9. Boss should_darken_sky = false ───────────────────────────────────────

describe("Rule 9: boss should_darken_sky is false", () => {
  for (const ef of allBehaviorEntities) {
    if (!isBoss(ef.filename)) continue;

    it(`${ef.filename}: minecraft:boss.should_darken_sky = false`, () => {
      const boss = ef.components["minecraft:boss"];
      expect(boss).toBeDefined();
      expect(boss.should_darken_sky).toBe(false);
    });
  }
});

// ─── 10. Ally/enemy stat parity ──────────────────────────────────────────────

describe("Rule 10: ally/enemy counterparts have matching stats", () => {
  const pairTypes = ["knight", "archer", "wizard", "dark_knight"];

  for (const type of pairTypes) {
    const allyFile = allBehaviorEntities.find((e) =>
      e.filename === `mk_ally_${type}.se.json`,
    );
    const enemyFile = allBehaviorEntities.find((e) =>
      e.filename === `mk_enemy_${type}.se.json`,
    );

    if (!allyFile || !enemyFile) continue;

    it(`${type}: ally and enemy have same max health`, () => {
      const allyHealth = allyFile.components["minecraft:health"]?.max;
      const enemyHealth = enemyFile.components["minecraft:health"]?.max;
      expect(allyHealth).toBe(enemyHealth);
    });

    it(`${type}: ally and enemy have same base damage`, () => {
      const allyDamage = allyFile.components["minecraft:attack"]?.damage;
      const enemyDamage = enemyFile.components["minecraft:attack"]?.damage;
      expect(allyDamage).toBe(enemyDamage);
    });

    it(`${type}: ally and enemy have same follow_range`, () => {
      const allyRange =
        allyFile.components["minecraft:follow_range"]?.value;
      const enemyRange =
        enemyFile.components["minecraft:follow_range"]?.value;
      expect(allyRange).toBe(enemyRange);
    });

    it(`${type}: ally and enemy have same movement speed`, () => {
      const allySpeed = allyFile.components["minecraft:movement"]?.value;
      const enemySpeed = enemyFile.components["minecraft:movement"]?.value;
      expect(allySpeed).toBe(enemySpeed);
    });
  }
});

// ─── 11. Required base components ────────────────────────────────────────────

describe("Rule 11: all entities have required base components", () => {
  const requiredComponents = [
    "minecraft:health",
    "minecraft:movement",
    "minecraft:collision_box",
    "minecraft:physics",
    "minecraft:navigation.walk",
    "minecraft:movement.basic",
    "minecraft:jump.static",
    "minecraft:follow_range",
    "minecraft:type_family",
  ];

  for (const ef of allBehaviorEntities) {
    for (const comp of requiredComponents) {
      it(`${ef.filename}: has ${comp}`, () => {
        expect(ef.components[comp]).toBeDefined();
      });
    }
  }

  // Combat entities must have attack component (exclude merchant, standard bearer)
  for (const ef of allBehaviorEntities) {
    if (
      ef.filename.includes("merchant") ||
      ef.filename.includes("standard_bearer")
    )
      continue;

    it(`${ef.filename}: combat entity has minecraft:attack`, () => {
      expect(ef.components["minecraft:attack"]).toBeDefined();
      expect(ef.components["minecraft:attack"]?.damage).toBeGreaterThan(0);
    });
  }
});

// ─── 12. Entity events exist for all TypeScript references ───────────────────

describe("Rule 12: all TypeScript-referenced events exist in entity JSON", () => {
  // Events triggered on allies (from ArmySystem stance cycling)
  const allyStanceEvents = [
    "mk:set_mode_follow",
    "mk:set_mode_guard",
    "mk:set_mode_hold",
  ];

  for (const ef of allBehaviorEntities) {
    if (!isAlly(ef.filename)) continue;

    for (const eventName of allyStanceEvents) {
      it(`${ef.filename}: has event ${eventName}`, () => {
        expect(ef.events[eventName]).toBeDefined();
      });
    }
  }

  // Events triggered on boss (from SiegeSystem phase transitions)
  const bossEvents = ["mk:enter_phase_2", "mk:enter_phase_3"];

  for (const ef of allBehaviorEntities) {
    if (!isBoss(ef.filename)) continue;

    for (const eventName of bossEvents) {
      it(`${ef.filename}: has event ${eventName}`, () => {
        expect(ef.events[eventName]).toBeDefined();
      });
    }

    // Also verify the component groups referenced by events exist
    it(`${ef.filename}: has mk:phase_2 component group`, () => {
      expect(ef.componentGroups["mk:phase_2"]).toBeDefined();
    });

    it(`${ef.filename}: has mk:phase_3 component group`, () => {
      expect(ef.componentGroups["mk:phase_3"]).toBeDefined();
    });
  }

  // Events triggered on enemies (from EnemyCampSystem)
  for (const ef of allBehaviorEntities) {
    if (!isEnemy(ef.filename)) continue;

    it(`${ef.filename}: has event mk:become_camp_guard`, () => {
      expect(ef.events["mk:become_camp_guard"]).toBeDefined();
    });

    it(`${ef.filename}: has mk:camp_guard component group`, () => {
      expect(ef.componentGroups["mk:camp_guard"]).toBeDefined();
    });
  }

  // mk:despawn event on all entities (used by various cleanup paths)
  for (const ef of allBehaviorEntities) {
    it(`${ef.filename}: has event mk:despawn`, () => {
      expect(ef.events["mk:despawn"]).toBeDefined();
    });
  }
});

// ─── 13. Type family correctness ─────────────────────────────────────────────

describe("Rule 13: type_family tags are correct", () => {
  for (const ef of allBehaviorEntities) {
    if (isAlly(ef.filename)) {
      it(`${ef.filename}: has mk_ally in type_family`, () => {
        const family = ef.components["minecraft:type_family"]?.family;
        expect(family).toContain("mk_ally");
      });
    }

    if (isEnemy(ef.filename)) {
      it(`${ef.filename}: has mk_enemy in type_family`, () => {
        const family = ef.components["minecraft:type_family"]?.family;
        expect(family).toContain("mk_enemy");
      });
    }

    if (isBoss(ef.filename)) {
      it(`${ef.filename}: has mk_boss in type_family`, () => {
        const family = ef.components["minecraft:type_family"]?.family;
        expect(family).toContain("mk_boss");
      });

      it(`${ef.filename}: has mk_enemy in type_family (boss is also an enemy)`, () => {
        const family = ef.components["minecraft:type_family"]?.family;
        expect(family).toContain("mk_enemy");
      });
    }

    it(`${ef.filename}: has mob in type_family`, () => {
      const family = ef.components["minecraft:type_family"]?.family;
      expect(family).toContain("mob");
    });
  }
});

// ─── 14. Nameable always_show = false ────────────────────────────────────────

describe("Rule 14: nameable always_show is false (GPU budget)", () => {
  for (const ef of allBehaviorEntities) {
    const nameable = ef.components["minecraft:nameable"];
    if (!nameable) continue;

    it(`${ef.filename}: always_show = false`, () => {
      expect(nameable.always_show).toBe(false);
    });
  }
});

// ─── 15. Client-server entity pairing ────────────────────────────────────────

describe("Rule 15: every behavior entity has a matching client entity", () => {
  for (const ef of allBehaviorEntities) {
    const identifier = ef.entity?.description?.identifier;

    it(`${ef.filename}: has matching client entity file`, () => {
      const expectedCeFile = ef.filename
        .replace(".se.json", ".ce.json");
      const match = allClientEntities.find(
        (ce) => ce.filename === expectedCeFile,
      );
      expect(match).toBeDefined();
    });

    it(`${ef.filename}: client entity identifier matches`, () => {
      const expectedCeFile = ef.filename
        .replace(".se.json", ".ce.json");
      const match = allClientEntities.find(
        (ce) => ce.filename === expectedCeFile,
      );
      if (match) {
        expect(match.description.identifier).toBe(identifier);
      }
    });
  }
});

// ─── 16. Camp guard component group has correct despawn distances ─────────────

describe("Rule 16: camp_guard component group has extended despawn", () => {
  for (const ef of allBehaviorEntities) {
    if (!isEnemy(ef.filename)) continue;

    it(`${ef.filename}: camp_guard has despawn 96-128`, () => {
      const campGuard = ef.componentGroups["mk:camp_guard"];
      expect(campGuard).toBeDefined();
      const despawn = campGuard?.["minecraft:despawn"];
      expect(despawn).toBeDefined();
      expect(
        despawn?.despawn_from_distance?.min_distance,
      ).toBeGreaterThanOrEqual(96);
      expect(
        despawn?.despawn_from_distance?.max_distance,
      ).toBeLessThanOrEqual(128);
    });
  }
});

// ─── 17. Boss phase escalation is coherent ───────────────────────────────────

describe("Rule 17: boss phases escalate correctly", () => {
  const boss = allBehaviorEntities.find((e) => isBoss(e.filename));

  if (boss) {
    it("phase 2 damage > base damage", () => {
      const baseDamage = boss.components["minecraft:attack"]?.damage;
      const phase2Damage =
        boss.componentGroups["mk:phase_2"]?.["minecraft:attack"]?.damage;
      expect(phase2Damage).toBeGreaterThan(baseDamage);
    });

    it("phase 3 damage > phase 2 damage", () => {
      const phase2Damage =
        boss.componentGroups["mk:phase_2"]?.["minecraft:attack"]?.damage;
      const phase3Damage =
        boss.componentGroups["mk:phase_3"]?.["minecraft:attack"]?.damage;
      expect(phase3Damage).toBeGreaterThan(phase2Damage);
    });

    it("phase 2 speed > base speed", () => {
      const baseSpeed = boss.components["minecraft:movement"]?.value;
      const phase2Speed =
        boss.componentGroups["mk:phase_2"]?.["minecraft:movement"]?.value;
      expect(phase2Speed).toBeGreaterThan(baseSpeed);
    });

    it("phase 3 speed > phase 2 speed", () => {
      const phase2Speed =
        boss.componentGroups["mk:phase_2"]?.["minecraft:movement"]?.value;
      const phase3Speed =
        boss.componentGroups["mk:phase_3"]?.["minecraft:movement"]?.value;
      expect(phase3Speed).toBeGreaterThan(phase2Speed);
    });

    it("all boss phases have scan_interval >= 10", () => {
      for (const phase of ["mk:phase_2", "mk:phase_3"]) {
        const targeting =
          boss.componentGroups[phase]?.[
            "minecraft:behavior.nearest_attackable_target"
          ];
        if (targeting) {
          expect(targeting.scan_interval).toBeGreaterThanOrEqual(10);
        }
      }
    });

    it("all boss phases have follow_range <= 32", () => {
      for (const phase of ["mk:phase_2", "mk:phase_3"]) {
        const fr =
          boss.componentGroups[phase]?.["minecraft:follow_range"];
        if (fr) {
          expect(fr.value).toBeLessThanOrEqual(32);
        }
      }
    });
  }
});

// ─── 18. Ally stance component groups are structurally correct ───────────────

describe("Rule 18: ally stance component groups work correctly", () => {
  for (const ef of allBehaviorEntities) {
    if (!isAlly(ef.filename)) continue;

    it(`${ef.filename}: mode_guard disables follow_owner`, () => {
      const guard = ef.componentGroups["mk:mode_guard"];
      expect(guard).toBeDefined();
      const followOwner = guard?.["minecraft:behavior.follow_owner"];
      expect(followOwner).toBeDefined();
      // Guard mode should have speed 0 so the ally stays put
      expect(followOwner?.speed_multiplier).toBe(0);
    });

    it(`${ef.filename}: mode_hold disables follow_owner AND strolling`, () => {
      const hold = ef.componentGroups["mk:mode_hold"];
      expect(hold).toBeDefined();
      const followOwner = hold?.["minecraft:behavior.follow_owner"];
      expect(followOwner).toBeDefined();
      expect(followOwner?.speed_multiplier).toBe(0);
      const stroll = hold?.["minecraft:behavior.random_stroll"];
      expect(stroll).toBeDefined();
      expect(stroll?.speed_multiplier).toBe(0);
    });
  }
});

// ─── 19. Entity identifiers match mk: namespace ─────────────────────────────

describe("Rule 19: all entity identifiers use mk:mk_ namespace", () => {
  for (const ef of allBehaviorEntities) {
    it(`${ef.filename}: identifier starts with mk:mk_`, () => {
      const identifier = ef.entity?.description?.identifier;
      expect(identifier).toBeDefined();
      expect(identifier).toMatch(/^mk:mk_/);
    });
  }

  for (const ce of allClientEntities) {
    it(`${ce.filename}: identifier starts with mk:mk_`, () => {
      const identifier = ce.description?.identifier;
      expect(identifier).toBeDefined();
      expect(identifier).toMatch(/^mk:mk_/);
    });
  }

  for (const sr of allSpawnRules) {
    it(`${sr.filename}: identifier starts with mk:mk_`, () => {
      const identifier = sr.spawnRule?.description?.identifier;
      expect(identifier).toBeDefined();
      expect(identifier).toMatch(/^mk:mk_/);
    });
  }
});
