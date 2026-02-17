import { Player, world } from "@minecraft/server";

export class PlayerData {
  static getKills(player: Player): number {
    return (player.getDynamicProperty("mk:kills") as number) ?? 0;
  }

  static setKills(player: Player, value: number): void {
    player.setDynamicProperty("mk:kills", value);
  }

  static getArmySize(player: Player): number {
    return (player.getDynamicProperty("mk:army_size") as number) ?? 0;
  }

  static getCurrentTier(player: Player): number {
    return (player.getDynamicProperty("mk:current_tier") as number) ?? 0;
  }

  static setCurrentTier(player: Player, tier: number): void {
    player.setDynamicProperty("mk:current_tier", tier);
  }

  static isTierUnlocked(player: Player, tier: number): boolean {
    if (tier === 0) return true;
    return (
      (player.getDynamicProperty(`mk:tier_unlocked_${tier}`) as boolean) ??
      false
    );
  }

  static getGlobalDay(): number {
    return (world.getDynamicProperty("mk:current_day") as number) ?? 0;
  }
}
