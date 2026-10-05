import Phaser from 'phaser';
import type { ArenaScene } from '../ArenaScene';
import type { Player } from './Player';

const BASE_HP = 24;
const BASE_DAMAGE = 8;
const BASE_SPEED = 90;
const CONTACT_COOLDOWN_MS = 1000;

/** Скалинг: hp = base * 1.15^level; damage = base * 1.1^level. */
export function enemyStatsForLevel(level: number): { hp: number; damage: number } {
  return {
    hp: Math.round(BASE_HP * Math.pow(1.15, level)),
    damage: Math.round(BASE_DAMAGE * Math.pow(1.1, level)),
  };
}

/** Враг: прямое преследование, урон при контакте с кулдауном 1 с. */
export class Enemy extends Phaser.GameObjects.Arc {
  enemyLevel = 1;
  hp = BASE_HP;
  maxHp = BASE_HP;
  damage = BASE_DAMAGE;
  speed = BASE_SPEED;
  xpReward = 5;
  coinReward = 3;

  private lastContactAt = -CONTACT_COOLDOWN_MS;
  private gameScene!: ArenaScene;

  constructor(scene: ArenaScene, x: number, y: number, level: number) {
    super(scene, x, y, 15, 0xf87171);
    this.gameScene = scene;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.configure(level);
    this.setDepth(4);
  }

  configure(level: number): void {
    this.enemyLevel = level;
    const stats = enemyStatsForLevel(level);
    this.maxHp = stats.hp;
    this.hp = stats.hp;
    this.damage = stats.damage;
    this.speed = BASE_SPEED + Math.min(60, level * 4);
    this.xpReward = 4 + level * 2;
    this.coinReward = 2 + level;
    this.lastContactAt = -CONTACT_COOLDOWN_MS;
    this.setFillStyle(0xf87171);
  }

  /** ИИ: прямое преследование игрока. */
  chase(targetX: number, targetY: number, dt: number): void {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    this.x += Math.cos(angle) * this.speed * dt;
    this.y += Math.sin(angle) * this.speed * dt;
  }

  receiveDamage(amount: number): void {
    this.hp -= amount;
    this.setFillStyle(0xffffff);
    this.gameScene.time.delayedCall(90, () => {
      if (this.active) this.setFillStyle(0xf87171);
    });
    if (this.hp <= 0) {
      this.gameScene.registerKill(this);
    }
  }

  /** Урон при контакте, не чаще раза в секунду. Щит игрока блокирует удар. */
  tryContactDamage(player: Player): void {
    const now = this.gameScene.time.now;
    if (now - this.lastContactAt < CONTACT_COOLDOWN_MS) return;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    if (dist > this.radius + player.width / 2) return;

    this.lastContactAt = now;
    if (player.consumeShield()) {
      return; // щит погасил удар
    }
    player.takeDamage(this.damage);
  }
}
