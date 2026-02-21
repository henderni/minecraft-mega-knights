import { describe, it, expect } from "vitest";
import { LRUTickCache } from "../utils/LRUTickCache";

describe("LRUTickCache", () => {
  it("get() returns undefined for missing keys", () => {
    const cache = new LRUTickCache(10);
    expect(cache.get("missing")).toBeUndefined();
  });

  it("set()/get() stores and retrieves values", () => {
    const cache = new LRUTickCache(10);
    cache.set("a", 100);
    cache.set("b", 200);
    expect(cache.get("a")).toBe(100);
    expect(cache.get("b")).toBe(200);
  });

  it("evicts oldest entries when exceeding maxSize", () => {
    const cache = new LRUTickCache(3);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    cache.set("d", 4); // should evict "a"
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
    expect(cache.get("d")).toBe(4);
  });

  it("re-setting existing key moves it to end of eviction order", () => {
    const cache = new LRUTickCache(3);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    cache.set("a", 10); // refresh "a" — now "b" is oldest
    cache.set("d", 4);  // should evict "b", not "a"
    expect(cache.get("a")).toBe(10);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe(3);
    expect(cache.get("d")).toBe(4);
  });

  it("maxSize=1 evicts on second set", () => {
    const cache = new LRUTickCache(1);
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
    cache.set("b", 2);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
  });

  it("overwrites value for existing key", () => {
    const cache = new LRUTickCache(5);
    cache.set("x", 10);
    cache.set("x", 20);
    expect(cache.get("x")).toBe(20);
  });

  it("handles many inserts without error", () => {
    const cache = new LRUTickCache(10);
    for (let i = 0; i < 100; i++) {
      cache.set(`key_${i}`, i);
    }
    // Only the last 10 should remain
    expect(cache.get("key_89")).toBeUndefined();
    expect(cache.get("key_90")).toBe(90);
    expect(cache.get("key_99")).toBe(99);
  });
});
