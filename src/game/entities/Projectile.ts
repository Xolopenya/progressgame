import Phaser from 'phaser';
import type { ArenaScene } from '../ArenaScene';

export const PROJECTILE_SPEED = 620;

/**
 * Снаряд игрока: летит по прямой (как пуля), с затухающим «хвостом».
 * Работает в пуле ProjectileSystem: переиспользуется через launch()/release().
 */
export class Projectile extends Phaser.GameObjects.Arc {
  private damage = 0;
  private lifetimeMs = 0;
  private trail: Phaser.GameObjects.Graphics;
  private trailPoints: { x: number; y: number }[] = [];

  constructor(scene: ArenaScene) {
    super(scene, -100, -100, 5, 0xa5f3fc);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.trail = scene.add.graphics();
    this.trail.setDepth(5);
    this.setDepth(6);
    this.setVisible(false);
  }

  /** Запуск снаряда из точки (x, y) под углом angle. */
  launch(x: number, y: number, angle: number, damage: number): void {
    this.damage = damage;
    this.lifetimeMs = 1400;
    this.trailPoints.length = 0;
    this.setPosition(x, y);
    this.setVisible(true);
    this.setActive(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(x, y);
    body.setSize(8, 8);
    body.setVelocity(Math.cos(angle) * PROJECTILE_SPEED, Math.sin(angle) * PROJECTILE_SPEED);
  }

  /** Попадание: наносим урон и возвращаем снаряд в пул. */
  hit(target: Enemy): void {
    if (!this.active || !this.visible) return;
    target.receiveDamage(this.damage);
    this.release();
  }

  /** Возврат в пул. */
  release(): void {
    this.setVisible(false);
    this.setActive(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    body.setVelocity(0, 0);
    this.trail.clear();
    this.trailPoints.length = 0;
  }

  override preUpdate(_time: number, delta: number): void {
    if (!this.visible) return;
    this.lifetimeMs -= delta;
    if (this.lifetimeMs <= 0) {
      this.release();
      return;
    }

    // Хвост: последние позиции снаряда, рисуем убывающей линией.
    this.trailPoints.push({ x: this.x, y: this.y });
    if (this.trailPoints.length > 7) this.trailPoints.shift();

    const g = this.trail;
    g.clear();
    for (let i = 1; i < this.trailPoints.length; i += 1) {
      const a = this.trailPoints[i - 1];
      const b = this.trailPoints[i];
      const alpha = (i / this.trailPoints.length) * 0.5;
      g.lineStyle(3, 0x7dd3fc, alpha);
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.strokePath();
    }
  }

  /** Выход за пределы арены — снаряд не нужен. */
  public offArena(width: number, height: number): boolean {
    return this.x < -30 || this.x > width + 30 || this.y < -30 || this.y > height + 30;
  }
}
