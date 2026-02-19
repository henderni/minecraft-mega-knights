import { world, Player } from "@minecraft/server";
import { BESTIARY, BESTIARY_EFFECT_DURATION_TICKS, BestiaryEntry } from "../data/BestiaryDefinitions";

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
  /**
   * Increment the kill counter for an enemy type and check for milestones.
   * Called from CombatSystem on every qualifying player kill.
   */
  onKill(player: Player, enemyTypeId: string): void {
    const entry = this.getEntryForType(enemyTypeId);
    if (!entry) {return;}

    const current = Math.max(0, (player.getDynamicProperty(entry.killKey) as number) ?? 0);
    const next = current + 1;
    player.setDynamicProperty(entry.killKey, next);

    // Check for newly crossed milestones
    for (const milestone of entry.milestones) {
      if (current < milestone.kills && next >= milestone.kills) {
        player.sendMessage(milestone.message);
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
      const kills = Math.max(0, (player.getDynamicProperty(entry.killKey) as number) ?? 0);

      // Find the highest earned milestone
      let highestMilestone = -1;
      for (let i = 0; i < entry.milestones.length; i++) {
        if (kills >= entry.milestones[i].kills) {
          highestMilestone = i;
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
    for (const entry of BESTIARY) {
      if (entry.enemyTypeId === typeId) {return entry;}
    }
    return undefined;
  }
}
