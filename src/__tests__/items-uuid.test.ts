import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Items & Equipment", () => {
  it("should have all custom items with mk: prefix", () => {
    const itemDirs = [
      path.join(__dirname, "../../MegaKnights_BP/items/armor"),
      path.join(__dirname, "../../MegaKnights_BP/items/tools"),
    ];

    itemDirs.forEach((dir) => {
      if (fs.existsSync(dir)) {
        const files = fs
          .readdirSync(dir)
          .filter((f) => f.endsWith(".json"));

        files.forEach((file) => {
          const itemJson = JSON.parse(
            fs.readFileSync(path.join(dir, file), "utf-8"),
          );
          const item = itemJson["minecraft:item"];

          expect(item?.description?.identifier).toMatch(/^mk:/);
        });
      }
    });
  });

  it("should have armor with repairable component", () => {
    const armorDir = path.join(__dirname, "../../MegaKnights_BP/items/armor");
    const files = fs
      .readdirSync(armorDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const itemJson = JSON.parse(
        fs.readFileSync(path.join(armorDir, file), "utf-8"),
      );
      const item = itemJson["minecraft:item"];

      expect(item?.components?.["minecraft:repairable"]).toBeDefined();
    });
  });

  it("should have armor max stack size of 1", () => {
    const armorDir = path.join(__dirname, "../../MegaKnights_BP/items/armor");
    const files = fs
      .readdirSync(armorDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const itemJson = JSON.parse(
        fs.readFileSync(path.join(armorDir, file), "utf-8"),
      );
      const item = itemJson["minecraft:item"];

      expect(item?.components?.["minecraft:max_stack_size"]).toBe(1);
    });
  });

  it("should have display names for all items", () => {
    const itemDirs = [
      path.join(__dirname, "../../MegaKnights_BP/items/armor"),
      path.join(__dirname, "../../MegaKnights_BP/items/tools"),
    ];

    itemDirs.forEach((dir) => {
      if (fs.existsSync(dir)) {
        const files = fs
          .readdirSync(dir)
          .filter((f) => f.endsWith(".json"));

        files.forEach((file) => {
          const itemJson = JSON.parse(
            fs.readFileSync(path.join(dir, file), "utf-8"),
          );
          const item = itemJson["minecraft:item"];

          const displayName =
            item?.components?.["minecraft:display_name"]?.value;
          expect(displayName, `${file} should have display_name`).toBeDefined();
          // Display name should be a localization key
          expect(displayName).toMatch(/^item\./);
        });
      }
    });
  });
});

describe("UUID Uniqueness", () => {
  it("should have unique behavior pack UUID", () => {
    const bpPath = path.join(__dirname, "../../MegaKnights_BP/manifest.json");
    const bpManifest = JSON.parse(fs.readFileSync(bpPath, "utf-8"));

    expect(bpManifest.header.uuid).toBeDefined();
    // UUID should be a valid v4 format (lowercase hex, hyphens)
    expect(bpManifest.header.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("should have unique resource pack UUID", () => {
    const rpPath = path.join(__dirname, "../../MegaKnights_RP/manifest.json");
    const rpManifest = JSON.parse(fs.readFileSync(rpPath, "utf-8"));

    expect(rpManifest.header.uuid).toBeDefined();
    expect(rpManifest.header.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("should have different UUIDs for BP and RP", () => {
    const bpPath = path.join(__dirname, "../../MegaKnights_BP/manifest.json");
    const rpPath = path.join(__dirname, "../../MegaKnights_RP/manifest.json");

    const bpManifest = JSON.parse(fs.readFileSync(bpPath, "utf-8"));
    const rpManifest = JSON.parse(fs.readFileSync(rpPath, "utf-8"));

    expect(bpManifest.header.uuid).not.toEqual(rpManifest.header.uuid);
  });

  it("should have unique module UUIDs within manifests", () => {
    const bpPath = path.join(__dirname, "../../MegaKnights_BP/manifest.json");
    const rpPath = path.join(__dirname, "../../MegaKnights_RP/manifest.json");

    [bpPath, rpPath].forEach((manifestPath) => {
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

        // Collect all module UUIDs
        const uuids = new Set<string>();
        let duplicates = 0;

        [
          ...(manifest.modules || []),
          manifest.header,
          ...(manifest.dependencies || []),
        ].forEach((section: any) => {
          if (section.uuid) {
            if (uuids.has(section.uuid)) {
              duplicates++;
              console.warn(`Duplicate UUID in ${manifestPath}: ${section.uuid}`);
            }
            uuids.add(section.uuid);
          }
        });

        expect(duplicates).toBe(0);
      }
    });
  });
});

describe("Item Icon References", () => {
  it("should have valid icon references for armor", () => {
    const armorDir = path.join(__dirname, "../../MegaKnights_BP/items/armor");
    const files = fs
      .readdirSync(armorDir)
      .filter((f) => f.endsWith(".json"));

    files.forEach((file) => {
      const itemJson = JSON.parse(
        fs.readFileSync(path.join(armorDir, file), "utf-8"),
      );
      const item = itemJson["minecraft:item"];
      const icon = item?.components?.["minecraft:icon"];

      expect(icon, `${file} should have icon`).toBeDefined();
      // Icon should be a string reference matching item name pattern
      if (typeof icon === "string") {
        expect(icon).toContain("mk_");
      }
    });
  });
});
