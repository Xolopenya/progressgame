import Phaser from 'phaser';
import type { ArenaScene } from '../ArenaScene';
import { Enemy } from './Enemy';
import { Projectile } from './Projectile';

const BASE_MAX_HP = 100;
const BASE_DAMAGE = 12;
const BASE_ATTACK_SPEED = 1.2; // атак в секунду
const BASE_MOVE_SPEED = 240; // px/с
const ATTACK_RANGE = 260;
const BASE_MAGNET_RADIUS = 90;

/**
 * Игрок: hp, maxHp, level, xp, coins, damage, attackSpeed, moveSpeed, regen.
 * Движение — WASD/стрелки ( kinematic, без физики-тела ), автоатака — ближайший враг в радиусе.
 */
export class Player extends Phaser.GameObjects.Rectangle {
  hp = BASE_MAX_HP;
  maxHp = BASE_MAX_HP;
  level = 1;
  xp = 0;
  xpToNext = 20;
  coins = 10; // стартовый капитал, чтобы первый забег сразу показал магазин

  baseDamage = BASE_DAMAGE;
  damageMult = 1;
  attackSpeed = BASE_ATTACK_SPEED;
  moveSpeed = BASE_MOVE_SPEED;
  regen = 0; // hp/сек
  magnetRadius = BASE_MAGNET_RADIUS;
  shieldCharges = 0;

  private attackCooldown = 0;

  constructor(scene: ArenaScene) {
    super(scene, scene.scale.width / 2, scene.scale.height / 2, 34, 34, 0x38bdf8);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    // Движение kinematic (вручную), но тело остаётся dynamic — иначе Arcade
    // не вызывает overlap-коллбэки между двумя static-телами.
    body.moves = false;
    this.setDepth(5);
  }

  /** Урон снаряда = базовый урон × модификаторы магазина. */
  get projectileDamage(): number {
    return Math.round(this.baseDamage * this.damageMult);
  }

  updateMovement(dx: number, dy: number, dt: number): void {
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      this.x += (dx / len) * this.moveSpeed * dt;
      this.y += (dy / len) * this.moveSpeed * dt;
    }
    const half = this.width / 2;
    this.x = Phaser.Math.Clamp(this.x, half, this.scene.scale.width - half);
    this.y = Phaser.Math.Clamp(this.y, half, this.scene.scale.height - half);
  }

  applyRegen(dt: number): void {
    if (this.regen > 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);
    }
  }

  /** Автоатака ближайшего врага в радиусе. */
  updateAutoAttack(enemies: Phaser.Physics.Arcade.Group, dt: number): void {
    this.attackCooldown -= dt;
    if (this.attackCooldown > 0) return;

    let nearest: Enemy | null = null;
    let nearestDist = ATTACK_RANGE;
    for (const obj of enemies.getChildren()) {
      const enemy = obj as Enemy;
      if (!(enemy instanceof Enemy) || !enemy.active) continue;
      const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = enemy;
      }
    }

    if (nearest) {
      this.attackCooldown = 1 / this.attackSpeed;
      Projectile.fireAt(this.arena, this.x, this.y, nearest, this.projectileDamage);
    } else {
      this.attackCooldown = 0.05; // подождать, пока появится цель
    }
  }

  private get arena(): ArenaScene {
    return this.scene as unknown as ArenaScene;
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
    this.arena.tweens.add({ targets: this, alpha: { from: 0.35, to: 1 }, duration: 200 });
    if (this.hp <= 0) {
      this.arena.playerDied();
    }
  }

  /** Level-up: +10% maxHp и полное лечение. */
  applyLevelUp(): void {
    this.level += 1;
    this.maxHp = Math.round(this.maxHp * 1.1);
    this.hp = this.maxHp;
    this.xpToNext = Math.round(this.xpToNext * 1.35);
  }

  /** Щит блокирует один удар. Возвращает true, если блок произошёл. */
  consumeShield(): boolean {
    if (this.shieldCharges > 0) {
      this.shieldCharges -= 1;
      return true;
    }
    return false;
  }
}
