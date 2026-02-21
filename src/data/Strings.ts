/**
 * Centralized player-facing strings for the Mega Knights add-on.
 * Keeps all UI text in one place for easy editing and future localization.
 *
 * Note: Minecraft Bedrock's .lang files handle entity/item names automatically.
 * Script-side messages (sendMessage, setTitle, setActionBar) don't resolve .lang
 * keys, so we centralize them here instead.
 */

// --- Quest ---
export const QUEST_START_TITLE = "§6§lThe Mega Knight Quest Begins!";
export const QUEST_START_DESC =
  "§eYou have 100 days to prepare your army for the siege.";
export const DAY_CHANGE = (day: number) => `§6=== Day ${day} of 100 ===`;
export const DAY_CHANGE_ENDLESS = (day: number) => `§6=== Day ${day} ===`;

// --- Milestones ---
export const MILESTONE_TITLE = (title: string) => `§e§l[Milestone] ${title}`;
export const MILESTONE_MESSAGE = (msg: string) => `§7${msg}`;

// --- Armor ---
export const ARMOR_GIVEN = "§aYou have been given your Page armor. Your journey begins!";
export const TIER_UNLOCKED = (name: string) => `§6${name} armor is now available!`;
export const TIER_UP_TITLE = (name: string) => `§6§l${name}`;
export const TIER_UP_SUBTITLE = "§eA new chapter of your legend begins!";
export const TIER_UP_MEGA_SUBTITLE = "§d§lThe ultimate warrior has arrived!";

// --- Army ---
export const ARMY_FULL = "§cYour army is at maximum capacity!";
export const ARMY_FULL_SHARED = (cap: number) =>
  `§cArmy full! §7(Limit: ${cap}/player in multiplayer)`;
export const ALLY_RECRUITED = (displayName: string) => `§a+ A ${displayName} has joined your army!`;
export const ALLY_NOT_YOURS = (ownerName: string) => `§7This warrior serves ${ownerName}.`;
export const ALLY_INFO = (nameTag: string, hp: string | number, maxHp: string | number) =>
  `§b${nameTag} §7- HP: ${hp}/${maxHp}`;
export const ALLY_MODE_SET = (mode: string) => `§7Ally stance set to: §b${mode}`;

// --- HUD ---
export const HUD_ACTION_BAR = (
  day: number,
  bar: string,
  armySize: number,
  armyCap: number,
  tierName: string,
) => `§6Day ${day}/100 §7[${bar}] §bArmy: ${armySize}/${armyCap} §d${tierName}`;

export const HUD_ACTION_BAR_ENDLESS = (
  day: number,
  armySize: number,
  armyCap: number,
  tierName: string,
) => `§6Day ${day} §dEndless §bArmy: ${armySize}/${armyCap} §d${tierName}`;

// --- Castle ---
export const CASTLE_LOOK_AT_GROUND = "§cLook at the ground where you want to place the structure!";
export const CASTLE_PLACED = (name: string) => `§a${name} has been placed!`;
export const CASTLE_CAPACITY_UP = (bonus: number, max: number) =>
  `§7Army capacity increased by +${bonus}! (Max: ${max})`;
export const CASTLE_FAILED = "§cFailed to place structure. Try a flatter area.";

// --- Siege ---
export const SIEGE_BEGIN = "§4§l=== THE SIEGE HAS BEGUN! ===";
export const SIEGE_DEFEND = "§cThe Siege Lord's army crashes against your walls! Defend with everything you have!";
export const SIEGE_WAVE = (num: number, total: number) => `§c--- Wave ${num}/${total} ---`;
export const SIEGE_VICTORY_1 = "§a§l=== VICTORY! ===";
export const SIEGE_VICTORY_2 = "§6The Siege Lord falls! His dark army scatters to the winds!";
export const SIEGE_VICTORY_3 = "§dYou have ascended to the rank of TRUE Mega Knight! Your legend will echo through the ages!";
export const SIEGE_VICTORY_TITLE = "§6§lVICTORY!";
export const SIEGE_VICTORY_SUBTITLE = "§eThe kingdom is saved!";
export const SIEGE_DEFEAT_1 = "§4§l=== DEFEAT ===";
export const SIEGE_DEFEAT_2 = "§cThe siege has overwhelmed your defenses... but legends never truly die.";
export const SIEGE_DEFEAT_3 = '§7Use "/scriptevent mk:reset" to begin a new chapter.';
export const SIEGE_BOSS_PHASE_2 = "§6§lThe Siege Lord grows desperate — faster and stronger!";
export const SIEGE_BOSS_PHASE_3 = "§4§lThe Siege Lord is enraged — FINISH HIM!";

// --- Enemy Camps ---
export const CAMP_SPAWNED = (tierName: string, direction: string) =>
  `§c⚔ ${tierName} spotted to the ${direction}!`;
export const CAMP_CLEARED = (tierName: string) =>
  `§a✓ ${tierName} cleared! Collect your rewards!`;
export const CAMP_DEBUG_SPAWNED = "§e[Debug] Enemy camp spawned nearby";

// --- Merchant ---
export const MERCHANT_APPEARED = "§6⚑ A Wandering Merchant has appeared nearby!";
export const STANDARD_BEARER_JOINED =
  "§a+ A Standard Bearer has joined your army!";

