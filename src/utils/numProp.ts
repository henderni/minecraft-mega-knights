/** Safe numeric dynamic property read — guards against non-number corruption */
export const numProp = (v: unknown, d = 0): number => typeof v === "number" ? v : d;

/** Safe boolean dynamic property read — guards against non-boolean corruption */
export const boolProp = (v: unknown, d = false): boolean => typeof v === "boolean" ? v : d;
