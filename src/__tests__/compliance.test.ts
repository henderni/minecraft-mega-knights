import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Pack Rules Compliance", () => {
  it("should have density_limit on all spawn rules", () => {
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
      // density_limit is nested in conditions array
      const spawnRule = rule["minecraft:spawn_rules"];
      expect(spawnRule).toBeDefined();
      if (spawnRule?.conditions?.length > 0) {
        const hasDensityLimit = spawnRule.conditions.some(
          (c: Record<string, any>) => c["minecraft:density_limit"],
        );
        expect(hasDensityLimit).toBe(true);
      }
    });
  });

  it("should have mk: prefix on all custom items", () => {
    const itemsDir = path.join(__dirname, "../../MegaKnights_BP/items");
    const armorDir = path.join(itemsDir, "armor");

    if (fs.existsSync(armorDir)) {
      const files = fs.readdirSync(armorDir);
      files.forEach((file) => {
        if (file.endsWith(".json")) {
          const itemJson = JSON.parse(
            fs.readFileSync(path.join(armorDir, file), "utf-8"),
          );
          // Item structure is nested under minecraft:item
          const item = itemJson["minecraft:item"];
          expect(item?.description?.identifier).toMatch(/^mk:/);
        }
      });
    }
  });

  it("lang file should have required localization keys", () => {
    const langFile = path.join(__dirname, "../../MegaKnights_RP/texts/en_US.lang");
    const lang = fs.readFileSync(langFile, "utf-8");

    const requiredKeys = ["pack.name", "pack.description"];
    requiredKeys.forEach((key) => {
      expect(lang).toContain(key);
    });
  });
});
