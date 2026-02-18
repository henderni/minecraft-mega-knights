import { world, system, Player } from "@minecraft/server";
import { MILESTONES } from "../data/MilestoneEvents";
import {
  QUEST_START_TITLE,
  QUEST_START_DESC,
  DAY_CHANGE,
  MILESTONE_TITLE,
  MILESTONE_MESSAGE,
  HUD_ACTION_BAR,
} from "../data/Strings";

/** Pre-built progress bar strings to avoid string allocations every 2 ticks */
const BAR_LENGTH = 20;
const PROGRESS_BARS: string[] = [];
for (let i = 0; i <= BAR_LENGTH; i++) {
  PROGRESS_BARS.push("█".repeat(i) + "░".repeat(BAR_LENGTH - i));
}

/** Tier names indexed by tier number */
const TIER_NAMES = ["Page", "Squire", "Knight", "Champion", "Mega Knight"];

export class DayCounterSystem {
  private static readonly TICKS_PER_DAY = 24000;
  private static readonly MAX_DAY = 100;
  private static readonly KEY_DAY = "mk:current_day";
  private static readonly KEY_TICK = "mk:day_tick_counter";
  private static readonly KEY_ACTIVE = "mk:quest_active";

  private onDayChangeCallbacks: ((day: number) => void)[] = [];

  /** Cached HUD values — only re-read from dynamic properties when they change */
  private cachedDay = -1;
  private cachedTickCounter = -1;

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
    this.cachedDay = 0;
    this.cachedTickCounter = 0;
    world.sendMessage(QUEST_START_TITLE);
    world.sendMessage(QUEST_START_DESC);
  }

  /**
   * Set day directly (debug command). Defers milestone execution across ticks
   * to avoid firing dozens of runJob generators synchronously when jumping
   * many days at once (e.g. setday 0 → 100).
   */
  setDay(day: number): void {
    const previousDay = this.getCurrentDay();
    world.setDynamicProperty(DayCounterSystem.KEY_DAY, day);
    world.setDynamicProperty(DayCounterSystem.KEY_TICK, 0);
    this.cachedDay = day;
    this.cachedTickCounter = 0;

    if (!this.isActive()) {
      world.setDynamicProperty(DayCounterSystem.KEY_ACTIVE, true);
    }

    // Collect days with milestones or callbacks to fire
    const daysToFire: number[] = [];
    for (let d = previousDay + 1; d <= day; d++) {
      daysToFire.push(d);
    }

    // Stagger milestone execution — 1 milestone per tick to avoid frame spike
    if (daysToFire.length > 0) {
      const callbacks = this.onDayChangeCallbacks;
      system.runJob(
        (function* () {
          for (const d of daysToFire) {
            const milestone = MILESTONES[d];
            if (milestone) {
              world.sendMessage(MILESTONE_TITLE(milestone.title));
              if (milestone.message) {
                world.sendMessage(MILESTONE_MESSAGE(milestone.message));
              }
              milestone.execute();
            }
            for (const cb of callbacks) {
              cb(d);
            }
            yield; // One day per tick
          }
        })()
      );
    }
  }

  reset(): void {
    world.setDynamicProperty(DayCounterSystem.KEY_ACTIVE, false);
    world.setDynamicProperty(DayCounterSystem.KEY_DAY, 0);
    world.setDynamicProperty(DayCounterSystem.KEY_TICK, 0);
    this.cachedDay = 0;
    this.cachedTickCounter = 0;
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
      this.cachedDay = newDay;
      this.onDayChange(newDay);
    }

    world.setDynamicProperty(DayCounterSystem.KEY_TICK, tickCounter);
    this.cachedTickCounter = tickCounter;
  }

  updateHUD(): void {
    if (!this.isActive()) return;

    // Use cached values — updated by tick() and setDay() rather than re-reading dynamic props
    const currentDay = this.cachedDay >= 0 ? this.cachedDay : this.getCurrentDay();
    const tickCounter = this.cachedTickCounter >= 0
      ? this.cachedTickCounter
      : ((world.getDynamicProperty(DayCounterSystem.KEY_TICK) as number) ?? 0);

    const progress = tickCounter / DayCounterSystem.TICKS_PER_DAY;
    const filled = Math.floor(progress * BAR_LENGTH);
    // Use pre-built bar string — no allocation
    const bar = PROGRESS_BARS[filled] ?? PROGRESS_BARS[0];

    for (const player of world.getAllPlayers()) {
      if (!player.isValid) continue;

      try {
        const armySize = (player.getDynamicProperty("mk:army_size") as number) ?? 0;
        const tier = (player.getDynamicProperty("mk:current_tier") as number) ?? 0;
        const tierName = TIER_NAMES[tier] ?? "Page";

        player.onScreenDisplay.setActionBar(
          HUD_ACTION_BAR(currentDay, bar, armySize, tierName)
        );
      } catch {
        // Player may have disconnected between getAllPlayers and property access
      }
    }
  }

  private onDayChange(day: number): void {
    world.sendMessage(DAY_CHANGE(day));
    this.fireMilestone(day);
    for (const cb of this.onDayChangeCallbacks) {
      cb(day);
    }
  }

  private fireMilestone(day: number): void {
    const milestone = MILESTONES[day];
    if (milestone) {
      world.sendMessage(MILESTONE_TITLE(milestone.title));
      if (milestone.message) {
        world.sendMessage(MILESTONE_MESSAGE(milestone.message));
      }
      milestone.execute();
    }
  }
}
