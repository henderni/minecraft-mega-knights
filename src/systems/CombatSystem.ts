import { EntityDieAfterEvent, Player, system } from "@minecraft/server";
import { ArmySystem } from "./ArmySystem";
import { BestiarySystem } from "./BestiarySystem";
import { DifficultySystem } from "./DifficultySystem";
import { RECRUIT_FAILED } from "../data/Strings";

export class CombatSystem {
  private army: ArmySystem;
  private bestiary: BestiarySystem;
  private difficulty: DifficultySystem;

  constructor(army: ArmySystem, bestiary: BestiarySystem, difficulty: DifficultySystem) {
    this.army = army;
    this.bestiary = bestiary;
    this.difficulty = difficulty;
  }

  onEntityDie(event: EntityDieAfterEvent): void {
    const dead = event.deadEntity;
    const killer = event.damageSource.damagingEntity;

    // Only process if a player killed a recruitable enemy
    if (!killer || !(killer instanceof Player)) {
      return;
    }
    if (!dead.typeId.startsWith("mk:mk_enemy_")) {
      return;
    }
    // Boss entities are not recruitable
    if (dead.typeId.includes("boss")) {
      return;
    }

    const player = killer;

    // Track kill count
    const kills = Math.max(0, (player.getDynamicProperty("mk:kills") as number) ?? 0) + 1;
    player.setDynamicProperty("mk:kills", kills);
    this.bestiary.onKill(player, dead.typeId);

    // Roll for recruitment — defer to next tick to avoid mutating world during death event.
    // Capture entity properties before the entity object is invalidated by the engine.
    if (Math.random() < this.difficulty.getRecruitChance()) {
      try {
        const typeId = dead.typeId;
        const location = { ...dead.location };
        const dimension = dead.dimension;
        system.run(() => {
          this.army.recruitAlly(player, typeId, location, dimension);
          // Recruitment success sound — played after spawn attempt
          try {
            player.runCommand("playsound random.orb @s ~ ~ ~ 1 1.2");
          } catch { /* player may have disconnected */ }
        });
      } catch {
        // Entity was removed from world before spawn data could be captured
      }
    } else {
      player.sendMessage(RECRUIT_FAILED);
      // Subtle failure sound — lower pitch, quieter
      try {
        player.runCommand("playsound note.bass @s ~ ~ ~ 0.5 0.5");
      } catch { /* player may have disconnected */ }
    }
  }
}
