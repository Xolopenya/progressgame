import Phaser from 'phaser';
import type { ArenaScene } from '../ArenaScene';
import type { Player } from '../entities/Player';

const FONT = 'system-ui, sans-serif';

/**
 * HUD: HP-бар, уровень+XP-бар, монеты, таймер, счётчик убийств.
 * Все элементы — заглушки Graphics/Text, без ассетов.
 */
export class Hud {
  private scene: ArenaScene;
  private hpBarBg: Phaser.GameObjects.Graphics;
  private hpBarFill: Phaser.GameObjects.Graphics;
  private xpBarBg: Phaser.GameObjects.Graphics;
  private xpBarFill: Phaser.GameObjects.Graphics;
  private levelText: Phaser.GameObjects.Text;
  private coinsText: Phaser.GameObjects.Text;
  private timerText: Phaser.GameObjects.Text;
  private killsText: Phaser.GameObjects.Text;
  private buffText: Phaser.GameObjects.Text;
  private flash: Phaser.GameObjects.Text;

  constructor(scene: ArenaScene) {
    this.scene = scene;
    const w = scene.scale.width;

    this.hpBarBg = scene.add.graphics().setDepth(40);
    this.hpBarBg.fillStyle(0x1e293b, 1).fillRoundedRect(16, 14, 240, 18, 6);
    this.hpBarFill = scene.add.graphics().setDepth(41);

    this.xpBarBg = scene.add.graphics().setDepth(40);
    this.xpBarBg.fillStyle(0x1e293b, 1).fillRoundedRect(16, 40, 240, 12, 5);
    this.xpBarFill = scene.add.graphics().setDepth(41);

    this.levelText = scene.add.text(266, 30, '', { fontFamily: FONT, fontSize: '17px', color: '#a5f3fc' }).setDepth(41);
    this.coinsText = scene.add.text(w - 16, 14, '', { fontFamily: FONT, fontSize: '18px', color: '#fbbf24' }).setOrigin(1, 0).setDepth(41);
    this.timerText = scene.add.text(w / 2, 12, '', { fontFamily: FONT, fontSize: '22px', color: '#e2e8f0' }).setOrigin(0.5, 0).setDepth(41);
    this.killsText = scene.add.text(w - 16, 40, '', { fontFamily: FONT, fontSize: '16px', color: '#f87171' }).setOrigin(1, 0).setDepth(41);
    this.buffText = scene.add.text(16, 60, '', { fontFamily: FONT, fontSize: '13px', color: '#94a3b8' }).setDepth(41);

    this.flash = scene.add.text(w / 2, 110, 'LEVEL UP!', {
      fontFamily: FONT, fontSize: '30px', color: '#4ade80', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(42).setAlpha(0);
  }

  refresh(player: Player, elapsedSec: number, kills: number): void {
    const hpRatio = player.maxHp > 0 ? player.hp / player.maxHp : 0;
    this.hpBarFill.clear();
    this.hpBarFill.fillStyle(hpRatio > 0.35 ? 0x22c55e : 0xef4444, 1);
    this.hpBarFill.fillRoundedRect(18, 16, Math.max(2, 236 * hpRatio), 14, 5);

    const xpRatio = player.xpToNext > 0 ? Math.min(1, player.xp / player.xpToNext) : 0;
    this.xpBarFill.clear();
    this.xpBarFill.fillStyle(0x38bdf8, 1);
    this.xpBarFill.fillRoundedRect(18, 42, Math.max(2, 236 * xpRatio), 8, 4);

    this.levelText.setText(`Lv ${player.level}`);
    this.coinsText.setText(`${Math.floor(player.coins)} c`);
    this.killsText.setText(`☠ ${kills}`);

    const m = Math.floor(elapsedSec / 60);
    const s = Math.floor(elapsedSec % 60);
    this.timerText.setText(`${m}:${s.toString().padStart(2, '0')}`);

    const parts: string[] = [];
    if (player.damageMult > 1) parts.push(`DMG x${player.damageMult.toFixed(2)}`);
    if (player.attackSpeed !== 1.2) parts.push(`ATK/s ${player.attackSpeed.toFixed(2)}`);
    if (player.regen > 0) parts.push(`REGEN ${player.regen}/s`);
    if (player.shieldCharges > 0) parts.push(`SHIELD ${player.shieldCharges}`);
    this.buffText.setText(parts.join('  ·  '));
  }

  flashLevelUp(): void {
    this.flash.setAlpha(1);
    this.scene.tweens.add({
      targets: this.flash,
      alpha: 0,
      y: this.scene.scale.height / 2 - 60,
      duration: 900,
      ease: 'Cubic.out',
      onComplete: () => this.flash.setY(110),
    });
  }
}
