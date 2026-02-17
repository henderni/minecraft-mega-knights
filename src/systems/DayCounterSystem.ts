import { world, Player } from "@minecraft/server";
import { MILESTONES } from "../data/MilestoneEvents";

export class DayCounterSystem {
  private static readonly TICKS_PER_DAY = 24000;
  private static readonly MAX_DAY = 100;
  private static readonly KEY_DAY = "mk:current_day";
  private static readonly KEY_TICK = "mk:day_tick_counter";
  private static readonly KEY_ACTIVE = "mk:quest_active";

  private onDayChangeCallbacks: ((day: number) => void)[] = [];

  /** Register a callback that fires whenever the day changes */
  onDayChanged(callback: (day: number) => void): void {
    this.onDayChangeCallbacks.push(callback);
  }

  getCurrentDay(): number {
    return (world.getDynamicProperty(DayCounterSystem.KEY_DAY) as number) ?? 0;
  }

  isActive(): boolean {
    return (world.getDynamicProperty(DayCounterSystem.KEY_ACTIVE) as boolean) ?? false;
  }

  startQuest(): void {
    world.setDynamicProperty(DayCounterSystem.KEY_ACTIVE, true);
    world.setDynamicProperty(DayCounterSystem.KEY_DAY, 0);
    world.setDynamicProperty(DayCounterSystem.KEY_TICK, 0);
    world.sendMessage("§6§l=== The Mega Knight Quest Begins! ===");
    world.sendMessage("§eYou have 100 days to build your castle, gather your army, and prepare for the siege.");
  }

  setDay(day: number): void {
    const previousDay = this.getCurrentDay();
    world.setDynamicProperty(DayCounterSystem.KEY_DAY, day);
    world.setDynamicProperty(DayCounterSystem.KEY_TICK, 0);
    if (!this.isActive()) {
      world.setDynamicProperty(DayCounterSystem.KEY_ACTIVE, true);
    }
    // Fire any milestones and callbacks between previous and new day
    for (let d = previousDay + 1; d <= day; d++) {
      this.fireMilestone(d);
      for (const cb of this.onDayChangeCallbacks) {
        cb(d);
      }
    }
  }

  reset(): void {
    world.setDynamicProperty(DayCounterSystem.KEY_ACTIVE, false);
    world.setDynamicProperty(DayCounterSystem.KEY_DAY, 0);
    world.setDynamicProperty(DayCounterSystem.KEY_TICK, 0);
  }

  initializePlayer(player: Player): void {
    const hasStarted = player.getDynamicProperty("mk:has_started") as boolean;
    if (!hasStarted) {
      player.setDynamicProperty("mk:has_started", true);
      player.setDynamicProperty("mk:kills", 0);
      player.setDynamicProperty("mk:army_size", 0);
      player.setDynamicProperty("mk:current_tier", 0);
    }

    // Auto-start quest if not active
    if (!this.isActive()) {
      this.startQuest();
    }
  }

  tick(): void {
    if (!this.isActive()) return;

    const currentDay = this.getCurrentDay();
    if (currentDay >= DayCounterSystem.MAX_DAY) return;

    let tickCounter = (world.getDynamicProperty(DayCounterSystem.KEY_TICK) as number) ?? 0;
    tickCounter += 20; // called every 20 ticks

    if (tickCounter >= DayCounterSystem.TICKS_PER_DAY) {
      tickCounter = 0;
      const newDay = currentDay + 1;
      world.setDynamicProperty(DayCounterSystem.KEY_DAY, newDay);
      this.onDayChange(newDay);
    }

    world.setDynamicProperty(DayCounterSystem.KEY_TICK, tickCounter);
  }

  updateHUD(): void {
    if (!this.isActive()) return;

    const currentDay = this.getCurrentDay();
    const tickCounter = (world.getDynamicProperty(DayCounterSystem.KEY_TICK) as number) ?? 0;
    const progress = tickCounter / DayCounterSystem.TICKS_PER_DAY;

    const barLength = 20;
    const filled = Math.floor(progress * barLength);
    const bar = "█".repeat(filled) + "░".repeat(barLength - filled);

    for (const player of world.getAllPlayers()) {
      const armySize = (player.getDynamicProperty("mk:army_size") as number) ?? 0;
      const tier = (player.getDynamicProperty("mk:current_tier") as number) ?? 0;
      const tierNames = ["Page", "Squire", "Knight", "Champion", "Mega Knight"];
      const tierName = tierNames[tier] ?? "Page";

      player.onScreenDisplay.setActionBar(
        `§6Day ${currentDay}/100 §7[${bar}] §bArmy: ${armySize} §d${tierName}`
      );
    }
  }

  private onDayChange(day: number): void {
    world.sendMessage(`§6=== Day ${day} of 100 ===`);
    this.fireMilestone(day);
    for (const cb of this.onDayChangeCallbacks) {
      cb(day);
    }
  }

  private fireMilestone(day: number): void {
    const milestone = MILESTONES[day];
    if (milestone) {
      world.sendMessage(`§e§l[Milestone] ${milestone.title}`);
      if (milestone.message) {
        world.sendMessage(`§7${milestone.message}`);
      }
      milestone.execute();
    }
  }
}
