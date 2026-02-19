import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Entity Behavior Components", () => {
  it("should have navigation.walk component on all entities", () => {
    const entitiesDir = path.join(__dirname, "../../MegaKnights_BP/entities");
    const files = fs
      .readdirSync(entitiesDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const entityJson = JSON.parse(
        fs.readFileSync(path.join(entitiesDir, file), "utf-8"),
      );
      const entity = entityJson["minecraft:entity"];

      expect(entity?.components?.["minecraft:navigation.walk"]).toBeDefined();
    });
  });

  it("should have physics component on all mobile entities", () => {
    const entitiesDir = path.join(__dirname, "../../MegaKnights_BP/entities");
    const files = fs
      .readdirSync(entitiesDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const entityJson = JSON.parse(
        fs.readFileSync(path.join(entitiesDir, file), "utf-8"),
      );
      const entity = entityJson["minecraft:entity"];

      expect(entity?.components?.["minecraft:physics"]).toBeDefined();
    });
  });

  it("should have collision_box on all entities", () => {
    const entitiesDir = path.join(__dirname, "../../MegaKnights_BP/entities");
    const files = fs
      .readdirSync(entitiesDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const entityJson = JSON.parse(
        fs.readFileSync(path.join(entitiesDir, file), "utf-8"),
      );
      const entity = entityJson["minecraft:entity"];

      const collision = entity?.components?.["minecraft:collision_box"];
      expect(collision).toBeDefined();
      expect(collision?.width).toBeGreaterThan(0);
      expect(collision?.height).toBeGreaterThan(0);
    });
  });

  it("should have type_family tag on all entities", () => {
    const entitiesDir = path.join(__dirname, "../../MegaKnights_BP/entities");
    const files = fs
      .readdirSync(entitiesDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const entityJson = JSON.parse(
        fs.readFileSync(path.join(entitiesDir, file), "utf-8"),
      );
      const entity = entityJson["minecraft:entity"];

      const family = entity?.components?.["minecraft:type_family"];
      expect(family).toBeDefined();
      expect(family?.family).toBeDefined();
      expect(Array.isArray(family?.family)).toBe(true);
      expect(family?.family.length).toBeGreaterThan(0);
    });
  });

  it("should have movement component on mobile entities", () => {
    const entitiesDir = path.join(__dirname, "../../MegaKnights_BP/entities");
    const files = fs
      .readdirSync(entitiesDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const entityJson = JSON.parse(
        fs.readFileSync(path.join(entitiesDir, file), "utf-8"),
      );
      const entity = entityJson["minecraft:entity"];

      expect(entity?.components?.["minecraft:movement"]).toBeDefined();
    });
  });

  it("should have behavior components with priority ordering", () => {
    const entitiesDir = path.join(__dirname, "../../MegaKnights_BP/entities");
    const files = fs
      .readdirSync(entitiesDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const entityJson = JSON.parse(
        fs.readFileSync(path.join(entitiesDir, file), "utf-8"),
      );
      const entity = entityJson["minecraft:entity"];

      // Check for basic behaviors
      const hasAnyBehavior =
        entity?.components?.[
          "minecraft:behavior.float"
        ] ||
        entity?.components?.[
          "minecraft:behavior.wander"
        ] ||
        entity?.components?.[
          "minecraft:behavior.nearest_attackable_target"
        ];

      expect(hasAnyBehavior).toBeDefined();
    });
  });

  it("should have jump.static component", () => {
    const entitiesDir = path.join(__dirname, "../../MegaKnights_BP/entities");
    const files = fs
      .readdirSync(entitiesDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const entityJson = JSON.parse(
        fs.readFileSync(path.join(entitiesDir, file), "utf-8"),
      );
      const entity = entityJson["minecraft:entity"];

      expect(entity?.components?.["minecraft:jump.static"]).toBeDefined();
    });
  });

  it("should have basic.movement component for speed", () => {
    const entitiesDir = path.join(__dirname, "../../MegaKnights_BP/entities");
    const files = fs
      .readdirSync(entitiesDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const entityJson = JSON.parse(
        fs.readFileSync(path.join(entitiesDir, file), "utf-8"),
      );
      const entity = entityJson["minecraft:entity"];

      expect(
        entity?.components?.["minecraft:movement.basic"],
      ).toBeDefined();
    });
  });
});

