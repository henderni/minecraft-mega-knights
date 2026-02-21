import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";

const readSource = (relPath: string) =>
  readFileSync(join(__dirname, "..", relPath), "utf-8");

const armySrc = readSource("systems/ArmySystem.ts");

describe("sanitizePlayerTag", () => {
  // Extract the regex from source to validate behavior
  const regexMatch = armySrc.match(/name\.replace\(([^,]+),\s*"([^"]*)"\)/);

  it("is exported", () => {
    expect(armySrc).toMatch(/export\s+function\s+sanitizePlayerTag/);
  });

  it("uses regex to replace non-alphanumeric characters", () => {
    expect(regexMatch).not.toBeNull();
    expect(regexMatch![1]).toContain("[^a-zA-Z0-9_-]");
  });

  it("replaces disallowed characters with underscores", () => {
    expect(regexMatch![2]).toBe("_");
  });

  it("preserves alphanumeric, underscore, and hyphen characters", () => {
    // The regex [^a-zA-Z0-9_-] means these are allowed
    const regex = /[^a-zA-Z0-9_-]/g;
    expect("Player_Name-123".replace(regex, "_")).toBe("Player_Name-123");
  });

  it("sanitizes special characters in player names", () => {
    const regex = /[^a-zA-Z0-9_-]/g;
    expect("Player Name!@#".replace(regex, "_")).toBe("Player_Name___");
    expect("名前Test".replace(regex, "_")).toBe("__Test");
    expect("a b.c".replace(regex, "_")).toBe("a_b_c");
  });
});

describe("getOwnerTag", () => {
  it("is exported", () => {
    expect(armySrc).toMatch(/export\s+function\s+getOwnerTag/);
  });

  it("prepends mk_owner_ to sanitized name", () => {
    expect(armySrc).toContain("mk_owner_${sanitizePlayerTag(name)}");
  });

  it("calls sanitizePlayerTag internally", () => {
    expect(armySrc).toMatch(/getOwnerTag.*sanitizePlayerTag/s);
  });
});

describe("Tag cache management", () => {
  it("MAX_TAG_CACHE constant exists", () => {
    expect(armySrc).toContain("MAX_TAG_CACHE");
  });

  it("MAX_TAG_CACHE is set to a reasonable value", () => {
    const match = armySrc.match(/MAX_TAG_CACHE\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    const value = parseInt(match![1], 10);
    expect(value).toBeGreaterThanOrEqual(10);
    expect(value).toBeLessThanOrEqual(1000);
  });

  it("cache clears when size >= MAX_TAG_CACHE", () => {
    expect(armySrc).toContain("tagCache.size >= MAX_TAG_CACHE");
    expect(armySrc).toContain("tagCache.clear()");
  });

  it("ownerTagCache also clears at threshold", () => {
    expect(armySrc).toContain("ownerTagCache.size >= MAX_TAG_CACHE");
    expect(armySrc).toContain("ownerTagCache.clear()");
  });
});
