import { world, Player } from "@minecraft/server";
import { BESTIARY, BESTIARY_EFFECT_DURATION_TICKS, BestiaryEntry } from "../data/BestiaryDefinitions";

/** Safe numeric dynamic property read — guards against non-number corruption */
const numProp = (v: unknown, d = 0): number => typeof v === "number" ? v : d;

/** Maximum tracked kills per enemy type in the bestiary */
const MAX_BESTIARY_KILLS = 9999;

/**
 * BestiarySystem — tracks per-player kill counts per enemy type and
 * applies permanent passive effects at milestone thresholds.
 *
 * Effects are applied on tick() (every 200 ticks / 10s) with a
 * 300-tick (15s) duration so they never expire during active play.
 *
 * Performance: read/write dynamic properties only in the 200-tick
 * safety-net pass, not in the death event handler hot path.
 */
export class BestiarySystem {
  /** O(1) lookup cache for bestiary entries by enemy type ID */
  private entryByType = new Map<string, BestiaryEntry>();

  constructor() {
    for (const entry of BESTIARY) {
      this.entryByType.set(entry.enemyTypeId, entry);
    }
  }

  /**
   * Increment the kill counter for an enemy type and check for milestones.
   * Called from CombatSystem on every qualifying player kill.
   */
  onKill(player: Player, enemyTypeId: string): void {
    if (!player.isValid) {return;}
    const entry = this.getEntryForType(enemyTypeId);
    if (!entry) {return;}

    const current = Math.max(0, numProp(player.getDynamicProperty(entry.killKey)));
    const next = Math.min(MAX_BESTIARY_KILLS, current + 1);
    player.setDynamicProperty(entry.killKey, next);

    // Check for newly crossed milestones
    for (const milestone of entry.milestones) {
      if (current < milestone.kills && next >= milestone.kills) {
        player.sendMessage(milestone.message);
        try { player.runCommand("playsound random.levelup @s ~ ~ ~ 1 1.2"); } catch { /* */ }
      }
    }
  }

  /**
   * Apply all earned bestiary effects to all online players.
   * Call every 200 ticks from main.ts as a safety net.
   * Short effect duration (300 ticks) + frequent reapplication = "permanent" during play.
   */
  tick(): void {
    const players = world.getAllPlayers();
    for (const player of players) {
      if (!player.isValid) {continue;}
      this.applyEarnedEffects(player);
    }
  }

  /** Re-apply earned effects to a player who just joined. Call from main.ts playerSpawn. */
  onPlayerSpawn(player: Player): void {
    this.applyEarnedEffects(player);
  }

  private applyEarnedEffects(player: Player): void {
    for (const entry of BESTIARY) {
      const kills = Math.max(0, numProp(player.getDynamicProperty(entry.killKey)));

      // Find the highest earned milestone (reverse scan — milestones sorted ascending)
      let highestMilestone = -1;
      for (let i = entry.milestones.length - 1; i >= 0; i--) {
        if (kills >= entry.milestones[i].kills) {
          highestMilestone = i;
          break;
        }
      }

      if (highestMilestone < 0) {continue;}

      const milestone = entry.milestones[highestMilestone];
      try {
        player.addEffect(milestone.effectId, BESTIARY_EFFECT_DURATION_TICKS, {
          amplifier: milestone.amplifier,
          showParticles: false,
        });
      } catch {
        // Effect may be unknown on older engine builds — skip silently
      }
    }
  }

  private getEntryForType(typeId: string): BestiaryEntry | undefined {
    return this.entryByType.get(typeId);
  }
}
