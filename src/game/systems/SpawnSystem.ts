import Phaser from 'phaser';
import type { ArenaScene } from '../ArenaScene';
import { Enemy } from '../entities/Enemy';

/**
 * Спавн врагов у краёв арены. Частота растёт со временем (сложность).
 */
export class SpawnSystem {
  private scene: ArenaScene;
  private group: Phaser.Physics.Arcade.Group;
  private spawnTimer = 0;

  constructor(scene: ArenaScene, group: Phaser.Physics.Arcade.Group) {
    this.scene = scene;
    this.group = group;
  }

  update(dt: number, elapsedSec: number): void {
    // Интервал спавна: от 1.6 c до 0.35 c за 5 минут.
    const interval = Math.max(0.35, 1.6 - elapsedSec * 0.004);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = interval;
      this.spawnOne();
    }
  }

  /** Пустой хук — количество врагов не ограничиваем жёстко, только разумным максимумом. */
  noteKill(): void {
    /* noop */
  }

  private spawnOne(): void {
    const aliveCount = this.group.countActive(true);
    if (aliveCount >= 80) return;

    const { width, height } = this.scene.scale;
    const edge = Phaser.Math.Between(0, 3);
    let x = 0;
    let y = 0;
    switch (edge) {
      case 0: x = Phaser.Math.Between(0, width); y = -20; break;       // сверху
      case 1: x = Phaser.Math.Between(0, width); y = height + 20; break; // снизу
      case 2: x = -20; y = Phaser.Math.Between(0, height); break;       // слева
      case 3: x = width + 20; y = Phaser.Math.Between(0, height); break; // справа
    }

    const enemy = new Enemy(this.scene, x, y, this.scene.enemyLevel);
    this.group.add(enemy);
  }
}
