import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const entitiesDir = path.join(__dirname, "../../MegaKnights_BP/entities");

function loadAllEntities(): Array<{ file: string; entity: any }> {
  return fs
    .readdirSync(entitiesDir)
    .filter((f) => f.endsWith(".json"))
    .map((file) => ({
      file,
      entity: JSON.parse(
        fs.readFileSync(path.join(entitiesDir, file), "utf-8"),
      )["minecraft:entity"],
    }));
}

describe("Entity identifier correctness", () => {
  it("every entity identifier should start with mk:", () => {
    loadAllEntities().forEach(({ file, entity }) => {
      const id: string = entity?.description?.identifier;
      expect(
        id,
        `${file}: description.identifier is missing`,
      ).toBeDefined();
      expect(
        id,
        `${file}: identifier "${id}" should start with "mk:"`,
      ).toMatch(/^mk:/);
    });
  });

  it("entity identifier should match its filename", () => {
    loadAllEntities().forEach(({ file, entity }) => {
      // mk_enemy_knight.se.json  →  mk:mk_enemy_knight
      const stem = file.replace(/\.se\.json$/, "");
      const expectedId = `mk:${stem}`;
      const actualId: string = entity?.description?.identifier;
      expect(
        actualId,
        `${file}: expected identifier "${expectedId}", got "${actualId}"`,
      ).toBe(expectedId);
    });
  });

  it("all entities should have is_spawnable set to false", () => {
    // Custom mobs should not enter the natural spawn pool uncontrolled.
    // Spawn rules or scripts control when they appear.
    loadAllEntities().forEach(({ file, entity }) => {
      const spawnable = entity?.description?.is_spawnable;
      expect(
        spawnable,
        `${file}: is_spawnable should be false to prevent uncontrolled natural spawning`,
      ).toBe(false);
    });
  });
});

describe("scan_interval on nearest_attackable_target", () => {
  it("all nearest_attackable_target behaviors should set scan_interval >= 10", () => {
    // CLAUDE.md: "always set scan_interval: 10 (half-second) minimum"
    loadAllEntities().forEach(({ file, entity }) => {
      const behavior =
        entity?.components?.[
          "minecraft:behavior.nearest_attackable_target"
        ];
      if (!behavior) return;

      expect(
        behavior.scan_interval,
        `${file}: nearest_attackable_target should define scan_interval (missing or undefined)`,
      ).toBeDefined();
      expect(
        behavior.scan_interval,
        `${file}: scan_interval should be >= 10 to avoid per-tick scanning`,
      ).toBeGreaterThanOrEqual(10);
    });
  });
});

describe("Ally targeting restrictions", () => {
  it("allies should only target mk_enemy family, never players", () => {
    const allyFiles = fs
      .readdirSync(entitiesDir)
      .filter((f) => f.includes("ally") && f.endsWith(".json"));

    allyFiles.forEach((file) => {
      const entityJson = JSON.parse(
        fs.readFileSync(path.join(entitiesDir, file), "utf-8"),
      );
      const targeting =
        entityJson["minecraft:entity"]?.components?.[
          "minecraft:behavior.nearest_attackable_target"
        ];

      if (!targeting) return;

      const entityTypes: any[] = targeting.entity_types ?? [];
      entityTypes.forEach((et) => {
        const filters = et.filters;
        const filterStr = JSON.stringify(filters);
        expect(
          filterStr,
          `${file}: ally target filter should not include "player" family`,
        ).not.toContain('"player"');
      });
    });
  });

  it("enemies should target the player family", () => {
    const enemyFiles = fs
      .readdirSync(entitiesDir)
      .filter((f) => f.includes("enemy") && f.endsWith(".json"));

    enemyFiles.forEach((file) => {
      const entityJson = JSON.parse(
        fs.readFileSync(path.join(entitiesDir, file), "utf-8"),
      );
      const targeting =
        entityJson["minecraft:entity"]?.components?.[
          "minecraft:behavior.nearest_attackable_target"
        ];

      if (!targeting) return;

      const targetStr = JSON.stringify(targeting);
      expect(
        targetStr,
        `${file}: enemy should have player in its target filters`,
      ).toContain('"player"');
    });
  });
});

