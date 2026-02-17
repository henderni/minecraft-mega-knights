import { EntityDieAfterEvent, Player } from "@minecraft/server";
import { ArmySystem } from "./ArmySystem";

export class CombatSystem {
  private static readonly RECRUIT_CHANCE = 0.3;
  private army: ArmySystem;

  constructor(army: ArmySystem) {
    this.army = army;
  }

  onEntityDie(event: EntityDieAfterEvent): void {
    const dead = event.deadEntity;
    const killer = event.damageSource.damagingEntity;

    // Only process if a player killed a recruitable enemy
    if (!killer || !(killer instanceof Player)) return;
    if (!dead.typeId.startsWith("mk:mk_enemy_")) return;
    // Boss entities are not recruitable
    if (dead.typeId.includes("boss")) return;

    const player = killer;

    // Track kill count
    const kills =
      ((player.getDynamicProperty("mk:kills") as number) ?? 0) + 1;
    player.setDynamicProperty("mk:kills", kills);

    // Roll for recruitment
    if (Math.random() < CombatSystem.RECRUIT_CHANCE) {
      this.army.recruitAlly(
        player,
        dead.typeId,
        dead.location,
        dead.dimension
      );
    }
  }
}
