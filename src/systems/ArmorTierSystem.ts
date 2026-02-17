import { Player, world } from "@minecraft/server";
import { DayCounterSystem } from "./DayCounterSystem";
import { ARMOR_TIERS } from "../data/ArmorTiers";

export class ArmorTierSystem {
  private dayCounter: DayCounterSystem;

  constructor(dayCounter: DayCounterSystem) {
    this.dayCounter = dayCounter;
  }

  initializePlayer(player: Player): void {
    const hasStarted = player.getDynamicProperty("mk:has_started") as boolean;
    if (!hasStarted) {
      // Give starting Page armor
      player.dimension.runCommand(`give "${player.name}" mk:mk_page_helmet`);
      player.dimension.runCommand(`give "${player.name}" mk:mk_page_chestplate`);
      player.dimension.runCommand(`give "${player.name}" mk:mk_page_leggings`);
      player.dimension.runCommand(`give "${player.name}" mk:mk_page_boots`);
      player.sendMessage("§aYou have been given your Page armor. Your journey begins!");
    }
  }

  static unlockTier(tierIndex: number): void {
    const tier = ARMOR_TIERS[tierIndex];
    if (!tier) return;

    for (const player of world.getAllPlayers()) {
      player.setDynamicProperty(`mk:tier_unlocked_${tierIndex}`, true);

      // Give the unlock token item
      if (tier.tokenItem) {
        player.dimension.runCommand(`give "${player.name}" ${tier.tokenItem}`);
      }

      player.sendMessage(`§6${tier.name} armor is now available!`);
    }
  }

  static isTierUnlocked(player: Player, tierIndex: number): boolean {
    if (tierIndex === 0) return true; // Page is always available
    return (player.getDynamicProperty(`mk:tier_unlocked_${tierIndex}`) as boolean) ?? false;
  }
}
