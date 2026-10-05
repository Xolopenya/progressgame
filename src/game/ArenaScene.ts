import Phaser from 'phaser';
import { Player } from './entities/Player';
import { Enemy } from './entities/Enemy';
import { Coin } from './entities/Coin';
import { SpawnSystem } from './systems/SpawnSystem';
import { ShopSystem } from './systems/ShopSystem';
import { ProjectileSystem } from './systems/ProjectileSystem';
import { ProgressionSystem } from './systems/ProgressionSystem';
import { Hud } from './ui/Hud';
import { DeathScreen } from './ui/DeathScreen';

/**
 * Главная сцена «Progression Arena».
 * Core loop: убить врагов -> монеты и XP -> купить скиллы/айтемы в магазине -> враги сильнее -> повтор.
 */
export class ArenaScene extends Phaser.Scene {
  player!: Player;
  enemies!: Phaser.Physics.Arcade.Group;
  coins!: Phaser.Physics.Arcade.Group;
  projectiles!: ProjectileSystem;

  private spawnSystem!: SpawnSystem;
  private shopSystem!: ShopSystem;
  private progression!: ProgressionSystem;
  private hud!: Hud;
  private deathScreen!: DeathScreen;
  private enemyBars!: Phaser.GameObjects.Graphics;

  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyB!: Phaser.Input.Keyboard.Key;
  private keyR!: Phaser.Input.Keyboard.Key;

  private elapsedSec = 0;
  private kills = 0;
  private pausedByShop = false;
  private dead = false;

  constructor() {
    super('ArenaScene');
  }

  create(): void {
    if (!this.input.keyboard) {
      throw new Error('Keyboard input is unavailable.');
    }

    this.elapsedSec = 0;
    this.kills = 0;
    this.pausedByShop = false;
    this.dead = false;

    this.player = new Player(this);
    this.enemies = this.physics.add.group({ runChildUpdate: false });
    this.coins = this.physics.add.group({ runChildUpdate: false });
    this.projectiles = new ProjectileSystem(this);
    this.enemyBars = this.add.graphics().setDepth(7);

    this.spawnSystem = new SpawnSystem(this, this.enemies);
    this.progression = new ProgressionSystem(this.player);
    this.shopSystem = new ShopSystem(this, this.player);
    this.hud = new Hud(this);
    this.deathScreen = new DeathScreen(this, () => this.scene.restart());

    const kb = this.input.keyboard;
    this.cursors = kb.createCursorKeys();
    this.wasd = kb.addKeys('W,A,S,D') as Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
    this.keyB = kb.addKey(Phaser.Input.Keyboard.KeyCodes.B);
    this.keyR = kb.addKey(Phaser.Input.Keyboard.KeyCodes.R);

    // Контактная проверка вынесена в update(): у Arcade Physics overlap-коллбэк
    // не срабатывает между двумя static-телами (игрок движется вручную).
    this.checkEnemyContacts();

    this.physics.add.overlap(this.player, this.coins, (_p, c) => {
      const coin = c as Coin;
      if (coin instanceof Coin && coin.active) {
        this.player.coins += coin.value;
        coin.destroy();
      }
    });
  }