// --- Tutorial ---
export const TUTORIAL_1_SURVIVE = "§e1. Survive the night! Sleep in your bed to set respawn.";
export const TUTORIAL_2_RECRUIT = (recruitPct: number) => `§e2. Kill enemies — ${recruitPct}% chance to recruit them!`;
export const TUTORIAL_3_ARMY = "§e3. Recruits follow you. Sneak + interact to change stance.";
export const TUTORIAL_4_MILESTONES = "§e4. Milestones unlock blueprints, gear, and new army tiers.";
export const TUTORIAL_5_TIP = "§e5. Build castles to increase your army capacity!";
export const TUTORIAL_6_BESTIARY = "§e6. Track enemy kills to unlock passive buffs!";

// --- Feedback ---
export const RECRUIT_FAILED = "§7No recruit this time.";
export const ALLY_DIED = (displayName: string) => `§c✗ Your ${displayName} has fallen!`;

// --- Friendly Fire ---
export const FRIENDLY_FIRE_BLOCKED = "§cYour allies are immune to your attacks!";

// --- Journal ---
export const JOURNAL_TITLE = "Quest Journal";
export const JOURNAL_OVERVIEW_TITLE = "Quest Overview";
export const JOURNAL_OVERVIEW_BODY = (recruitPct: number) =>
  `You have 100 days to build your army and survive the final siege.\n\n- Kill enemies for a ${recruitPct}% chance to recruit them\n- Build castles to increase army capacity\n- Unlock better armor at milestones\n- Survive the Day 100 siege to become a Mega Knight!`;
export const JOURNAL_OVERVIEW_BODY_ENDLESS = (recruitPct: number) =>
  `You conquered the siege and entered Endless Mode!\n\n- Kill enemies for a ${recruitPct}% chance to recruit them\n- Mini-sieges strike every 20 days\n- Enemy camps continue spawning\n- How long can your legend last?`;
export const JOURNAL_ARMY_TITLE = "Army & Recruitment";
export const JOURNAL_ARMY_BODY = (recruitPct: number) =>
  `Kill any enemy for a ${recruitPct}% chance to recruit them. Recruited units follow and fight for you.\n\nBase army capacity: 15\nCastle bonuses: Tower +5, Gate +7, Hall +8\nMax capacity: 35 (singleplayer)\n\nIn multiplayer, the cap is shared equally.`;
export const JOURNAL_STANCES_TITLE = "Unit Stances";
export const JOURNAL_STANCES_BODY =
  "Sneak + interact with an ally to cycle stances:\n\nFollow - Ally follows you everywhere\nGuard - Ally patrols near its current position\nHold - Ally stays exactly where it is\n\nTap an ally (without sneaking) to check its health.";
export const JOURNAL_BESTIARY_TITLE = "Bestiary";
export const JOURNAL_CASTLES_TITLE = "Castles";
export const JOURNAL_CASTLES_BODY =
  "Use blueprint items on flat ground to place structures.\n\nDay 5: Small Tower (+5 army cap)\nDay 35: Gatehouse (+7 army cap)\nDay 50: Great Hall (+8 army cap)\n\nLook at the ground and use the blueprint item.";

// --- Journal (Endless) ---
export const JOURNAL_ENDLESS_TITLE = "Endless Mode";
export const JOURNAL_ENDLESS_BODY =
  "You've conquered the siege and entered Endless Mode!\n\n- Mini-sieges strike every 20 days\n- Enemy camps continue spawning\n- No more milestones — just survival\n- Waves escalate the longer you endure\n\nHow long can your legend last?";

// --- Difficulty ---
export const DIFFICULTY_TITLE = "Choose Your Challenge";
export const DIFFICULTY_BODY = "Select the difficulty for your quest. This cannot be changed later.";
export const DIFFICULTY_NORMAL_LABEL = "Normal";
export const DIFFICULTY_NORMAL_DESC = "30% recruit chance. Standard enemy counts.";
export const DIFFICULTY_HARD_LABEL = "Hard";
export const DIFFICULTY_HARD_DESC = "20% recruit chance. 50% more enemies. For veteran knights.";
export const DIFFICULTY_SET = (name: string) => `§6Difficulty set to: §l${name}`;

// --- Endless Mode ---
export const ENDLESS_UNLOCKED = "§d§l=== ENDLESS MODE UNLOCKED ===";
export const ENDLESS_DESC = "§7The kingdom is saved, but new threats emerge. Mini-sieges will test you every 20 days!";
export const ENDLESS_WAVE = (day: number) => `§4§l=== ENDLESS SIEGE — Day ${day}! ===`;
export const ENDLESS_WAVE_CLEARED = "§a✓ Endless wave cleared! The realm rests... for now.";
export const ENDLESS_DEFEAT = "§c✗ The endless horde was too much... but legends never stay down.";

// --- Debug ---
export const DEBUG_DAY_SET = (day: number) => `§e[Debug] Day set to ${day}`;
export const DEBUG_QUEST_STARTED = "§a[Debug] Quest started!";
export const DEBUG_QUEST_RESET = "§c[Debug] Quest reset!";
export const DEBUG_ALLIES_SPAWNED = (count: number) => `§e[Debug] Spawned ${count} allies`;
