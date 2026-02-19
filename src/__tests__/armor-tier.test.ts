import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Armor Tier Progression", () => {
  it("should have all tier armor files", () => {
    const armorDir = path.join(__dirname, "../../MegaKnights_BP/items/armor");
    const files = fs.readdirSync(armorDir);

    const tiers = ["page", "squire", "knight", "champion", "mega_knight"];
    const parts = ["helmet", "chestplate", "leggings", "boots"];

    tiers.forEach((tier) => {
      parts.forEach((part) => {
        const fileName = `mk_${tier}_${part}.json`;
        expect(files).toContain(fileName);
      });
    });
  });

  it("should have tier progression base structure", () => {
    const recipesDir = path.join(__dirname, "../../MegaKnights_BP/recipes");
    const files = fs.readdirSync(recipesDir);

    // Blueprint recipes should exist (core progression mechanic)
    const blueprintFiles = files.filter((f) => f.includes("blueprint"));
    expect(blueprintFiles.length).toBeGreaterThan(0);
  });

  it("should have valid armor durability values", () => {
    const armorDir = path.join(__dirname, "../../MegaKnights_BP/items/armor");
    const files = fs
      .readdirSync(armorDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const itemJson = JSON.parse(
        fs.readFileSync(path.join(armorDir, file), "utf-8"),
      );
      const item = itemJson["minecraft:item"];
      const durability = item?.components?.["minecraft:durability"]?.max_durability;

      // All armor should have durability > 0
      expect(durability).toBeGreaterThan(0);
      // Durability should be reasonable (100-1000 range for non-meta, higher for meta)
      expect(durability).toBeLessThan(2000);
    });
  });

  it("should have armor with correct enchantability", () => {
    const armorDir = path.join(__dirname, "../../MegaKnights_BP/items/armor");
    const files = fs
      .readdirSync(armorDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const itemJson = JSON.parse(
        fs.readFileSync(path.join(armorDir, file), "utf-8"),
      );
      const item = itemJson["minecraft:item"];
      const enchantability =
        item?.components?.["minecraft:enchantable"]?.value;

      // All armor should have enchantability
      expect(enchantability).toBeGreaterThan(0);
      // Standard armor enchantability is 10-22
      expect(enchantability).toBeLessThanOrEqual(30);
    });
  });
});