describe("Entity despawn distances", () => {
  it("enemy despawn should use vanilla-compatible distances (max 54, min 32)", () => {
    const enemyFiles = fs
      .readdirSync(entitiesDir)
      .filter((f) => f.includes("enemy") && f.endsWith(".json"));

    enemyFiles.forEach((file) => {
      const entityJson = JSON.parse(
        fs.readFileSync(path.join(entitiesDir, file), "utf-8"),
      );
      const despawn =
        entityJson["minecraft:entity"]?.components?.["minecraft:despawn"]
          ?.despawn_from_distance;

      if (!despawn) return;

      expect(
        despawn.max_distance,
        `${file}: enemy max despawn distance should be 54 (matches vanilla)`,
      ).toBe(54);
      expect(
        despawn.min_distance,
        `${file}: enemy min despawn distance should be 32`,
      ).toBe(32);
    });
  });

  it("ally despawn distances should be larger than enemy distances", () => {
    const allyFiles = fs
      .readdirSync(entitiesDir)
      .filter((f) => f.includes("ally") && f.endsWith(".json"));

    allyFiles.forEach((file) => {
      const entityJson = JSON.parse(
        fs.readFileSync(path.join(entitiesDir, file), "utf-8"),
      );
      const despawn =
        entityJson["minecraft:entity"]?.components?.["minecraft:despawn"]
          ?.despawn_from_distance;

      if (!despawn) return;

      // CLAUDE.md: use large despawn distance (96–128) for allies
      expect(
        despawn.max_distance,
        `${file}: ally max despawn should be >= 96 to follow players far`,
      ).toBeGreaterThanOrEqual(96);
      expect(
        despawn.min_distance,
        `${file}: ally min despawn should be >= 64`,
      ).toBeGreaterThanOrEqual(64);
    });
  });
});

describe("Entity events", () => {
  it("all entities should define a mk:despawn event", () => {
    loadAllEntities().forEach(({ file, entity }) => {
      const despawnEvent = entity?.events?.["mk:despawn"];
      expect(
        despawnEvent,
        `${file}: should define a "mk:despawn" event for script-triggered cleanup`,
      ).toBeDefined();
    });
  });

  it("mk:despawn event should add the mk:despawn component group", () => {
    loadAllEntities().forEach(({ file, entity }) => {
      const despawnEvent = entity?.events?.["mk:despawn"];
      if (!despawnEvent) return;

      const addedGroups: string[] =
        despawnEvent?.add?.component_groups ?? [];
      expect(
        addedGroups,
        `${file}: mk:despawn event should add the "mk:despawn" component group`,
      ).toContain("mk:despawn");
    });
  });

  it("all entities with a mk:despawn event should define the mk:despawn component group", () => {
    loadAllEntities().forEach(({ file, entity }) => {
      if (!entity?.events?.["mk:despawn"]) return;

      const groups = entity?.component_groups ?? {};
      expect(
        groups["mk:despawn"],
        `${file}: defines mk:despawn event but is missing the "mk:despawn" component group`,
      ).toBeDefined();
    });
  });
});

describe("Entity follow_range component", () => {
  it("all entities should have follow_range set explicitly", () => {
    loadAllEntities().forEach(({ file, entity }) => {
      const followRange = entity?.components?.["minecraft:follow_range"];
      expect(
        followRange,
        `${file}: should set minecraft:follow_range explicitly`,
      ).toBeDefined();
    });
  });

  it("non-boss follow_range should not exceed 24", () => {
    loadAllEntities().forEach(({ file, entity }) => {
      if (file.includes("boss")) return;
      const value = entity?.components?.["minecraft:follow_range"]?.value;
      if (value === undefined) return;
      expect(
        value,
        `${file}: non-boss follow_range ${value} exceeds CLAUDE.md limit of 24`,
      ).toBeLessThanOrEqual(24);
    });
  });

  it("boss follow_range should not exceed 32", () => {
    loadAllEntities().forEach(({ file, entity }) => {
      if (!file.includes("boss")) return;
      const value = entity?.components?.["minecraft:follow_range"]?.value;
      if (value === undefined) return;
      expect(
        value,
        `${file}: boss follow_range ${value} exceeds limit of 32`,
      ).toBeLessThanOrEqual(32);
    });
  });
});