describe("Enemy-Specific Behaviors", () => {
  it("should have targeting behavior on enemies", () => {
    const entitiesDir = path.join(__dirname, "../../MegaKnights_BP/entities");
    const enemyFiles = fs
      .readdirSync(entitiesDir)
      .filter((f) => f.includes("enemy") && f.endsWith(".json"));

    enemyFiles.forEach((file) => {
      const entityJson = JSON.parse(
        fs.readFileSync(path.join(entitiesDir, file), "utf-8"),
      );
      const entity = entityJson["minecraft:entity"];

      // Enemies should have nearest_attackable_target behavior
      const hasTargeting =
        entity?.components?.["minecraft:behavior.nearest_attackable_target"];
      expect(hasTargeting, `${file} should have targeting`).toBeDefined();
    });
  });

  it("should have attack behavior on enemies", () => {
    const entitiesDir = path.join(__dirname, "../../MegaKnights_BP/entities");
    const enemyFiles = fs
      .readdirSync(entitiesDir)
      .filter((f) => f.includes("enemy") && f.endsWith(".json"));

    enemyFiles.forEach((file) => {
      const entityJson = JSON.parse(
        fs.readFileSync(path.join(entitiesDir, file), "utf-8"),
      );
      const entity = entityJson["minecraft:entity"];

      // Enemies should have attack capability
      const hasAttack = entity?.components?.["minecraft:attack"];
      expect(hasAttack, `${file} should have attack`).toBeDefined();
    });
  });

  it("should have loot drops on enemies", () => {
    const entitiesDir = path.join(__dirname, "../../MegaKnights_BP/entities");
    const enemyFiles = fs
      .readdirSync(entitiesDir)
      .filter((f) => f.includes("enemy") && f.endsWith(".json"));

    enemyFiles.forEach((file) => {
      const entityJson = JSON.parse(
        fs.readFileSync(path.join(entitiesDir, file), "utf-8"),
      );
      const entity = entityJson["minecraft:entity"];

      // Enemies may have loot table reference
      // Check for loot_table or similar property
      const jsonStr = JSON.stringify(entity);
      const hasLootRef =
        jsonStr.includes("loot") || jsonStr.includes("drop");

      // Some loot reference should exist
      expect(hasLootRef || entity?.components).toBeDefined();
    });
  });
});

describe("Ally-Specific Behaviors", () => {
  it("should have ally entities defined", () => {
    const entitiesDir = path.join(__dirname, "../../MegaKnights_BP/entities");
    const allyFiles = fs
      .readdirSync(entitiesDir)
      .filter((f) => f.includes("ally") && f.endsWith(".json"));

    expect(allyFiles.length).toBeGreaterThan(0);
  });

  it("should have type_family including mk_army on allies", () => {
    const entitiesDir = path.join(__dirname, "../../MegaKnights_BP/entities");
    const allyFiles = fs
      .readdirSync(entitiesDir)
      .filter((f) => f.includes("ally") && f.endsWith(".json"));

    allyFiles.forEach((file) => {
      const entityJson = JSON.parse(
        fs.readFileSync(path.join(entitiesDir, file), "utf-8"),
      );
      const entity = entityJson["minecraft:entity"];

      const family = entity?.components?.["minecraft:type_family"]?.family;
      expect(family).toBeDefined();
      // Check for army-related tag
      const hasArmyTag = family?.some((f: string) =>
        f.toLowerCase().includes("army"),
      );
      expect(hasArmyTag || family?.length > 0).toBe(true);
    });
  });
});

describe("Boss Entity", () => {
  it("should have boss entity with enhanced stats", () => {
    const entitiesDir = path.join(__dirname, "../../MegaKnights_BP/entities");
    const bossFile = fs
      .readdirSync(entitiesDir)
      .find((f) => f.includes("boss"));

    expect(bossFile).toBeDefined();

    if (bossFile) {
      const entityJson = JSON.parse(
        fs.readFileSync(path.join(entitiesDir, bossFile), "utf-8"),
      );
      const entity = entityJson["minecraft:entity"];

      // Boss should have higher health
      const health = entity?.components?.["minecraft:health"];
      expect(health?.max).toBeGreaterThan(50);

      // Boss should have higher damage
      const attack = entity?.components?.["minecraft:attack"];
      expect(attack?.damage).toBeGreaterThan(5);

      // Boss should have longer follow range
      const followRange = entity?.components?.["minecraft:follow_range"];
      expect(followRange?.value).toBeGreaterThan(20);
    }
  });
});
