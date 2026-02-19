/**
 * Centralized player-facing strings for the Mega Knights add-on.
 * Keeps all UI text in one place for easy editing and future localization.
 *
 * Note: Minecraft Bedrock's .lang files handle entity/item names automatically.
 * Script-side messages (sendMessage, setTitle, setActionBar) don't resolve .lang
 * keys, so we centralize them here instead.
 */

// --- Quest ---
export const QUEST_START_TITLE = "§6§l=== The Mega Knight Quest Begins! ===";
export const QUEST_START_DESC =
  "§eYou have 100 days to build your castle, gather your army, and prepare for the siege.";
export const DAY_CHANGE = (day: number) => `§6=== Day ${day} of 100 ===`;

// --- Milestones ---
export const MILESTONE_TITLE = (title: string) => `§e§l[Milestone] ${title}`;
export const MILESTONE_MESSAGE = (msg: string) => `§7${msg}`;

// --- Armor ---
export const ARMOR_GIVEN = "§aYou have been given your Page armor. Your journey begins!";
export const TIER_UNLOCKED = (name: string) => `§6${name} armor is now available!`;

// --- Army ---
export const ARMY_FULL = "§cYour army is at maximum capacity!";
export const ARMY_FULL_SHARED = (cap: number) =>
  `§cThe realm cannot sustain more warriors! §7(Limit: ${cap} per player in multiplayer)`;
export const ALLY_RECRUITED = (displayName: string) => `§a+ A ${displayName} has joined your army!`;
export const ALLY_NOT_YOURS = (ownerName: string) => `§7This warrior serves ${ownerName}.`;
export const ALLY_INFO = (nameTag: string, hp: string | number, maxHp: string | number) =>
  `§b${nameTag} §7- HP: ${hp}/${maxHp}`;

// --- HUD ---
export const HUD_ACTION_BAR = (
  day: number,
  bar: string,
  armySize: number,
  armyCap: number,
  tierName: string,
) => `§6Day ${day}/100 §7[${bar}] §bArmy: ${armySize}/${armyCap} §d${tierName}`;

// --- Castle ---
export const CASTLE_LOOK_AT_GROUND = "§cLook at the ground where you want to place the structure!";
export const CASTLE_PLACED = (name: string) => `§a${name} has been placed!`;
export const CASTLE_CAPACITY_UP = (bonus: number, max: number) =>
  `§7Army capacity increased by +${bonus}! (Max: ${max})`;
export const CASTLE_FAILED = "§cFailed to place structure. Try a flatter area.";

// --- Siege ---
export const SIEGE_BEGIN = "§4§l=== THE SIEGE HAS BEGUN! ===";
export const SIEGE_DEFEND = "§cDefend your castle! Waves of enemies approach!";
export const SIEGE_WAVE = (num: number, total: number) => `§c--- Wave ${num}/${total} ---`;
export const SIEGE_VICTORY_1 = "§a§l=== VICTORY! ===";
export const SIEGE_VICTORY_2 = "§6The Siege Lord has been defeated!";
export const SIEGE_VICTORY_3 = "§dYou are a TRUE Mega Knight!";
export const SIEGE_VICTORY_TITLE = "§6§lVICTORY!";
export const SIEGE_VICTORY_SUBTITLE = "§eThe kingdom is saved!";
export const SIEGE_DEFEAT_1 = "§4§l=== DEFEAT ===";
export const SIEGE_DEFEAT_2 = "§cThe siege has overwhelmed your defenses...";
export const SIEGE_DEFEAT_3 = '§7Use "/scriptevent mk:reset" to try again.';

// --- Debug ---
export const DEBUG_DAY_SET = (day: number) => `§e[Debug] Day set to ${day}`;
export const DEBUG_QUEST_STARTED = "§a[Debug] Quest started!";
export const DEBUG_QUEST_RESET = "§c[Debug] Quest reset!";
export const DEBUG_ALLIES_SPAWNED = (count: number) => `§e[Debug] Spawned ${count} allies`;
