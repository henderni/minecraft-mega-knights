export interface ArmorTier {
  name: string;
  tier: number;
  prefix: string;
  protection: { helmet: number; chest: number; legs: number; boots: number };
  durability: number;
  repairItem: string;
  unlockDay: number;
  tokenItem: string | null;
}

/** Tier names indexed by tier number — shared by DayCounterSystem HUD and QuestJournalSystem */
export const TIER_NAMES = ["Page", "Squire", "Knight", "Champion", "Mega Knight"];

export const ARMOR_TIERS: ArmorTier[] = [
  {
    name: "Page",
    tier: 0,
    prefix: "mk_page",
    protection: { helmet: 2, chest: 3, legs: 2, boots: 1 },
    durability: 100,
    repairItem: "minecraft:leather",
    unlockDay: 0,
    tokenItem: null,
  },
  {
    name: "Squire",
    tier: 1,
    prefix: "mk_squire",
    protection: { helmet: 3, chest: 5, legs: 4, boots: 2 },
    durability: 200,
    repairItem: "minecraft:iron_ingot",
    unlockDay: 20,
    tokenItem: "mk:mk_squire_token",
  },
  {
    name: "Knight",
    tier: 2,
    prefix: "mk_knight",
    protection: { helmet: 4, chest: 7, legs: 5, boots: 3 },
    durability: 350,
    repairItem: "minecraft:iron_ingot",
    unlockDay: 40,
    tokenItem: "mk:mk_knight_token",
  },
  {
    name: "Champion",
    tier: 3,
    prefix: "mk_champion",
    protection: { helmet: 5, chest: 8, legs: 6, boots: 4 },
    durability: 500,
    repairItem: "minecraft:diamond",
    unlockDay: 60,
    tokenItem: "mk:mk_champion_token",
  },
  {
    name: "Mega Knight",
    tier: 4,
    prefix: "mk_mega_knight",
    protection: { helmet: 6, chest: 10, legs: 8, boots: 5 },
    durability: 750,
    repairItem: "minecraft:netherite_ingot",
    unlockDay: 85,
    tokenItem: "mk:mk_mega_knight_token",
  },
];
