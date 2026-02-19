import { Player, world } from "@minecraft/server";
import { ARMOR_TIERS } from "../data/ArmorTiers";
import { ARMOR_GIVEN, TIER_UNLOCKED } from "../data/Strings";

const VALID_TOKEN_ITEMS = new Set([
  "mk:mk_squire_token",
  "mk:mk_knight_token",
  "mk:mk_champion_token",
  "mk:mk_mega_knight_token",
]);

export class ArmorTierSystem {
  initializePlayer(player: Player): void {
    const hasStarted = player.getDynamicProperty("mk:has_started") as boolean;
    if (!hasStarted) {
      // Give starting Page armor
      player.runCommand("give @s mk:mk_page_helmet");
      player.runCommand("give @s mk:mk_page_chestplate");
      player.runCommand("give @s mk:mk_page_leggings");
      player.runCommand("give @s mk:mk_page_boots");
      player.sendMessage(ARMOR_GIVEN);
    }
  }

  static unlockTier(tierIndex: number): void {
    const tier = ARMOR_TIERS[tierIndex];
    if (!tier) {
      return;
    }

    for (const player of world.getAllPlayers()) {
      if (!player.isValid) {
        continue;
      }

      try {
        player.setDynamicProperty(`mk:tier_unlocked_${tierIndex}`, true);

        // Give unlock tokens — 4 per tier (one for each armor piece)
        if (tier.tokenItem && VALID_TOKEN_ITEMS.has(tier.tokenItem)) {
          player.runCommand(`give @s ${tier.tokenItem} 4`);
        }

        player.sendMessage(TIER_UNLOCKED(tier.name));
      } catch {
        // Player may have disconnected mid-iteration
      }
    }
  }

  static isTierUnlocked(player: Player, tierIndex: number): boolean {
    if (tierIndex === 0) {
      return true;
    } // Page is always available
    return (player.getDynamicProperty(`mk:tier_unlocked_${tierIndex}`) as boolean) ?? false;
  }
}
