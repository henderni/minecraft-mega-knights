export interface CampGuardDef {
  entityId: string;
  count: number;
}

export interface CampRewardDef {
  itemId: string;
  min: number;
  max: number;
}

export interface CampTierDef {
  name: string;
  minDay: number;
  maxDay: number;
  structureSize: 7 | 9;
  guards: CampGuardDef[];
  rewards: CampRewardDef[];
}

export const CAMP_SPAWN_MIN_DIST = 40;
export const CAMP_SPAWN_MAX_DIST = 60;
export const CAMP_COOLDOWN_DAYS = 3;
export const CAMP_START_DAY = 6;
export const MAX_CAMP_GUARDS = 10;

export const CAMP_TIERS: CampTierDef[] = [
  {
    name: "Scout Camp",
    minDay: 6,
    maxDay: 19,
    structureSize: 7,
    guards: [{ entityId: "mk:mk_enemy_knight", count: 3 }],
    rewards: [
      { itemId: "minecraft:iron_ingot", min: 3, max: 6 },
      { itemId: "minecraft:arrow", min: 8, max: 16 },
    ],
  },
  {
    name: "Raider Camp",
    minDay: 20,
    maxDay: 39,
    structureSize: 7,
    guards: [
      { entityId: "mk:mk_enemy_knight", count: 3 },
      { entityId: "mk:mk_enemy_archer", count: 2 },
    ],
    rewards: [
      { itemId: "minecraft:iron_ingot", min: 4, max: 8 },
      { itemId: "minecraft:iron_sword", min: 1, max: 1 },
    ],
  },
  {
    name: "War Camp",
    minDay: 40,
    maxDay: 59,
    structureSize: 9,
    guards: [
      { entityId: "mk:mk_enemy_knight", count: 3 },
      { entityId: "mk:mk_enemy_archer", count: 2 },
      { entityId: "mk:mk_enemy_wizard", count: 2 },
    ],
    rewards: [
      { itemId: "minecraft:iron_ingot", min: 4, max: 8 },
      { itemId: "minecraft:diamond", min: 1, max: 3 },
      { itemId: "minecraft:experience_bottle", min: 3, max: 6 },
    ],
  },
  {
    name: "Fortress Outpost",
    minDay: 60,
    maxDay: 84,
    structureSize: 9,
    guards: [
      { entityId: "mk:mk_enemy_knight", count: 3 },
      { entityId: "mk:mk_enemy_archer", count: 2 },
      { entityId: "mk:mk_enemy_wizard", count: 2 },
      { entityId: "mk:mk_enemy_dark_knight", count: 2 },
    ],
    rewards: [
      { itemId: "minecraft:diamond", min: 2, max: 5 },
      { itemId: "minecraft:experience_bottle", min: 5, max: 10 },
    ],
  },
  {
    name: "Elite Outpost",
    minDay: 85,
    maxDay: 99,
    structureSize: 9,
    guards: [
      { entityId: "mk:mk_enemy_knight", count: 3 },
      { entityId: "mk:mk_enemy_archer", count: 3 },
      { entityId: "mk:mk_enemy_wizard", count: 2 },
      { entityId: "mk:mk_enemy_dark_knight", count: 2 },
    ],
    rewards: [
      { itemId: "minecraft:diamond", min: 3, max: 6 },
      { itemId: "minecraft:netherite_scrap", min: 1, max: 2 },
      { itemId: "minecraft:experience_bottle", min: 5, max: 10 },
    ],
  },
];

export function getCampTierForDay(day: number): CampTierDef | undefined {
  for (const tier of CAMP_TIERS) {
    if (day >= tier.minDay && day <= tier.maxDay) {
      return tier;
    }
  }
  return undefined;
}
