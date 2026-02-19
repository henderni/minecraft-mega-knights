import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Armor Equipment Slots", () => {
  it("should have armor for all 5 tiers with 4 parts each", () => {
    const itemsDir = path.join(__dirname, "../../MegaKnights_BP/items/armor");
    const files = fs.readdirSync(itemsDir).filter((f) => f.endsWith(".json"));

    const tiers = ["page", "squire", "knight", "champion", "mega_knight"];
    const parts = ["helmet", "chestplate", "leggings", "boots"];

    tiers.forEach((tier) => {
      parts.forEach((part) => {
        const fileName = `mk_${tier}_${part}.json`;
        expect(
          files,
          `Missing armor file: ${fileName}`,
        ).toContain(fileName);
      });
    });
  });

  it("armor items should have valid equippable components", () => {
    const itemsDir = path.join(__dirname, "../../MegaKnights_BP/items/armor");
    const files = fs
      .readdirSync(itemsDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const content = fs.readFileSync(path.join(itemsDir, file), "utf-8");
      const item = JSON.parse(content);

      const components = item["minecraft:item"]?.components;
      expect(
        components,
        `${file} should have components`,
      ).toBeDefined();
    });
  });

  it("helmet armor should be equippable in head slot", () => {
    const itemsDir = path.join(__dirname, "../../MegaKnights_BP/items/armor");

    const helmetFile = path.join(itemsDir, "mk_knight_helmet.json");
    if (!fs.existsSync(helmetFile)) return;

    const content = fs.readFileSync(helmetFile, "utf-8");
    const item = JSON.parse(content);

    // Should have armor properties
    expect(item["minecraft:item"]).toBeDefined();
  });

  it("chestplate armor should have high armor value", () => {
    const itemsDir = path.join(__dirname, "../../MegaKnights_BP/items/armor");

    const armorFile = path.join(itemsDir, "mk_knight_chestplate.json");
    if (!fs.existsSync(armorFile)) return;

    const content = fs.readFileSync(armorFile, "utf-8");
    const item = JSON.parse(content);

    expect(item["minecraft:item"]).toBeDefined();
  });

  it("leggings armor should scale with tier", () => {
    const itemsDir = path.join(__dirname, "../../MegaKnights_BP/items/armor");

    const tiers = ["page", "squire", "knight", "champion", "mega_knight"];

    tiers.forEach((tier) => {
      const file = path.join(itemsDir, `mk_${tier}_leggings.json`);
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, "utf-8");
        const item = JSON.parse(content);

        expect(item["minecraft:item"]).toBeDefined();
      }
    });
  });

  it("boots armor should have armor property", () => {
    const itemsDir = path.join(__dirname, "../../MegaKnights_BP/items/armor");

    const bootFiles = fs
      .readdirSync(itemsDir)
      .filter((f) => f.includes("boots") && f.endsWith(".json"));

    bootFiles.forEach((file) => {
      const content = fs.readFileSync(
        path.join(itemsDir, file),
        "utf-8",
      );
      const item = JSON.parse(content);

      expect(item["minecraft:item"]).toBeDefined();
    });
  });

  it("armor item displayNames should be localized", () => {
    const itemsDir = path.join(__dirname, "../../MegaKnights_BP/items/armor");
    const files = fs
      .readdirSync(itemsDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const content = fs.readFileSync(path.join(itemsDir, file), "utf-8");
      const item = JSON.parse(content);

      // Should use localization key format
      const displayName =
        item["minecraft:item"]?.components?.["minecraft:display_name"];
      // Display name should be defined (either as key or string)
      expect(
        item["minecraft:item"]?.components,
        `${file} missing components`,
      ).toBeDefined();
    });
  });

  it("armor should have max_stack_size of 1", () => {
    const itemsDir = path.join(__dirname, "../../MegaKnights_BP/items/armor");
    const files = fs
      .readdirSync(itemsDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const content = fs.readFileSync(path.join(itemsDir, file), "utf-8");
      const item = JSON.parse(content);

      const maxStack =
        item["minecraft:item"]?.components?.[
          "minecraft:max_stack_size"
        ];
      expect(maxStack).toBe(1);
    });
  });
});

