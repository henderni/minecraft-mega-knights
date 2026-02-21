import { world, Player } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import {
  DIFFICULTY_TITLE,
  DIFFICULTY_BODY,
  DIFFICULTY_NORMAL_LABEL,
  DIFFICULTY_NORMAL_DESC,
  DIFFICULTY_HARD_LABEL,
  DIFFICULTY_HARD_DESC,
  DIFFICULTY_SET,
} from "../data/Strings";

/** Difficulty levels — values stored as world dynamic property */
export const DIFFICULTY_NORMAL = 0;
export const DIFFICULTY_HARD = 1;

/** Recruit chances by difficulty */
const RECRUIT_CHANCES: Record<number, number> = {
  [DIFFICULTY_NORMAL]: 0.3,
  [DIFFICULTY_HARD]: 0.2,
};

/** Enemy spawn multipliers by difficulty */
const ENEMY_MULTIPLIERS: Record<number, number> = {
  [DIFFICULTY_NORMAL]: 1.0,
  [DIFFICULTY_HARD]: 1.5,
};

/** Display names by difficulty level */
const DIFFICULTY_NAMES: Record<number, string> = {
  [DIFFICULTY_NORMAL]: "Normal",
  [DIFFICULTY_HARD]: "Hard",
};

export class DifficultySystem {
  private static readonly KEY = "mk:difficulty";
  private cachedDifficulty: number | null = null;

  /** Get current difficulty level (cached after first read) */
  getDifficulty(): number {
    if (this.cachedDifficulty !== null) {
      return this.cachedDifficulty;
    }
    const raw = world.getDynamicProperty(DifficultySystem.KEY);
    const stored = typeof raw === "number" ? raw : undefined;
    this.cachedDifficulty = stored ?? DIFFICULTY_NORMAL;
    return this.cachedDifficulty;
  }

  /** Get the recruit chance for the current difficulty */
  getRecruitChance(): number {
    return RECRUIT_CHANCES[this.getDifficulty()] ?? 0.3;
  }

  /** Get the enemy spawn multiplier for the current difficulty */
  getEnemyMultiplier(): number {
    return ENEMY_MULTIPLIERS[this.getDifficulty()] ?? 1.0;
  }

  /** Get difficulty display name */
  getDifficultyName(): string {
    return DIFFICULTY_NAMES[this.getDifficulty()] ?? "Normal";
  }

  /** Show difficulty selection form to the player. Called from quest start. */
  async showDifficultySelect(player: Player): Promise<void> {
    const form = new ActionFormData()
      .title(DIFFICULTY_TITLE)
      .body(DIFFICULTY_BODY)
      .button(`${DIFFICULTY_NORMAL_LABEL}\n§7${DIFFICULTY_NORMAL_DESC}`)
      .button(`${DIFFICULTY_HARD_LABEL}\n§7${DIFFICULTY_HARD_DESC}`);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await form.show(player as any);
      if (response.canceled || response.selection === undefined) {
        // Default to normal if cancelled
        this.setDifficulty(DIFFICULTY_NORMAL);
        return;
      }

      const selection = response.selection === 1 ? DIFFICULTY_HARD : DIFFICULTY_NORMAL;
      this.setDifficulty(selection);
      const name = DIFFICULTY_NAMES[selection] ?? "Normal";
      player.sendMessage(DIFFICULTY_SET(name));
    } catch {
      // UI failed — default to normal
      this.setDifficulty(DIFFICULTY_NORMAL);
    }
  }

  /** Set difficulty and persist */
  private setDifficulty(level: number): void {
    this.cachedDifficulty = level;
    world.setDynamicProperty(DifficultySystem.KEY, level);
  }

  /** Reset difficulty (for mk:reset command) */
  reset(): void {
    this.cachedDifficulty = null;
    world.setDynamicProperty(DifficultySystem.KEY, undefined);
  }
}
