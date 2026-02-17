import { world, Player } from "@minecraft/server";

export function broadcastTitle(
  title: string,
  subtitle?: string
): void {
  for (const player of world.getAllPlayers()) {
    player.onScreenDisplay.setTitle(title, {
      subtitle: subtitle,
      fadeInDuration: 20,
      stayDuration: 80,
      fadeOutDuration: 20,
    });
  }
}

export function broadcastMessage(message: string): void {
  world.sendMessage(message);
}

export function sendPlayerMessage(player: Player, message: string): void {
  player.sendMessage(message);
}