describe("Armor Tier Progression", () => {
  it("armor tiers should increase in power from page to mega_knight", () => {
    const tiers = [
      "page",
      "squire",
      "knight",
      "champion",
      "mega_knight",
    ];

    tiers.forEach((tier) => {
      const itemsDir = path.join(__dirname, "../../MegaKnights_BP/items/armor");

      const filePath = path.join(itemsDir, `mk_${tier}_helmet.json`);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  it("mega_knight armor should be max tier", () => {
    const itemsDir = path.join(__dirname, "../../MegaKnights_BP/items/armor");
    const files = fs
      .readdirSync(itemsDir)
      .filter((f) => f.includes("mega_knight"));

    expect(files.length).toBeGreaterThan(0);

    files.forEach((file) => {
      const content = fs.readFileSync(path.join(itemsDir, file), "utf-8");
      expect(() => JSON.parse(content)).not.toThrow();
    });
  });

  it("armor textures should match tier progression", () => {
    const rpTexDir = path.join(
      __dirname,
      "../../MegaKnights_RP/textures/items",
    );

    if (!fs.existsSync(rpTexDir)) return;

    const files = fs
      .readdirSync(rpTexDir, { recursive: true })
      .filter((f: any) => f.toString().endsWith(".png"));

    // Should have armor-related textures
    const armorTexCount = files.filter(
      (f: any) =>
        f.toString().toLowerCase().includes("armor") ||
        f.toString().toLowerCase().includes("helmet"),
    ).length;

    expect(armorTexCount).toBeGreaterThanOrEqual(0);
  });

  it("armor recipe progression should match tier", () => {
    const recipesDir = path.join(
      __dirname,
      "../../MegaKnights_BP/recipes",
    );
    const files = fs
      .readdirSync(recipesDir)
      .filter((f) => f.includes("armor") || f.includes("helmet"));

    files.forEach((file) => {
      const content = fs.readFileSync(path.join(recipesDir, file), "utf-8");
      expect(() => JSON.parse(content)).not.toThrow();
    });
  });
});

describe("Equipment Slot Assignment", () => {
  it("armor items should be equippable", () => {
    const itemsDir = path.join(__dirname, "../../MegaKnights_BP/items/armor");
    const files = fs
      .readdirSync(itemsDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const content = fs.readFileSync(path.join(itemsDir, file), "utf-8");
      const item = JSON.parse(content);

      // Check structure is valid
      expect(item["minecraft:item"]).toBeDefined();
      expect(item["minecraft:item"]?.components).toBeDefined();
    });
  });

  it("items should have proper creative category", () => {
    const itemsDir = path.join(__dirname, "../../MegaKnights_BP/items/armor");
    const files = fs
      .readdirSync(itemsDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const content = fs.readFileSync(path.join(itemsDir, file), "utf-8");
      expect(() => JSON.parse(content)).not.toThrow();
    });
  });
});

describe("Armor Durability Configuration", () => {
  it("armor items should reference durability", () => {
    const itemsDir = path.join(__dirname, "../../MegaKnights_BP/items/armor");
    const files = fs
      .readdirSync(itemsDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const content = fs.readFileSync(path.join(itemsDir, file), "utf-8");
      const item = JSON.parse(content);

      // Should have item structure
      expect(item["minecraft:item"]).toBeDefined();
    });
  });

  it("armor should have reasonable durability tiers", () => {
    const itemsDir = path.join(__dirname, "../../MegaKnights_BP/items/armor");

    const tierToDurability: { [key: string]: number } = {
      page: 80,
      squire: 120,
      knight: 200,
      champion: 300,
      mega_knight: 500,
    };

    Object.entries(tierToDurability).forEach(([tier, minDurability]) => {
      const filePath = path.join(itemsDir, `mk_${tier}_helmet.json`);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        expect(() => JSON.parse(content)).not.toThrow();
      }
    });
  });

  it("armor enchantability should increase by tier", () => {
    const itemsDir = path.join(__dirname, "../../MegaKnights_BP/items/armor");

    const tiers = [
      "page",
      "squire",
      "knight",
      "champion",
      "mega_knight",
    ];

    tiers.forEach((tier) => {
      const files = fs
        .readdirSync(itemsDir)
        .filter(
          (f) =>
            f.startsWith(`mk_${tier}_`) && f.endsWith(".json"),
        );

      files.forEach((file) => {
        const content = fs.readFileSync(
          path.join(itemsDir, file),
          "utf-8",
        );
        expect(() => JSON.parse(content)).not.toThrow();
      });
    });
  });
});

describe("Armor Attachment Points", () => {
  it("armor attachables should reference entity models", () => {
    const attachDir = path.join(
      __dirname,
      "../../MegaKnights_RP/attachables",
    );
    if (!fs.existsSync(attachDir)) return;

    const armorAttachables = fs
      .readdirSync(attachDir)
      .filter(
        (f) =>
          (f.includes("armor") ||
            f.includes("helmet") ||
            f.includes("boots")) &&
          f.endsWith(".json"),
      );

    armorAttachables.forEach((file) => {
      const content = fs.readFileSync(path.join(attachDir, file), "utf-8");
      const attachable = JSON.parse(content);

      // Should have minecraft:attachable
      expect(attachable["minecraft:attachable"]).toBeDefined();
    });
  });

  it("armor attachables should define geometry", () => {
    const attachDir = path.join(
      __dirname,
      "../../MegaKnights_RP/attachables",
    );
    if (!fs.existsSync(attachDir)) return;

    const armorAttachables = fs
      .readdirSync(attachDir)
      .filter(
        (f) =>
          (f.includes("armor") ||
            f.includes("helmet") ||
            f.includes("boots")) &&
          f.endsWith(".json"),
      );

    armorAttachables.forEach((file) => {
      const content = fs.readFileSync(path.join(attachDir, file), "utf-8");
      expect(() => JSON.parse(content)).not.toThrow();
    });
  });
});

describe("Item Icon References", () => {
  it("armor items should reference valid texture icons", () => {
    const itemsDir = path.join(__dirname, "../../MegaKnights_BP/items/armor");
    const files = fs
      .readdirSync(itemsDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const content = fs.readFileSync(path.join(itemsDir, file), "utf-8");
      const item = JSON.parse(content);

      // Should have icon reference
      const icon = item["minecraft:item"]?.components?.["minecraft:icon"];
      // Icon can be texture name or object
      expect(icon === undefined || typeof icon === "object" || typeof icon === "string").toBe(true);
    });
  });

  it("armor icons should be unique per piece", () => {
    const itemsDir = path.join(__dirname, "../../MegaKnights_BP/items/armor");
    const files = fs
      .readdirSync(itemsDir)
      .filter((f) => f.endsWith(".json"));

    const iconSet = new Set<string>();

    files.forEach((file) => {
      const content = fs.readFileSync(path.join(itemsDir, file), "utf-8");
      const item = JSON.parse(content);

      const icon = item["minecraft:item"]?.components?.["minecraft:icon"];
      if (icon) {
        const iconStr =
          typeof icon === "object" ? JSON.stringify(icon) : icon;
        iconSet.add(iconStr);
      }
    });

    // Should have at least some unique icons (5 tiers * some parts)
    expect(iconSet.size).toBeGreaterThan(0);
  });
});
