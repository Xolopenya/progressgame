import Phaser from 'phaser';
import { ArenaScene } from './ArenaScene';

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 640;

export function createGame(parent: string): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#0f172a',
    scene: [ArenaScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
  };

  return new Phaser.Game(config);
}
