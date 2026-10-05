import Phaser from 'phaser';
import type { ArenaScene } from '../ArenaScene';
import type { Player } from './Player';
import { ENEMY_TYPES, pickEnemyKind, type EnemyKind, type EnemyTypeDef } from './EnemyType';

const BASE_HP = 24;
const BASE_DAMAGE = 8;
const BASE_SPEED = 90;
const CONTACT_COOLDOWN_MS = 1000;

/** Скалинг по GDD: hp = base * 1.15^level; damage = base * 1.1^level. */
export function enemyStatsForLevel(level: number): { hp: number; damage: number } {
  return {
    hp: Math.round(BASE_HP * Math.pow(1.15, level)),
    damage: Math.round(BASE_DAMAGE * Math.pow(1.1, level)),
  };
}

/** Враг: продвинутый ИИ (упреждение, огибание, рывки), урон при контакте с кулдауном 1 с. */
export class Enemy extends Phaser.GameObjects.Arc {
  enemyLevel = 1;
  kind: EnemyKind = 'chaser';
  hp = BASE_HP;
  maxHp = BASE_HP;
  damage = BASE_DAMAGE;
  speed = BASE_SPEED;
  xpReward = 5;
  coinReward = 3;
  /** Вектор последнего движения (px/с) — для упреждения снарядов игрока. */
  lastMoveX = 0;
  lastMoveY = 0;

  private lastContactAt = -CONTACT_COOLDOWN_MS;
  private gameScene!: ArenaScene;
  private def!: EnemyTypeDef;

  // Память движения игрока для упреждения (предсказываем куда игрок побежит).
  private readonly posHistory: { x: number; y: number }[] = [];
  // Переменные фазы поведения.
  private strafeSign = Math.random() < 0.5 ? -1 : 1;
  private strafeTimer = 0;
  private dashCooldownMs = 0;
  private dashRemainingMs = 0;
  private dashVx = 0;
  private dashVy = 0;

  constructor(scene: ArenaScene, x: number, y: number, level: number) {
    super(scene, x, y, 15, 0xf87171);
    this.gameScene = scene;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.configure(level, pickEnemyKind(level));
    this.setDepth(4);
  }

  configure(level: number, kind: EnemyKind): void {
    this.enemyLevel = level;
    this.kind = kind;
    this.def = ENEMY_TYPES[kind];

    const stats = enemyStatsForLevel(level);
    // Скалинг скорости врагов от левела сложности + множитель типа.
    const levelSpeedMult = 1 + (level - 1) * 0.08;
    this.maxHp = Math.round(stats.hp * this.def.hpMult);
    this.hp = this.maxHp;
    this.damage = Math.round(stats.damage * this.def.damageMult);
    this.speed = Math.round(BASE_SPEED * this.def.speedMult * levelSpeedMult);

    // Чем выше левел — тем больше награда (мотивация выживать дольше).
    this.xpReward = 4 + level * 2;
    this.coinReward = 2 + level;

    this.lastContactAt = -CONTACT_COOLDOWN_MS;
    this.posHistory.length = 0;
    this.strafeTimer = Phaser.Math.Between(600, 1400) / 1000;
    this.dashCooldownMs = Phaser.Math.Between(800, 2200);
    this.dashRemainingMs = 0;
    this.radius = this.def.radius;
    this.setSize(this.def.radius * 2, this.def.radius * 2);
    this.setFillStyle(this.def.color);
  }

  /**
   * ИИ врага. Поведение зависит от типа и дистанции:
   * - chaser: упреждает движение игрока (берёт его позицию ~0.25 c назад и экстраполирует),
   *   на средней дистанции делает стрейф (зигзаги), чтобы сложнее было попасть;
   * - brute: тяжело идёт напрямую по упреждённой точке, не стрейфит;
   * - rusher: быстрые рывки (dash) на игрока с паузами между ними;
   * - все: separation — расталкиваются друг от друга, не слипаются в комок.
   */
  chase(targetX: number, targetY: number, dt: number, others: readonly Enemy[]): void {
    const prevX = this.x;
    const prevY = this.y;
    this.rememberPlayerPosition(targetX, targetY);

    const dist = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);
    const aim = this.predictPlayer();
    let angle = Phaser.Math.Angle.Between(this.x, this.y, aim.x, aim.y);

    let speedNow = this.speed;

