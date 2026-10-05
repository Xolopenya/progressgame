import Phaser from 'phaser';
import type { ArenaScene } from '../ArenaScene';
import type { Enemy } from './Enemy';

const PROJECTILE_SPEED = 520;

/** Снаряд автоатаки: летит к цели, при попадании наносит урон. */
export class Projectile extends Phaser.GameObjects.Arc {
  private damage: number;
  private lifetimeMs = 1500;

  constructor(scene: ArenaScene, x: number, y: number, damage: number) {
    super(scene, x, y, 5, 0xa5f3fc);
    this.damage = damage;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(6);
  }

  static fireAt(scene: ArenaScene, x: number, y: number, target: Enemy, damage: number): void {
    const proj = new Projectile(scene, x, y, damage);
    const angle = Phaser.Math.Angle.Between(x, y, target.x, target.y);
    const body = proj.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(angle) * PROJECTILE_SPEED, Math.sin(angle) * PROJECTILE_SPEED);

    scene.physics.add.overlap(proj, target, () => {
      target.receiveDamage(damage);
      proj.destroy();
    });

    scene.time.delayedCall(1500, () => {
      if (proj.active) proj.destroy();
    });
  }

  override update(_time: number, delta: number): void {
    this.lifetimeMs -= delta;
    if (this.lifetimeMs <= 0) {
      this.destroy();
    }
  }
}
