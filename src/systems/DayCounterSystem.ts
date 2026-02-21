import { world, system, Player } from "@minecraft/server";
import { ARMOR_TIERS } from "../data/ArmorTiers";
import { MILESTONES } from "../data/MilestoneEvents";
import { ArmySystem } from "./ArmySystem";
import { DifficultySystem } from "./DifficultySystem";
import {
  QUEST_START_TITLE,
  QUEST_START_DESC,
  DAY_CHANGE,
  DAY_CHANGE_ENDLESS,
  MILESTONE_TITLE,
  MILESTONE_MESSAGE,
  HUD_ACTION_BAR,
  HUD_ACTION_BAR_ENDLESS,
  TUTORIAL_1_SURVIVE,
  TUTORIAL_2_RECRUIT,
  TUTORIAL_3_ARMY,
  TUTORIAL_4_MILESTONES,
  TUTORIAL_5_TIP,
  TUTORIAL_6_BESTIARY,
} from "../data/Strings";

/** Pre-built progress bar strings to avoid string allocations every HUD tick */
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

  /** Cached values — source of truth after initial load. Only read dynamic properties once. */
  private cachedActive = false;
  private cachedDay = 0;
  private cachedTickCounter = 0;
  private cachedEndless = false;
  private initialized = false;

  /** Per-player HUD key cache — uses numeric composite key to avoid string allocation */
  private lastHudKeys = new Map<string, number>();

  /** Tick counter for throttling dynamic property persistence */
  private tickWriteCounter = 0;

  /** Reference to difficulty system — set via setDifficultySystem() */
  private difficultySystem: DifficultySystem | null = null;

  /** Reusable Set for HUD prune — avoids allocation every 4s */
  private activeNames = new Set<string>();

  /** Cached player list for HUD — refreshed every 4th call (~2s) to reduce getAllPlayers calls */
  private cachedHudPlayers: Player[] = [];
  private hudPlayerRefreshCounter = 0;

  /** Register a callback that fires whenever the day changes */
  onDayChanged(callback: (day: number) => void): void {
    this.onDayChangeCallbacks.push(callback);
  }

  /** Set the difficulty system reference for quest start form */
  setDifficultySystem(ds: DifficultySystem): void {
    this.difficultySystem = ds;
  }

  /** Load cached values from dynamic properties (call once on first use) */
  private ensureInitialized(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.cachedActive = (world.getDynamicProperty(DayCounterSystem.KEY_ACTIVE) as boolean) ?? false;
    this.cachedDay = (world.getDynamicProperty(DayCounterSystem.KEY_DAY) as number) ?? 0;
    this.cachedTickCounter = (world.getDynamicProperty(DayCounterSystem.KEY_TICK) as number) ?? 0;
    this.cachedEndless = (world.getDynamicProperty("mk:endless_mode") as boolean) ?? false;
  }

  getCurrentDay(): number {
    this.ensureInitialized();
    return this.cachedDay;
  }

  isActive(): boolean {
    this.ensureInitialized();
    return this.cachedActive;
  }

  startQuest(): void {
    world.setDynamicProperty(DayCounterSystem.KEY_ACTIVE, true);
    world.setDynamicProperty(DayCounterSystem.KEY_DAY, 0);
    world.setDynamicProperty(DayCounterSystem.KEY_TICK, 0);
    this.cachedActive = true;
    this.cachedDay = 0;
    this.cachedTickCounter = 0;
    this.initialized = true;
    world.sendMessage(QUEST_START_TITLE);
    world.sendMessage(QUEST_START_DESC);

    // Starter kit + clear nearby hostiles for each player
    const allPlayers = world.getAllPlayers();
    for (const player of allPlayers) {
      try {
        player.runCommand("give @s iron_sword");
        player.runCommand("give @s shield");
        player.runCommand("give @s bread 1 0 8");
        player.runCommand("give @s bed");
        player.runCommand("give @s mk:mk_quest_journal");
        player.runCommand("kill @e[type=!player,family=monster,r=48]");
      } catch {
        // Player may be in unloaded chunk or disconnected
      }
    }

    // Show difficulty selection to the first valid player
    if (this.difficultySystem) {
      const firstPlayer = allPlayers.find((p) => p.isValid);
      if (firstPlayer) {
        this.difficultySystem.showDifficultySelect(firstPlayer);
      }
    }

    // Tutorial message sequence — staggered at ~5s intervals
    const tutorials = [
      TUTORIAL_1_SURVIVE,
      TUTORIAL_2_RECRUIT,
      TUTORIAL_3_ARMY,
      TUTORIAL_4_MILESTONES,
      TUTORIAL_5_TIP,
      TUTORIAL_6_BESTIARY,
    ];
    for (let i = 0; i < tutorials.length; i++) {
      const msg = tutorials[i];
      system.runTimeout(() => {
        world.sendMessage(msg);
      }, 200 * (i + 1));
    }
  }

  /**
   * Set day directly (debug command). Defers milestone execution across ticks
   * to avoid firing dozens of runJob generators synchronously when jumping
   * many days at once (e.g. setday 0 → 100).
   */
  setDay(day: number): void {
    const maxDay = this.cachedEndless ? 999 : DayCounterSystem.MAX_DAY;
    day = Math.max(0, Math.min(maxDay, day));
    const previousDay = this.cachedDay;
    world.setDynamicProperty(DayCounterSystem.KEY_DAY, day);
    world.setDynamicProperty(DayCounterSystem.KEY_TICK, 0);
    this.cachedDay = day;
    this.cachedTickCounter = 0;

    if (!this.cachedActive) {
      world.setDynamicProperty(DayCounterSystem.KEY_ACTIVE, true);
      this.cachedActive = true;
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
        })(),
      );
    }
  }

  reset(): void {
    world.setDynamicProperty(DayCounterSystem.KEY_ACTIVE, false);
    world.setDynamicProperty(DayCounterSystem.KEY_DAY, 0);
    world.setDynamicProperty(DayCounterSystem.KEY_TICK, 0);
    world.setDynamicProperty("mk:endless_mode", false);
    this.cachedActive = false;
    this.cachedDay = 0;
    this.cachedTickCounter = 0;
    this.cachedEndless = false;
    this.tickWriteCounter = 0;
    this.lastHudKeys.clear();
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

  /** Enable endless mode — called after siege victory */
  enableEndlessMode(): void {
    this.cachedEndless = true;
    world.setDynamicProperty("mk:endless_mode", true);
  }

  isEndlessMode(): boolean {
    this.ensureInitialized();
    return this.cachedEndless;
  }

  tick(): void {
    this.ensureInitialized();
    if (!this.cachedActive) {
      return;
    }
    // Stop at day 100 unless endless mode is active
    if (this.cachedDay >= DayCounterSystem.MAX_DAY && !this.cachedEndless) {
      return;
    }

    this.cachedTickCounter += 20; // called every 20 ticks

    if (this.cachedTickCounter >= DayCounterSystem.TICKS_PER_DAY) {
      this.cachedTickCounter = 0;
      this.cachedDay += 1;
      world.setDynamicProperty(DayCounterSystem.KEY_DAY, this.cachedDay);
      world.setDynamicProperty(DayCounterSystem.KEY_TICK, 0);
      this.tickWriteCounter = 0;
      this.onDayChange(this.cachedDay);
    } else {
      // Persist tick counter every 60s for crash recovery (not every tick)
      this.tickWriteCounter++;
      if (this.tickWriteCounter >= 60) {
        this.tickWriteCounter = 0;
        world.setDynamicProperty(DayCounterSystem.KEY_TICK, this.cachedTickCounter);
      }
    }
  }

  /** Counter for throttling per-player dynamic property reads in HUD */
  private hudPropertyReadCounter = 0;
  private cachedPlayerArmySize = new Map<string, number>();
  private cachedPlayerTier = new Map<string, number>();
  private cachedPlayerArmyBonus = new Map<string, number>();

  updateHUD(): void {
    if (!this.cachedActive) {
      return;
    }

    const currentDay = this.cachedDay;
    const progress = this.cachedTickCounter / DayCounterSystem.TICKS_PER_DAY;
    const filled = Math.floor(progress * BAR_LENGTH);
    // Use pre-built bar string — no allocation
    const bar = PROGRESS_BARS[filled] ?? PROGRESS_BARS[0];

    // Throttle getAllPlayers — refresh every 4th HUD call (~2s) instead of every call
    this.hudPlayerRefreshCounter++;
    if (this.hudPlayerRefreshCounter >= 4) {
      this.hudPlayerRefreshCounter = 0;
      this.cachedHudPlayers = world.getAllPlayers();
    }
    const players = this.cachedHudPlayers;

    // Read per-player dynamic properties every 8th HUD call (~4s) instead of every call
    this.hudPropertyReadCounter++;
    const shouldReadProps = this.hudPropertyReadCounter >= 8;
    if (shouldReadProps) {
      this.hudPropertyReadCounter = 0;
    }

    // Prune disconnected players from caches — reuse Set to avoid allocation
    if (shouldReadProps) {
      this.activeNames.clear();
      for (const p of players) {
        if (p.isValid) {
          this.activeNames.add(p.name);
        }
      }
      for (const key of this.lastHudKeys.keys()) {
        if (!this.activeNames.has(key)) {
          this.lastHudKeys.delete(key);
          this.cachedPlayerArmySize.delete(key);
          this.cachedPlayerTier.delete(key);
          this.cachedPlayerArmyBonus.delete(key);
        }
      }
    }

    for (const player of players) {
      if (!player.isValid) {
        continue;
      }

      // Cache player.name in local variable — avoids repeated bridge property access
      const name = player.name;

      try {
        let armySize: number;
        let tier: number;
        let armyBonus: number;

        if (shouldReadProps) {
          // Full read from dynamic properties
          armySize = Math.max(0, (player.getDynamicProperty("mk:army_size") as number) ?? 0);
          tier = Math.max(
            0,
            Math.min(
              ARMOR_TIERS.length - 1,
              (player.getDynamicProperty("mk:current_tier") as number) ?? 0,
            ),
          );
          armyBonus = Math.max(0, (player.getDynamicProperty("mk:army_bonus") as number) ?? 0);
          this.cachedPlayerArmySize.set(name, armySize);
          this.cachedPlayerTier.set(name, tier);
          this.cachedPlayerArmyBonus.set(name, armyBonus);
        } else {
          // Use cached values
          armySize = this.cachedPlayerArmySize.get(name) ?? 0;
          tier = this.cachedPlayerTier.get(name) ?? 0;
          armyBonus = this.cachedPlayerArmyBonus.get(name) ?? 0;
        }

        // Effective army cap — scales down in multiplayer
        const armyCap = ArmySystem.getEffectiveCap(armyBonus, players.length);

        // Use numeric composite key to detect changes without allocating a string
        // Packs day, filled, armySize, armyCap, tier via bit shifts — safe within 53-bit integer precision
        const key = (currentDay << 20) | (filled << 15) | (armySize << 9) | (armyCap << 3) | tier;
        const lastKey = this.lastHudKeys.get(name);

        if (key !== lastKey) {
          const tierName = TIER_NAMES[tier] ?? "Page";
          const hudString = this.cachedEndless && currentDay > 100
            ? HUD_ACTION_BAR_ENDLESS(currentDay, armySize, armyCap, tierName)
            : HUD_ACTION_BAR(currentDay, bar, armySize, armyCap, tierName);
          player.onScreenDisplay.setActionBar(hudString);
          this.lastHudKeys.set(name, key);
        }
      } catch {
        // Player may have disconnected between getAllPlayers and property access
      }
    }
  }

  private onDayChange(day: number): void {
    world.sendMessage(this.cachedEndless && day > 100 ? DAY_CHANGE_ENDLESS(day) : DAY_CHANGE(day));
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
