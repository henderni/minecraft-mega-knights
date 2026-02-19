/**
 * Bestiary system — tracks player kill counts per enemy type and
 * awards permanent passive buff effects at milestone thresholds.
 *
 * Effects are applied on player spawn and re-applied every 200 ticks
 * (10 seconds) with a 300-tick (15s) duration to maintain them continuously.
 */

export interface BestiaryMilestone {
  kills: number;
  /** Minecraft effect ID, e.g. "resistance" */
  effectId: string;
  /** Effect amplifier (0 = level I, 1 = level II) */
  amplifier: number;
  /** Human-readable description shown on unlock */
  message: string;
}

export interface BestiaryEntry {
  /** mk: namespace enemy type ID */
  enemyTypeId: string;
  /** Short display name for messages */
  displayName: string;
  /** Dynamic property key for per-player kill count */
  killKey: string;
  milestones: BestiaryMilestone[];
}

export const BESTIARY: BestiaryEntry[] = [
  {
    enemyTypeId: "mk:mk_enemy_knight",
    displayName: "Knights",
    killKey: "mk:kills_knight",
    milestones: [
      {
        kills: 10,
        effectId: "resistance",
        amplifier: 0,
        message: "§6[Bestiary] Slaying 10 Knights toughens your resolve — Resistance I granted!",
      },
      {
        kills: 30,
        effectId: "resistance",
        amplifier: 1,
        message: "§6[Bestiary] 30 Knights fall before you — Resistance II permanently unlocked!",
      },
    ],
  },
  {
    enemyTypeId: "mk:mk_enemy_archer",
    displayName: "Archers",
    killKey: "mk:kills_archer",
    milestones: [
      {
        kills: 10,
        effectId: "speed",
        amplifier: 0,
        message: "§6[Bestiary] 10 Archers defeated — you move with greater agility. Speed I granted!",
      },
      {
        kills: 30,
        effectId: "speed",
        amplifier: 1,
        message: "§6[Bestiary] 30 Archers slain — Speed II permanently unlocked!",
      },
    ],
  },
  {
    enemyTypeId: "mk:mk_enemy_wizard",
    displayName: "Wizards",
    killKey: "mk:kills_wizard",
    milestones: [
      {
        kills: 10,
        effectId: "haste",
        amplifier: 0,
        message: "§6[Bestiary] 10 Wizards defeated — arcane energy fills you. Haste I granted!",
      },
      {
        kills: 25,
        effectId: "haste",
        amplifier: 1,
        message: "§6[Bestiary] 25 Wizards slain — Haste II permanently unlocked!",
      },
    ],
  },
  {
    enemyTypeId: "mk:mk_enemy_dark_knight",
    displayName: "Dark Knights",
    killKey: "mk:kills_dark_knight",
    milestones: [
      {
        kills: 5,
        effectId: "strength",
        amplifier: 0,
        message: "§6[Bestiary] 5 Dark Knights felled — their dark power flows into you. Strength I granted!",
      },
      {
        kills: 20,
        effectId: "strength",
        amplifier: 1,
        message: "§6[Bestiary] 20 Dark Knights slain — Strength II permanently unlocked!",
      },
    ],
  },
];

/** Duration in ticks to apply per-player bestiary effects (15 seconds, re-applied every 10s) */
export const BESTIARY_EFFECT_DURATION_TICKS = 300;
