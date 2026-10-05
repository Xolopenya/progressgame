import Phaser from 'phaser';
import type { ArenaScene } from '../ArenaScene';
import type { Enemy } from '../entities/Enemy';
import { Projectile, PROJECTILE_SPEED } from '../entities/Projectile';

const MAX_PROJECTILES = 200;

/**
 * Пул снарядов игрока. Выстрелы летят по прямой в упреждённую точку цели —
 * враг «убегает», и снаряд целится туда, где он окажется через время полёта.
 */
export class ProjectileSystem {
  private scene: ArenaScene;
  private group: Phaser.Physics.Arcade.Group;

  constructor(scene: ArenaScene) {
    this.scene = scene;
    this.group = scene.physics.add.group({ runChildUpdate: false });
    for (let i = 0; i < 40; i += 1) {
      this.group.add(new Projectile(scene));
    }
  }

  /**
   * Выстрел из (x, y) в цель с упреждением: снаряд летит по прямой в точку,
   * где враг окажется через время полёта (учитываем его lastMove-вектор).
   */
  fireWithLead(x: number, y: number, enemy: Enemy, damage: number): void {
    if (this.group.countActive(true) >= MAX_PROJECTILES) return;

    const proj = this.group.get() as Projectile | null;
    if (!proj) return;

    const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
    const travelTime = Math.min(0.35, dist / PROJECTILE_SPEED);
    // Упреждение: точка, куда враг добежит за время полёта снаряда.
    const px = enemy.x + enemy.lastMoveX * travelTime;
    const py = enemy.y + enemy.lastMoveY * travelTime;
    const angle = Math.atan2(py - y, px - x);

    proj.launch(x, y, angle, damage);
  }

  /** Проверка попаданий: снаряд × враги (дистанционная проверка по центрам). */
  update(): void {
    const { width, height } = this.scene.scale;
    const projectiles = this.group.getChildren().slice() as unknown as Projectile[];
    const enemies = this.scene.enemies.getChildren().slice() as unknown as Enemy[];

    for (const proj of projectiles) {
      if (!proj.visible) continue;
      if (proj.offArena(width, height)) {
        proj.release();
        continue;
      }
      for (const enemy of enemies) {
        if (!enemy.active) continue;
        const hitDist = enemy.radius + 6;
        if (Phaser.Math.Distance.Between(proj.x, proj.y, enemy.x, enemy.y) <= hitDist) {
          proj.hit(enemy);
          break;
        }
      }
    }
  }
}
