import Phaser from 'phaser';
import type { ArenaScene } from '../ArenaScene';

const FONT = 'system-ui, sans-serif';

/** Экран смерти + рестарт (клик или R). */
export class DeathScreen {
  private scene: ArenaScene;
  private onRestart: () => void;
  private container: Phaser.GameObjects.Container | null = null;

  constructor(scene: ArenaScene, onRestart: () => void) {
    this.scene = scene;
    this.onRestart = onRestart;
  }

  show(timeSec: number, kills: number, level: number): void {
    if (this.container) return;

    const { width, height } = this.scene.scale;
    const container = this.scene.add.container(0, 0).setDepth(60);
    this.container = container;

    const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72);
    overlay.setInteractive();
    container.add(overlay);

    const title = this.scene.add.text(width / 2, height / 2 - 90, 'ВЫ ПОГИБЛИ', {
      fontFamily: FONT, fontSize: '44px', color: '#ef4444', fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(title);

    const m = Math.floor(timeSec / 60);
    const s = Math.floor(timeSec % 60);
    const stats = this.scene.add.text(
      width / 2,
      height / 2 - 20,
      `Продержались: ${m}:${s.toString().padStart(2, '0')}   Убийств: ${kills}   Уровень: ${level}`,
      { fontFamily: FONT, fontSize: '20px', color: '#e2e8f0' },
    ).setOrigin(0.5);
    container.add(stats);

    const button = this.scene.add.text(width / 2, height / 2 + 60, '[ R ] — рестарт', {
      fontFamily: FONT, fontSize: '24px', color: '#7dd3fc',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    button.on('pointerdown', () => this.onRestart());
    container.add(button);
  }
}
