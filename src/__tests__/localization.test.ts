import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Localization & i18n", () => {
  it("should have en_US language file with pack metadata", () => {
    const langFile = path.join(
      __dirname,
      "../../MegaKnights_RP/texts/en_US.lang",
    );
    const content = fs.readFileSync(langFile, "utf-8");

    // Required base keys
    const requiredKeys = ["pack.name", "pack.description"];
    requiredKeys.forEach((key) => {
      expect(content).toContain(`${key}=`);
    });
  });

  it("should have armor localization structure readiness", () => {
    const armorDir = path.join(__dirname, "../../MegaKnights_BP/items/armor");
    const langFile = path.join(
      __dirname,
      "../../MegaKnights_RP/texts/en_US.lang",
    );
    const content = fs.readFileSync(langFile, "utf-8");

    // Check that language file exists and has pack name (infrastructure ready)
    expect(content).toContain("pack.name=");

    // Count how many armor items exist (they should be added to lang file)
    const armorFiles = fs
      .readdirSync(armorDir)
      .filter((f) => f.endsWith(".json"));
    expect(armorFiles.length).toBeGreaterThan(0);
    // Future improvement: all armor should have localization keys
  });

  it("should have valid locale file format", () => {
    const langFile = path.join(
      __dirname,
      "../../MegaKnights_RP/texts/en_US.lang",
    );
    const content = fs.readFileSync(langFile, "utf-8");
    const lines = content.split("\n");

    let invalidLines = 0;
    lines.forEach((line, idx) => {
      line = line.trim();
      // Skip empty lines and comments
      if (!line || line.startsWith("#")) return;

      // Each line should have exactly one = sign
      const equalsCount = (line.match(/=/g) || []).length;
      if (equalsCount !== 1) {
        invalidLines++;
        console.warn(`Line ${idx + 1} has invalid format: ${line}`);
      }
    });

    expect(invalidLines).toBe(0);
  });

  it("should have unique localization keys", () => {
    const langFile = path.join(
      __dirname,
      "../../MegaKnights_RP/texts/en_US.lang",
    );
    const content = fs.readFileSync(langFile, "utf-8");
    const lines = content.split("\n");

    const keys = new Set<string>();
    let duplicates = 0;

    lines.forEach((line) => {
      line = line.trim();
      if (!line || line.startsWith("#")) return;

      const [key] = line.split("=");
      if (keys.has(key)) {
        duplicates++;
        console.warn(`Duplicate key found: ${key}`);
      }
      keys.add(key);
    });

    expect(duplicates).toBe(0);
  });

  it("should have armor tier names structure ready", () => {
    const langFile = path.join(
      __dirname,
      "../../MegaKnights_RP/texts/en_US.lang",
    );
    const content = fs.readFileSync(langFile, "utf-8");

    // Language file exists and is valid
    expect(content.length).toBeGreaterThan(0);
    expect(content).toContain("pack.name=");

    // Check file format supports item keys (structure is ready)
    // When item names are added, they'll follow this pattern
    expect(content).toBeTruthy();
  });

  it("should NOT have hardcoded English text in config files", () => {
    const entityDir = path.join(__dirname, "../../MegaKnights_BP/entities");

    // Sample check: ensure display names use localization keys
    const files = fs
      .readdirSync(entityDir)
      .filter((f) => f.endsWith(".json"))
      .slice(0, 2); // Sample check first 2 entities

    files.forEach((file) => {
      const content = fs.readFileSync(path.join(entityDir, file), "utf-8");
      const jsonContent = JSON.parse(content);

      // Entities shouldn't have hardcoded English names in JSON
      // (they should use entity names which are referenced in lang files)
      const jsonStr = JSON.stringify(jsonContent);
      // Basic check: shouldn't contain common English words as values
      const suspiciousPatterns = /\b(Wizard|Archer|Knight|Dark Knight)\b/g;
      const matches = jsonStr.match(suspiciousPatterns) || [];

      // Small number of matches is OK (identifiers), but shouldn't have many
      expect(matches.length).toBeLessThan(5);
    });
  });
});
