import Phaser from 'phaser';
import type { ArenaScene } from '../ArenaScene';

/** Монета: падает с врага, подбирается касанием (магнит-радиус — на стороне сцены). */
export class Coin extends Phaser.GameObjects.Arc {
  value: number;

  constructor(scene: ArenaScene, x: number, y: number, value: number) {
    super(scene, x, y, 7, 0xfbbf24);
    this.value = value;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setStrokeStyle(2, 0xfde68a);
    this.setDepth(3);
    scene.time.delayedCall(25000, () => {
      if (this.active) this.destroy();
    });
  }

  static dropFrom(scene: ArenaScene, group: Phaser.Physics.Arcade.Group, x: number, y: number, value: number): Coin {
    const coin = new Coin(scene, x, y, value);
    group.add(coin);
    return coin;
  }
}
