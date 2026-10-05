import type { Player } from '../entities/Player';

/**
 * Прогрессия игрока: XP за убийства, level-up => +10% maxHp и полное лечение.
 */
export class ProgressionSystem {
  private player: Player;

  constructor(player: Player) {
    this.player = player;
  }

  addXp(amount: number, onLevelUp?: () => void): void {
    this.player.xp += amount;
    while (this.player.xp >= this.player.xpToNext) {
      this.player.xp -= this.player.xpToNext;
      this.player.applyLevelUp();
      onLevelUp?.();
    }
  }
}
