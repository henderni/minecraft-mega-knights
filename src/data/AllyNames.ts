/**
 * Procedural name pools for recruited allies.
 * Names are drawn randomly to give each recruit a unique identity.
 *
 * Pure data file — no @minecraft/server imports (safe for vitest).
 */

/** Knight / Dark Knight first names — medieval warrior flavor */
const KNIGHT_NAMES = [
  "Marcus", "Eleanor", "Roland", "Gwendolyn", "Aldric",
  "Isolde", "Cedric", "Rowena", "Gareth", "Brienne",
  "Oswald", "Elara", "Percival", "Lyanna", "Theodric",
  "Morgana", "Roderick", "Astrid", "Baldwin", "Seraphina",
  "Edmund", "Freya", "Godfrey", "Helena", "Leoric",
  "Cassandra", "Duncan", "Vivienne", "Alaric", "Rosalind",
];

/** Archer first names — ranger/scout flavor */
const ARCHER_NAMES = [
  "Robin", "Sylva", "Fletcher", "Wren", "Ash",
  "Ivy", "Hawk", "Fern", "Gale", "Thistle",
  "Reed", "Sage", "Finch", "Willow", "Rowan",
  "Briar", "Swift", "Lark", "Storm", "Holly",
  "Elm", "Hazel", "Falcon", "Moss", "Birch",
  "Dawn", "Flint", "Meadow", "Ridge", "Vale",
];

/** Wizard first names — arcane/mystical flavor */
const WIZARD_NAMES = [
  "Aldwin", "Mirael", "Thalric", "Serena", "Corvus",
  "Lunara", "Grimald", "Celeste", "Oberon", "Nyx",
  "Mordecai", "Lyris", "Erasmus", "Solara", "Zephyr",
  "Calista", "Valen", "Esmera", "Theron", "Lumina",
  "Caspian", "Ariadne", "Merrick", "Althea", "Silas",
  "Elowen", "Magnus", "Selene", "Dorian", "Vesper",
];

/** Title prefixes by ally type — used before the name */
const TITLES: Record<string, string[]> = {
  "mk:mk_ally_knight": ["Sir", "Dame", "Ser"],
  "mk:mk_ally_dark_knight": ["Sir", "Dame", "Ser"],
  "mk:mk_ally_archer": ["Scout", "Ranger"],
  "mk:mk_ally_wizard": ["Mage", "Sage"],
  "mk:mk_ally_standard_bearer": ["Bearer"],
};

/** Name pools by ally type ID */
const NAME_POOLS: Record<string, string[]> = {
  "mk:mk_ally_knight": KNIGHT_NAMES,
  "mk:mk_ally_dark_knight": KNIGHT_NAMES,
  "mk:mk_ally_archer": ARCHER_NAMES,
  "mk:mk_ally_wizard": WIZARD_NAMES,
  "mk:mk_ally_standard_bearer": KNIGHT_NAMES,
};

/** Generate a random name for a recruited ally (e.g., "Sir Marcus") */
export function generateAllyName(allyTypeId: string): string {
  const pool = NAME_POOLS[allyTypeId] ?? KNIGHT_NAMES;
  const titles = TITLES[allyTypeId] ?? ["Ser"];
  const name = pool[Math.floor(Math.random() * pool.length)];
  const title = titles[Math.floor(Math.random() * titles.length)];
  return `${title} ${name}`;
}

/** All name pools exported for testing */
export const ALL_NAME_POOLS = { KNIGHT_NAMES, ARCHER_NAMES, WIZARD_NAMES };
export const ALL_TITLES = TITLES;
