import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("JSON Files Validation", () => {
  const validateJSONFile = (filePath: string): boolean => {
    const content = fs.readFileSync(filePath, "utf-8");
    try {
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  };

  it("should have valid behavior pack manifest", () => {
    const manifestPath = path.join(
      __dirname,
      "../../MegaKnights_BP/manifest.json",
    );
    expect(validateJSONFile(manifestPath)).toBe(true);
  });

  it("should have valid resource pack manifest", () => {
    const manifestPath = path.join(
      __dirname,
      "../../MegaKnights_RP/manifest.json",
    );
    expect(validateJSONFile(manifestPath)).toBe(true);
  });

  it("should validate all entity JSON files", () => {
    const entitiesDir = path.join(__dirname, "../../MegaKnights_BP/entities");
    const files = fs
      .readdirSync(entitiesDir)
      .filter((f) => f.endsWith(".json"));

    expect(files.length).toBeGreaterThan(0);
    files.forEach((file) => {
      const filePath = path.join(entitiesDir, file);
      expect(validateJSONFile(filePath)).toBe(true);
    });
  });

  it("should validate all spawn rule JSON files", () => {
    const spawnRulesDir = path.join(
      __dirname,
      "../../MegaKnights_BP/spawn_rules",
    );
    const files = fs
      .readdirSync(spawnRulesDir)
      .filter((f) => f.endsWith(".json"));

    expect(files.length).toBeGreaterThan(0);
    files.forEach((file) => {
      const filePath = path.join(spawnRulesDir, file);
      expect(validateJSONFile(filePath)).toBe(true);
    });
  });

  it("should validate all recipe JSON files", () => {
    const recipesDir = path.join(__dirname, "../../MegaKnights_BP/recipes");
    const files = fs
      .readdirSync(recipesDir)
      .filter((f) => f.endsWith(".json"));

    expect(files.length).toBeGreaterThan(0);
    files.forEach((file) => {
      const filePath = path.join(recipesDir, file);
      expect(validateJSONFile(filePath)).toBe(true);
    });
  });
});
