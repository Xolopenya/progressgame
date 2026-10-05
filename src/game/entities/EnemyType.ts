/** Типы врагов: разная скорость, урон и поведение ИИ. */
export type EnemyKind = 'chaser' | 'brute' | 'rusher';

export interface EnemyTypeDef {
  readonly kind: EnemyKind;
  readonly label: string;
  readonly color: number;
  readonly radius: number;
  /** Множитель скорости к базовой скалированной скорости. */
  readonly speedMult: number;
  /** Множитель HP. */
  readonly hpMult: number;
  /** Множитель урона в контакте. */
  readonly damageMult: number;
}

export const ENEMY_TYPES: Record<EnemyKind, EnemyTypeDef> = {
  chaser: {
    kind: 'chaser', label: 'Преследователь', color: 0xf87171, radius: 14,
    speedMult: 1.0, hpMult: 1.0, damageMult: 1.0,
  },
  brute: {
    // Медленный, но толстый и больно бьёт — «танк».
    kind: 'brute', label: 'Громила', color: 0xc084fc, radius: 20,
    speedMult: 0.65, hpMult: 2.2, damageMult: 1.6,
  },
  rusher: {
    // Быстрый «камикадзе»: рывки на игрока, слабый, но агрессивный.
    kind: 'rusher', label: 'Рывок', color: 0xfb923c, radius: 11,
    speedMult: 1.5, hpMult: 0.6, damageMult: 0.8,
  },
};

/** Взвешенный выбор типа с учётом уровня сложности (чем выше левел — тем больше грозных типов). */
export function pickEnemyKind(level: number): EnemyKind {
  const roll = Math.random();
  if (level >= 4 && roll < 0.18) return 'brute';
  if (level >= 2 && roll < 0.45) return 'rusher';
  return 'chaser';
}
