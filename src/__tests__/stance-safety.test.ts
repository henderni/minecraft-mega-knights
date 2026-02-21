/**
 * stance-safety.test.ts
 *
 * Source-as-text tests verifying type safety around entity stance
 * dynamic property access in ArmySystem. Ensures typeof guard
 * prevents NaN propagation from corrupted/external data.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.join(__dirname, "..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf-8");
}

const armySrc = readSource("systems/ArmySystem.ts");

// Extract the stance handling block — from rawStance to the end of isSneaking block
const stanceStart = armySrc.indexOf("rawStance");
const stanceEnd = armySrc.indexOf("triggerEvent(eventName)");
const stanceBlock = armySrc.slice(stanceStart, stanceEnd + 50);

describe("Stance type safety: typeof guard", () => {
  it("checks typeof before using stance value in Math operations", () => {
    expect(stanceBlock).toContain("typeof");
    expect(stanceBlock).toMatch(/typeof\s+\w+\s*===\s*"number"/);
  });

  it("defaults non-number stance values to 0", () => {
    // Pattern: typeof raw === "number" ? raw : 0
    expect(stanceBlock).toMatch(/typeof\s+\w+\s*===\s*"number"\s*\?\s*\w+\s*:\s*0/);
  });
});

describe("Stance type safety: value bounds", () => {
  it("clamps stance to 0-2 range with Math.max/min", () => {
    expect(stanceBlock).toContain("Math.max(0");
    expect(stanceBlock).toContain("Math.min(2");
  });

  it("computes nextStance with modulo 3", () => {
    expect(stanceBlock).toContain("% 3");
  });

  it("writes stance back via setDynamicProperty", () => {
    expect(stanceBlock).toContain("setDynamicProperty");
    expect(stanceBlock).toContain("mk:stance");
  });
});

describe("Stance type safety: no raw cast", () => {
  it("does not use 'as number' cast directly on getDynamicProperty result for stance", () => {
    // The old pattern was: (entity.getDynamicProperty("mk:stance") as number)
    // This should no longer exist — replaced by typeof guard
    const stanceGetProp = armySrc.match(
      /getDynamicProperty\("mk:stance"\)\s*as\s*number/,
    );
    expect(stanceGetProp).toBeNull();
  });
});
