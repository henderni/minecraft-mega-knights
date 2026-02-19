export interface CastleBlueprint {
  id: string;
  displayName: string;
  structureId: string;
  unlockDay: number;
  troopBonus: number;
}

export const CASTLE_BLUEPRINTS: Record<string, CastleBlueprint> = {
  small_tower: {
    id: "small_tower",
    displayName: "Small Watchtower",
    structureId: "megaknights:small_tower",
    unlockDay: 5,
    troopBonus: 5,
  },
  gatehouse: {
    id: "gatehouse",
    displayName: "Gatehouse",
    structureId: "megaknights:gatehouse",
    unlockDay: 35,
    troopBonus: 7,
  },
  great_hall: {
    id: "great_hall",
    displayName: "Great Hall",
    structureId: "megaknights:great_hall",
    unlockDay: 50,
    troopBonus: 8,
  },
};
