/** Bounded LRU map for tick-based rate limiting — evicts oldest entries when over capacity */
export class LRUTickCache {
  private map = new Map<string, number>();
  private order: string[] = [];
  private maxSize: number;
  constructor(maxSize: number) { this.maxSize = maxSize; }
  get(key: string): number | undefined { return this.map.get(key); }
  set(key: string, value: number): void {
    this.map.set(key, value);
    const idx = this.order.indexOf(key);
    if (idx >= 0) { this.order.splice(idx, 1); }
    this.order.push(key);
    while (this.map.size > this.maxSize) {
      const oldest = this.order.shift();
      if (oldest) { this.map.delete(oldest); }
    }
  }
}
