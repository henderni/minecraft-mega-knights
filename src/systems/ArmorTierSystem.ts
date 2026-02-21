import { Player, world } from "@minecraft/server";
import { ARMOR_TIERS } from "../data/ArmorTiers";
import { ARMOR_GIVEN, TIER_UNLOCKED, TIER_UP_TITLE, TIER_UP_SUBTITLE, TIER_UP_MEGA_SUBTITLE } from "../data/Strings";

/** Hardcoded token give commands by tier index — avoids string interpolation in runCommand */
const TOKEN_COMMANDS: Record<number, string> = {
  1: "give @s mk:mk_squire_token 4",
  2: "give @s mk:mk_knight_token 4",
  3: "give @s mk:mk_champion_token 4",
  4: "give @s mk:mk_mega_knight_token 4",
};

export class ArmorTierSystem {
  initializePlayer(player: Player): void {
    const hasStarted = player.getDynamicProperty("mk:has_started") as boolean;
    if (!hasStarted) {
      // Give starting Page armor
      try {
        player.runCommand("give @s mk:mk_page_helmet");
        player.runCommand("give @s mk:mk_page_chestplate");
        player.runCommand("give @s mk:mk_page_leggings");
        player.runCommand("give @s mk:mk_page_boots");
        player.sendMessage(ARMOR_GIVEN);
      } catch {
        // Player may be in unloaded chunk or transitioning — non-fatal
      }
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
        player.setDynamicProperty("mk:current_tier", tierIndex);

        // Give unlock tokens — 4 per tier (one for each armor piece)
        const tokenCmd = TOKEN_COMMANDS[tierIndex];
        if (tokenCmd) {
          player.runCommand(tokenCmd);
        }

        // Dramatic fanfare — title screen + sound
        const subtitle = tierIndex === 4 ? TIER_UP_MEGA_SUBTITLE : TIER_UP_SUBTITLE;
        player.onScreenDisplay.setTitle(TIER_UP_TITLE(tier.name), {
          subtitle,
          fadeInDuration: 10,
          stayDuration: 60,
          fadeOutDuration: 20,
        });
        player.runCommand("playsound random.levelup @s ~ ~ ~ 1 1");
        if (tierIndex === 4) {
          // Extra fanfare for Mega Knight — totem of undying sound
          player.runCommand("playsound random.totem @s ~ ~ ~ 1 1");
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
