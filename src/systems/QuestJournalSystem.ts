import { Player, world } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { BESTIARY } from "../data/BestiaryDefinitions";
import { ARMOR_TIERS } from "../data/ArmorTiers";
import { ArmySystem } from "./ArmySystem";
import {
  JOURNAL_TITLE,
  JOURNAL_OVERVIEW_TITLE,
  JOURNAL_OVERVIEW_BODY,
  JOURNAL_ARMY_TITLE,
  JOURNAL_ARMY_BODY,
  JOURNAL_STANCES_TITLE,
  JOURNAL_STANCES_BODY,
  JOURNAL_BESTIARY_TITLE,
  JOURNAL_CASTLES_TITLE,
  JOURNAL_CASTLES_BODY,
} from "../data/Strings";

/** Tier names indexed by tier number — matches DayCounterSystem */
const TIER_NAMES = ["Page", "Squire", "Knight", "Champion", "Mega Knight"];

export class QuestJournalSystem {
  async onItemUse(player: Player): Promise<void> {
    try {
      await this.showTOC(player);
    } catch {
      // Player may have closed the form or disconnected
    }
  }

  private async showTOC(player: Player): Promise<void> {
    const day = (world.getDynamicProperty("mk:current_day") as number) ?? 0;
    const armySize = Math.max(0, (player.getDynamicProperty("mk:army_size") as number) ?? 0);
    const armyBonus = Math.max(0, (player.getDynamicProperty("mk:army_bonus") as number) ?? 0);
    const tier = Math.max(
      0,
      Math.min(ARMOR_TIERS.length - 1, (player.getDynamicProperty("mk:current_tier") as number) ?? 0),
    );
    const tierName = TIER_NAMES[tier] ?? "Page";
    const playerCount = world.getAllPlayers().length;
    const armyCap = ArmySystem.getEffectiveCap(armyBonus, playerCount);

    const form = new ActionFormData()
      .title(JOURNAL_TITLE)
      .body(`Day ${day}/100 | Army: ${armySize}/${armyCap} | ${tierName}`)
      .button(JOURNAL_OVERVIEW_TITLE)
      .button(JOURNAL_ARMY_TITLE)
      .button(JOURNAL_STANCES_TITLE)
      .button(JOURNAL_BESTIARY_TITLE)
      .button(JOURNAL_CASTLES_TITLE);

    const response = await form.show(player as any);
    if (response.canceled || response.selection === undefined) {
      return;
    }

    switch (response.selection) {
      case 0:
        await this.showPage(player, JOURNAL_OVERVIEW_TITLE, JOURNAL_OVERVIEW_BODY);
        break;
      case 1:
        await this.showPage(player, JOURNAL_ARMY_TITLE, JOURNAL_ARMY_BODY);
        break;
      case 2:
        await this.showPage(player, JOURNAL_STANCES_TITLE, JOURNAL_STANCES_BODY);
        break;
      case 3:
        await this.showBestiary(player);
        break;
      case 4:
        await this.showPage(player, JOURNAL_CASTLES_TITLE, JOURNAL_CASTLES_BODY);
        break;
    }
  }

  private async showPage(player: Player, title: string, body: string): Promise<void> {
    const form = new MessageFormData()
      .title(title)
      .body(body)
      .button1("Back")
      .button2("Close");

    const response = await form.show(player as any);
    if (response.canceled) {
      return;
    }
    // button1 = "Back" → selection 0; button2 = "Close" → selection 1
    if (response.selection === 0) {
      await this.showTOC(player);
    }
  }

  private async showBestiary(player: Player): Promise<void> {
    const lines: string[] = ["Kill enemies to earn permanent passive buffs!\n"];

    for (const entry of BESTIARY) {
      const kills = Math.max(0, (player.getDynamicProperty(entry.killKey) as number) ?? 0);
      const parts: string[] = [];
      for (const m of entry.milestones) {
        const effectLevel = m.amplifier === 0 ? "I" : "II";
        const effectName = m.effectId.charAt(0).toUpperCase() + m.effectId.slice(1);
        parts.push(`/${m.kills} → ${effectName} ${effectLevel}`);
      }
      lines.push(`${entry.displayName}: ${kills}${parts.join(", ")}`);
    }

    await this.showPage(player, JOURNAL_BESTIARY_TITLE, lines.join("\n"));
  }
}