    if (this.kind === 'rusher') {
      speedNow = this.updateRusher(dt, targetX, targetY, dist);
      // Во время рывка rusher летит строго по зафиксированному направлению.
      if (this.dashRemainingMs > 0 && (this.dashVx !== 0 || this.dashVy !== 0)) {
        angle = Math.atan2(this.dashVy, this.dashVx);
      }
    } else if (this.kind === 'chaser' && dist > 90 && dist < 320) {
      // Стрейф: добавляем перпендикулярную составляющую, периодически меняя сторону.
      this.strafeTimer -= dt;
      if (this.strafeTimer <= 0) {
        this.strafeSign *= -1;
        this.strafeTimer = Phaser.Math.FloatBetween(0.6, 1.4);
      }
      const strafeStrength = 0.45;
      const perp = angle + (Math.PI / 2) * this.strafeSign;
      const vx = Math.cos(angle) + Math.cos(perp) * strafeStrength;
      const vy = Math.sin(angle) + Math.sin(perp) * strafeStrength;
      angle = Math.atan2(vy, vx);
    }

    this.x += Math.cos(angle) * speedNow * dt;
    this.y += Math.sin(angle) * speedNow * dt;

    this.applySeparation(others, dt);

    // Запоминаем вектор движения за кадр — снаряды игрока используют его для упреждения.
    const mdx = this.x - prevX;
    const mdy = this.y - prevY;
    if (dt > 0) {
      this.lastMoveX = mdx / dt;
      this.lastMoveY = mdy / dt;
    }
  }

  /** Рывки rusher: короткое ускорение ×2.6 в сторону игрока, затем замедленная «перезарядка». */
  private updateRusher(dt: number, targetX: number, targetY: number, dist: number): number {
    const ms = dt * 1000;
    if (this.dashRemainingMs > 0) {
      this.dashRemainingMs -= ms;
      // Во время рывка летим строго по зафиксированному направлению dashVx/dashVy.
      return this.speed * 2.6;
    }
    this.dashCooldownMs -= ms;
    if (this.dashCooldownMs <= 0 && dist < 360) {
      this.dashRemainingMs = Phaser.Math.Between(220, 380);
      this.dashCooldownMs = Phaser.Math.Between(1200, 2400) - Math.min(800, this.enemyLevel * 60);
      const a = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
      this.dashVx = Math.cos(a);
      this.dashVy = Math.sin(a);
    }
    // Между рывками rusher крадётся чуть медленнее своего базового темпа.
    return this.speed * 0.55;
  }

  /** Копируем позиции игрока (до ~0.3 c истории) для предсказания. */
  private rememberPlayerPosition(x: number, y: number): void {
    this.posHistory.push({ x, y });
    if (this.posHistory.length > 20) this.posHistory.shift();
  }

  /** Предсказание: экстраполируем вектор движения игрока на ~0.25 c вперёд. */
  private predictPlayer(): { x: number; y: number } {
    const n = this.posHistory.length;
    if (n < 4) {
      const last = this.posHistory[n - 1] ?? { x: this.x, y: this.y };
      return last;
    }
    const recent = this.posHistory[n - 1];
    const past = this.posHistory[Math.max(0, n - 8)];
    const leadFactor = this.kind === 'brute' ? 0.5 : 1.0; // громила «тормозит» с реакцией
    const dx = (recent.x - past.x) * leadFactor;
    const dy = (recent.y - past.y) * leadFactor;
    return { x: recent.x + dx, y: recent.y + dy };
  }

  /** Separation: расталкиваемся от ближайших соседей, чтобы не слипаться. */
  private applySeparation(others: readonly Enemy[], dt: number): void {
    const minDist = this.def.radius * 2;
    let pushX = 0;
    let pushY = 0;
    for (const other of others) {
      if (other === this || !other.active) continue;
      const dx = this.x - other.x;
      const dy = this.y - other.y;
      const d = Math.hypot(dx, dy);
      const need = minDist + other.def.radius;
      if (d > 0 && d < need) {
        const w = (need - d) / need;
        pushX += (dx / d) * w;
        pushY += (dy / d) * w;
      }
    }
    const pushSpeed = this.speed * 0.9;
    this.x += pushX * pushSpeed * dt;
    this.y += pushY * pushSpeed * dt;
  }

  receiveDamage(amount: number): void {
    this.hp -= amount;
    this.setFillStyle(0xffffff);
    // HP-бар над врагом обновляется в сцене (ArenaScene.drawEnemyHealthBars).
    this.gameScene.time.delayedCall(90, () => {
      if (this.active) this.setFillStyle(this.def.color);
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

  /** Текущая скорость с учётом фазы рывка (для отрисовки «хвоста» у rusher). */
  get isDashing(): boolean {
    return this.kind === 'rusher' && this.dashRemainingMs > 0;
  }
}