  update(_time: number, delta: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.keyR)) {
      this.scene.restart();
      return;
    }

    if (this.dead) return;

    // Магазин открыт -> физика на паузе, но UI живёт: подсвечиваем строки «не хватает монет».
    if (this.pausedByShop) {
      this.shopSystem.refreshAffordability();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyB)) {
      this.toggleShop();
    }

    // Открытый магазин = физика на паузе, логика не тикает.
    if (this.pausedByShop) return;

    const dt = Math.min(delta, 50) / 1000; // защита от рывков после фризов
    this.elapsedSec += dt;

    const move = this.readMoveInput();
    this.player.updateMovement(move.x, move.y, dt);
    this.player.applyRegen(dt);

    this.spawnSystem.update(dt, this.elapsedSec);
    this.updateEnemies(dt);
    this.player.updateAutoAttack(this.enemies, dt);
    this.projectiles.update();
    this.drawEnemyHealthBars();
    this.updateCoinsMagnet();
    this.checkEnemyContacts();

    this.hud.refresh(this.player, this.elapsedSec, this.kills);
  }

  /** Скалинг врагов: enemyLevel = 1 + floor(timeSec / 30). */
  public get enemyLevel(): number {
    return 1 + Math.floor(this.elapsedSec / 30);
  }

  private readMoveInput(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) x -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) x += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) y -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) y += 1;
    return { x, y };
  }

  /** Урон при контакте враг->игрок (кулдаун 1 c — на стороне Enemy). */
  private checkEnemyContacts(): void {
    const list = this.enemies.getChildren().slice() as unknown as Enemy[];
    for (const enemy of list) {
      if (!enemy.active) continue;
      enemy.tryContactDamage(this.player);
      if (this.dead) return;
    }
  }

  /** ИИ врагов: продвинутый (упреждение, стрейф, рывки, separation). */
  private updateEnemies(dt: number): void {
    const list = this.enemies.getChildren().slice() as unknown as Enemy[];
    for (const enemy of list) {
      if (!enemy.active) continue;
      enemy.chase(this.player.x, this.player.y, dt, list);
    }
  }

  /** HP-бары над ранеными врагами — читаемость урона по толстым типам. */
  private drawEnemyHealthBars(): void {
    const g = this.enemyBars;
    g.clear();
    const list = this.enemies.getChildren().slice() as unknown as Enemy[];
    for (const enemy of list) {
      if (!enemy.active || enemy.hp >= enemy.maxHp) continue;
      const w = enemy.radius * 2;
      const ratio = Math.max(0, enemy.hp / enemy.maxHp);
      const y = enemy.y - enemy.radius - 8;
      g.fillStyle(0x0f172a, 0.9);
      g.fillRect(enemy.x - w / 2, y, w, 4);
      g.fillStyle(ratio > 0.35 ? 0x22c55e : 0xef4444, 1);
      g.fillRect(enemy.x - w / 2, y, w * ratio, 4);
    }
  }

  /** Магнит-радиус: монеты внутри радиуса летят к игроку. */
  private updateCoinsMagnet(): void {
    const magnetRadius = this.player.magnetRadius;
    const list = this.coins.getChildren().slice() as unknown as Coin[];
    for (const coin of list) {
      if (!coin.active) continue;
      const dist = Phaser.Math.Distance.Between(coin.x, coin.y, this.player.x, this.player.y);
      const body = coin.body as Phaser.Physics.Arcade.Body;
      if (dist < magnetRadius) {
        // Магнит: тянем монету к игроку напрямую через setVelocity.
        const angle = Phaser.Math.Angle.Between(coin.x, coin.y, this.player.x, this.player.y);
        const speed = 420;
        body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      } else if (body.velocity.lengthSq() > 0) {
        body.setVelocity(0, 0);
      }
    }
  }

  /** Убийство врага (вызывает Player при попадании снаряда). */
  public registerKill(enemy: Enemy): void {
    this.kills += 1;
    this.progression.addXp(enemy.xpReward, () => this.hud.flashLevelUp());
    Coin.dropFrom(this, this.coins, enemy.x, enemy.y, enemy.coinReward);
    enemy.destroy();
  }

  /** Смерть игрока (вызывает Enemy, когда hp <= 0). */
  public playerDied(): void {
    if (this.dead) return;
    this.dead = true;
    this.pausedByShop = true;
    this.physics.pause();
    this.deathScreen.show(this.elapsedSec, this.kills, this.player.level);
  }

  private toggleShop(): void {
    this.pausedByShop = !this.pausedByShop;
    if (this.pausedByShop) {
      this.hud.markShopUsed();
      this.physics.pause();
      this.shopSystem.open(() => this.closeShop());
    } else {
      this.shopSystem.close();
      this.physics.resume();
    }
  }

  private closeShop(): void {
    if (!this.pausedByShop) return;
    this.pausedByShop = false;
    this.shopSystem.close();
    this.physics.resume();
  }
}
