/**
 * Enemy faction definitions for biome-aware camp selection.
 * Factions replace the generic camp naming with themed identities
 * based on the biome where the camp spawns.
 */

export type FactionId = "marauders" | "grave_walkers" | "ironclad_raiders";

export interface FactionDef {
  id: FactionId;
  displayName: string;
  campPrefix: string; // Replaces generic tier name in camp messages
  /** Biome ID substrings that trigger this faction (checked against Dimension.getBiome().id) */
  biomeKeywords: string[];
}

export const FACTIONS: FactionDef[] = [
  {
    id: "grave_walkers",
    displayName: "Grave Walkers",
    campPrefix: "Grave Walker",
    biomeKeywords: ["swamp", "dark_forest", "roofed", "mangrove", "pale"],
  },
  {
    id: "ironclad_raiders",
    displayName: "Ironclad Raiders",
    campPrefix: "Ironclad",
    biomeKeywords: ["mountain", "taiga", "snowy", "stony", "peaks", "highlands"],
  },
  {
    id: "marauders",
    displayName: "Marauders",
    campPrefix: "Marauder",
    biomeKeywords: [], // Default faction — matches everything else
  },
];

/** Guard compositions per faction — override the default camp tier guards */
export interface FactionGuardOverride {
  entityId: string;
  count: number;
}

/** Faction-specific guard weight modifiers applied on top of tier defaults.
 *  Values multiply the guard count for that entity type. */
export const FACTION_GUARD_WEIGHTS: Record<FactionId, Partial<Record<string, number>>> = {
  marauders: {
    "mk:mk_enemy_knight": 1.5, // Knight-heavy
    "mk:mk_enemy_archer": 1.0,
    "mk:mk_enemy_wizard": 0.5,
    "mk:mk_enemy_dark_knight": 0.75,
  },
  grave_walkers: {
    "mk:mk_enemy_knight": 0.75,
    "mk:mk_enemy_archer": 0.75,
    "mk:mk_enemy_wizard": 1.5, // Wizard-heavy
    "mk:mk_enemy_dark_knight": 1.0,
  },
  ironclad_raiders: {
    "mk:mk_enemy_knight": 1.0,
    "mk:mk_enemy_archer": 0.75,
    "mk:mk_enemy_wizard": 0.5,
    "mk:mk_enemy_dark_knight": 1.5, // Dark Knight-heavy
  },
};

/**
 * Determine faction from a biome ID string.
 * Falls back to Marauders if biome unknown or API unavailable.
 */
export function getFactionForBiome(biomeId: string): FactionDef {
  const lower = biomeId.toLowerCase();
  for (const faction of FACTIONS) {
    if (faction.biomeKeywords.length === 0) {continue;} // Skip default
    if (faction.biomeKeywords.some((kw) => lower.includes(kw))) {
      return faction;
    }
  }
  // Default: Marauders
  return FACTIONS[FACTIONS.length - 1];
}
