/**
 * numProp.test.ts
 *
 * Direct behavioral tests for numProp() and boolProp() utility functions.
 * These are pure functions with no @minecraft/server dependency — safe to import directly.
 */

import { describe, it, expect } from "vitest";
import { numProp, boolProp } from "../utils/numProp";

describe("numProp: basic behavior", () => {
  it("returns numbers as-is", () => {
    expect(numProp(42)).toBe(42);
    expect(numProp(0)).toBe(0);
    expect(numProp(-7)).toBe(-7);
    expect(numProp(3.14)).toBeCloseTo(3.14);
  });

  it("returns default for undefined", () => {
    expect(numProp(undefined)).toBe(0);
  });

  it("returns default for null", () => {
    expect(numProp(null)).toBe(0);
  });

  it("returns default for string values", () => {
    expect(numProp("hello")).toBe(0);
    expect(numProp("42")).toBe(0); // String "42" is not a number
    expect(numProp("")).toBe(0);
  });

  it("returns default for boolean values", () => {
    expect(numProp(true)).toBe(0);
    expect(numProp(false)).toBe(0);
  });

  it("returns default for NaN", () => {
    // typeof NaN === "number", so numProp returns NaN — this documents the behavior
    expect(numProp(NaN)).toBeNaN();
  });

  it("returns Infinity for Infinity (typeof Infinity === 'number')", () => {
    expect(numProp(Infinity)).toBe(Infinity);
    expect(numProp(-Infinity)).toBe(-Infinity);
  });
});

describe("numProp: custom defaults", () => {
  it("uses custom default when value is not a number", () => {
    expect(numProp(undefined, 5)).toBe(5);
    expect(numProp(null, -1)).toBe(-1);
    expect(numProp("hello", 99)).toBe(99);
  });

  it("ignores custom default when value is a number", () => {
    expect(numProp(42, 99)).toBe(42);
    expect(numProp(0, 99)).toBe(0);
  });
});

describe("boolProp: basic behavior", () => {
  it("returns booleans as-is", () => {
    expect(boolProp(true)).toBe(true);
    expect(boolProp(false)).toBe(false);
  });

  it("returns default for undefined", () => {
    expect(boolProp(undefined)).toBe(false);
  });

  it("returns default for null", () => {
    expect(boolProp(null)).toBe(false);
  });

  it("returns default for number values", () => {
    expect(boolProp(0)).toBe(false);
    expect(boolProp(1)).toBe(false);
  });

  it("returns default for string values", () => {
    expect(boolProp("true")).toBe(false);
    expect(boolProp("")).toBe(false);
  });
});

describe("boolProp: custom defaults", () => {
  it("uses custom default when value is not a boolean", () => {
    expect(boolProp(undefined, true)).toBe(true);
    expect(boolProp(null, true)).toBe(true);
    expect(boolProp(42, true)).toBe(true);
  });

  it("ignores custom default when value is a boolean", () => {
    expect(boolProp(false, true)).toBe(false);
    expect(boolProp(true, false)).toBe(true);
  });
});
