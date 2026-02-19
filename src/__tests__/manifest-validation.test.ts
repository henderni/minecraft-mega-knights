import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Pack Configuration", () => {
  it("should have behavior pack manifest with correct format version", () => {
    const manifestPath = path.join(
      __dirname,
      "../../MegaKnights_BP/manifest.json",
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

    expect(manifest.format_version).toBe(2);
    expect(manifest.header).toBeDefined();
    expect(manifest.header.min_engine_version).toEqual([1, 21, 50]);
  });

  it("should have resource pack manifest with correct format version", () => {
    const manifestPath = path.join(
      __dirname,
      "../../MegaKnights_RP/manifest.json",
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

    expect(manifest.format_version).toBe(2);
    expect(manifest.header).toBeDefined();
  });

  it("behavior pack should have unique UUID", () => {
    const manifestPath = path.join(
      __dirname,
      "../../MegaKnights_BP/manifest.json",
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

    expect(manifest.header.uuid).toBeDefined();
    expect(manifest.header.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("resource pack should have unique UUID", () => {
    const manifestPath = path.join(
      __dirname,
      "../../MegaKnights_RP/manifest.json",
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

    expect(manifest.header.uuid).toBeDefined();
    expect(manifest.header.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("should have version as array with 3 numbers", () => {
    const bpPath = path.join(__dirname, "../../MegaKnights_BP/manifest.json");
    const rpPath = path.join(__dirname, "../../MegaKnights_RP/manifest.json");

    const bpManifest = JSON.parse(fs.readFileSync(bpPath, "utf-8"));
    const rpManifest = JSON.parse(fs.readFileSync(rpPath, "utf-8"));

    expect(Array.isArray(bpManifest.header.version)).toBe(true);
    expect(bpManifest.header.version.length).toBe(3);
    expect(bpManifest.header.version.every((v: unknown) => typeof v === "number")).toBe(true);

    expect(Array.isArray(rpManifest.header.version)).toBe(true);
    expect(rpManifest.header.version.length).toBe(3);
    expect(rpManifest.header.version.every((v: unknown) => typeof v === "number")).toBe(true);
  });
});
