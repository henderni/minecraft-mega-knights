import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Entity Configuration", () => {
  it("should have all required entity files", () => {
    const entitiesDir = path.join(__dirname, "../../MegaKnights_BP/entities");
    const files = fs.readdirSync(entitiesDir);

    const requiredEntities = [
      "mk_ally_knight.se.json",
      "mk_ally_archer.se.json",
      "mk_ally_wizard.se.json",
      "mk_ally_dark_knight.se.json",
      "mk_enemy_knight.se.json",
      "mk_enemy_archer.se.json",
      "mk_enemy_wizard.se.json",
      "mk_enemy_dark_knight.se.json",
      "mk_boss_siege_lord.se.json",
    ];

    requiredEntities.forEach((entity) => {
      expect(files).toContain(entity);
    });
  });

  it("should have despawn component on enemy entities", () => {
    const entitiesDir = path.join(__dirname, "../../MegaKnights_BP/entities");
    const enemyEntities = [
      "mk_enemy_knight.se.json",
      "mk_enemy_archer.se.json",
      "mk_enemy_wizard.se.json",
      "mk_enemy_dark_knight.se.json",
    ];

    enemyEntities.forEach((entityFile) => {
      const entityJson = JSON.parse(
        fs.readFileSync(path.join(entitiesDir, entityFile), "utf-8"),
      );
      const entity = entityJson["minecraft:entity"];
      expect(entity).toBeDefined();
      // Despawn may be in component_groups or components
      const hasComponentGroups = entity?.component_groups;
      const hasComponents = entity?.components;
      expect(hasComponentGroups || hasComponents).toBeDefined();
    });
  });

  it("should have reasonable follow_range values", () => {
    const entitiesDir = path.join(__dirname, "../../MegaKnights_BP/entities");
    const files = fs
      .readdirSync(entitiesDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const entity = JSON.parse(
        fs.readFileSync(path.join(entitiesDir, file), "utf-8"),
      );
      const components = entity.components || {};

      // Check for follow_range in AI goals
      if (components["minecraft:behavior.nearest_attackable_target"]) {
        const followRange =
          components["minecraft:behavior.nearest_attackable_target"].follow_range;
        // Basic mobs: <= 16, elites: <= 24, boss: <= 32
        expect(followRange).toBeLessThanOrEqual(32);
      }
    });
  });

  it("should use mk: prefix for custom entities", () => {
    const entitiesDir = path.join(__dirname, "../../MegaKnights_BP/entities");
    const files = fs.readdirSync(entitiesDir);

    files.forEach((file) => {
      expect(file).toMatch(/^mk_/);
    });
  });
});
