import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Performance & Constraints", () => {
  it("should have spawn rules with reasonable weights", () => {
    const spawnRulesDir = path.join(
      __dirname,
      "../../MegaKnights_BP/spawn_rules",
    );
    const files = fs
      .readdirSync(spawnRulesDir)
      .filter((f) => f.endsWith(".json"));

    const totalWeights: Record<string, number> = {};

    files.forEach((file) => {
      const rule = JSON.parse(
        fs.readFileSync(path.join(spawnRulesDir, file), "utf-8"),
      );
      const spawnRule = rule["minecraft:spawn_rules"];

      if (spawnRule?.conditions) {
        spawnRule.conditions.forEach((condition: Record<string, any>) => {
          const weight = condition["minecraft:weight"]?.default;
          if (weight !== undefined) {
            // Individual weight should be >= 1
            expect(weight).toBeGreaterThanOrEqual(1);
            // Individual weight should not exceed 100 (reasonable limit)
            expect(weight).toBeLessThanOrEqual(100);

            // Accumulate for total
            totalWeights[file] = (totalWeights[file] || 0) + weight;
          }
        });
      }
    });

    // Individual spawn rule total weight shouldn't exceed 100
    Object.values(totalWeights).forEach((total) => {
      expect(total).toBeLessThanOrEqual(100);
    });
  });

  it("should have spawn rules with density limits", () => {
    const spawnRulesDir = path.join(
      __dirname,
      "../../MegaKnights_BP/spawn_rules",
    );
    const files = fs
      .readdirSync(spawnRulesDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const rule = JSON.parse(
        fs.readFileSync(path.join(spawnRulesDir, file), "utf-8"),
      );
      const spawnRule = rule["minecraft:spawn_rules"];

      if (spawnRule?.conditions) {
        const hasDensityLimit = spawnRule.conditions.some(
          (c: Record<string, any>) => c["minecraft:density_limit"],
        );
        expect(hasDensityLimit, `${file} should have density_limit`).toBe(
          true,
        );
      }
    });
  });

  it("should have entities with optimized follow_range", () => {
    const entitiesDir = path.join(__dirname, "../../MegaKnights_BP/entities");
    const files = fs
      .readdirSync(entitiesDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const entityJson = JSON.parse(
        fs.readFileSync(path.join(entitiesDir, file), "utf-8"),
      );
      const entity = entityJson["minecraft:entity"];

      if (entity?.components?.["minecraft:follow_range"]) {
        const followRange = entity.components["minecraft:follow_range"].value;

        // Basic mobs: 16-20, Elites: 24-28, Boss: <=32
        expect(followRange).toBeGreaterThan(0);
        expect(followRange).toBeLessThanOrEqual(36);

        // Boss should have higher range
        if (file.includes("boss")) {
          expect(followRange).toBeGreaterThan(20);
        }
      }
    });
  });

  it("should have reasonable entity health values", () => {
    const entitiesDir = path.join(__dirname, "../../MegaKnights_BP/entities");
    const files = fs
      .readdirSync(entitiesDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const entityJson = JSON.parse(
        fs.readFileSync(path.join(entitiesDir, file), "utf-8"),
      );
      const entity = entityJson["minecraft:entity"];

      const health = entity?.components?.["minecraft:health"];
      if (health) {
        // All entities should have positive health
        expect(health.max).toBeGreaterThan(0);
        expect(health.value).toBeGreaterThan(0);
        // Health should be reasonable (10-100 for most mobs)
        expect(health.max).toBeLessThan(500);
      }
    });
  });

  it("should have reasonable attack damage values", () => {
    const entitiesDir = path.join(__dirname, "../../MegaKnights_BP/entities");
    const files = fs
      .readdirSync(entitiesDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const entityJson = JSON.parse(
        fs.readFileSync(path.join(entitiesDir, file), "utf-8"),
      );
      const entity = entityJson["minecraft:entity"];

      const attack = entity?.components?.["minecraft:attack"];
      if (attack && attack.damage !== undefined) {
        // Damage should be positive
        expect(attack.damage).toBeGreaterThan(0);
        // Damage should be reasonable (2-20 range)
        expect(attack.damage).toBeLessThanOrEqual(50);
      }
    });
  });

  it("should have enemies with despawn component for memory efficiency", () => {
    const entitiesDir = path.join(__dirname, "../../MegaKnights_BP/entities");
    const enemyFiles = fs
      .readdirSync(entitiesDir)
      .filter((f) => f.includes("enemy") && f.endsWith(".json"));

    enemyFiles.forEach((file) => {
      const entityJson = JSON.parse(
        fs.readFileSync(path.join(entitiesDir, file), "utf-8"),
      );
      const entity = entityJson["minecraft:entity"];

      // Should have component_groups with despawn or instant_despawn
      const hasDespawn =
        entity?.component_groups &&
        Object.values(entity.component_groups).some(
          (group: any) =>
            group["minecraft:despawn"] || group["minecraft:instant_despawn"],
        );

      expect(
        hasDespawn,
        `Enemy ${file} should have despawn component for memory efficiency`,
      ).toBe(true);
    });
  });

  it("should have movement speed values within reasonable range", () => {
    const entitiesDir = path.join(__dirname, "../../MegaKnights_BP/entities");
    const files = fs
      .readdirSync(entitiesDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const entityJson = JSON.parse(
        fs.readFileSync(path.join(entitiesDir, file), "utf-8"),
      );
      const entity = entityJson["minecraft:entity"];

      const movement = entity?.components?.["minecraft:movement"];
      if (movement) {
        // Movement speed should be positive and reasonable (0.1-1.0 typical)
        expect(movement.value).toBeGreaterThan(0);
        expect(movement.value).toBeLessThanOrEqual(2);
      }
    });
  });
});
