import Phaser from 'phaser';
import type { ArenaScene } from '../ArenaScene';
import type { Player } from '../entities/Player';

export interface ShopItemDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly basePrice: number;
  readonly kind: 'skill' | 'item';
  readonly apply: (player: Player) => void;
}

/** Цена растёт ×1.6 за покупку. */
export function priceFor(basePrice: number, purchases: number): number {
  return Math.round(basePrice * Math.pow(1.6, purchases));
}

/** Каталог магазина по GDD. */
export const SHOP_ITEMS: readonly ShopItemDef[] = [
  {
    id: 'power', name: 'Сила', description: '+25% урона', basePrice: 20, kind: 'skill',
    apply: (p) => { p.damageMult *= 1.25; },
  },
  {
    id: 'haste', name: 'Хаст', description: '+15% скор. атаки', basePrice: 25, kind: 'skill',
    apply: (p) => { p.attackSpeed *= 1.15; },
  },
  {
    id: 'boots', name: 'Ботинки', description: '+10% скорости', basePrice: 15, kind: 'skill',
    apply: (p) => { p.moveSpeed *= 1.1; },
  },
  {
    id: 'vitality', name: 'Живучесть', description: '+20 HP, regen', basePrice: 30, kind: 'skill',
    apply: (p) => { p.maxHp += 20; p.hp = Math.min(p.maxHp, p.hp + 20); p.regen += 1; },
  },
  {
    id: 'shield', name: 'Щит', description: 'блок одного удара', basePrice: 50, kind: 'item',
    apply: (p) => { p.shieldCharges += 1; },
  },
  {
    id: 'magnet', name: 'Магнит', description: 'радиус подбора ×2', basePrice: 40, kind: 'item',
    apply: (p) => { p.magnetRadius *= 2; },
  },
];

export interface ShopRowState {
  def: ShopItemDef;
  purchases: number;
}

/**
 * Магазин: открывается на B, игра на паузе (физика остановлена сценой).
 * UI рисуется заглушками Graphics + Text, покупка — кликом по строке.
 */
export class ShopSystem {
  private scene: ArenaScene;
  private player: Player;
  private state: Map<string, ShopRowState>;
  private container: Phaser.GameObjects.Container | null = null;
  private onClose: (() => void) | null = null;
  private rowHitZones: { rect: Phaser.GameObjects.Rectangle; id: string }[] = [];
  private priceTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private coinsText: Phaser.GameObjects.Text | null = null;

  constructor(scene: ArenaScene, player: Player) {
    this.scene = scene;
    this.player = player;
    this.state = new Map(SHOP_ITEMS.map((def) => [def.id, { def, purchases: 0 }]));
  }

  open(onClose: () => void): void {
    if (this.container) return;
    this.onClose = onClose;

    const { width, height } = this.scene.scale;
    const panelW = 560;
    const panelH = 470;
    const px = (width - panelW) / 2;
    const py = (height - panelH) / 2;

    const container = this.scene.add.container(0, 0).setDepth(50);
    this.container = container;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0f172a, 0.92);
    bg.fillRoundedRect(px, py, panelW, panelH, 14);
    bg.lineStyle(2, 0x38bdf8, 1);
    bg.strokeRoundedRect(px, py, panelW, panelH, 14);
    container.add(bg);

    const title = this.scene.add.text(width / 2, py + 26, 'МАГАЗИН', {
      fontFamily: 'system-ui, sans-serif', fontSize: '26px', color: '#7dd3fc',
    }).setOrigin(0.5);
    container.add(title);

    this.coinsText = this.scene.add.text(px + panelW - 24, py + 26, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#fbbf24',
    }).setOrigin(1, 0.5);
    container.add(this.coinsText);
    this.refreshCoins();

    const hint = this.scene.add.text(width / 2, py + panelH - 26, 'B / клик вне окна — закрыть', {
      fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#94a3b8',
    }).setOrigin(0.5);
    container.add(hint);

    const rowH = 62;
    const startY = py + 64;
    SHOP_ITEMS.forEach((def, i) => {
      const y = startY + i * (rowH + 6);
      const card = this.scene.add.graphics();
      card.fillStyle(0x1e293b, 1);
      card.fillRoundedRect(px + 20, y, panelW - 40, rowH, 8);
      container.add(card);

      const label = this.scene.add.text(px + 36, y + 10, `${def.name} (${def.kind === 'item' ? 'разовый' : 'скилл'})`, {
        fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#e2e8f0',
      });
      container.add(label);

      const desc = this.scene.add.text(px + 36, y + 34, def.description, {
        fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#94a3b8',
      });
      container.add(desc);

      const priceText = this.scene.add.text(px + panelW - 36, y + rowH / 2, '', {
        fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#fbbf24',
      }).setOrigin(1, 0.5);
      container.add(priceText);
      this.priceTexts.set(def.id, priceText);
      this.refreshPrice(def.id);

      const hit = this.scene.add.rectangle(px + 20, y + rowH / 2, panelW - 40, rowH, 0xffffff, 0.001);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.tryBuy(def.id));
      container.add(hit);
      this.rowHitZones.push({ rect: hit, id: def.id });
    });

    // Клик вне панели закрывает магазин.
    const catcher = this.scene.add.zone(0, 0, width, height).setOrigin(0).setInteractive({ useHandCursor: false });
    catcher.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.x < px || p.x > px + panelW || p.y < py || p.y > py + panelH) {
        this.onClose?.();
      }
    });
    container.addAt(catcher, 0);
  }

  close(): void {
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
    this.rowHitZones = [];
    this.priceTexts.clear();
    this.coinsText = null;
    this.onClose = null;
  }

  tryBuy(id: string): boolean {
    const row = this.state.get(id);
    if (!row) return false;
    const price = priceFor(row.def.basePrice, row.purchases);
    if (this.player.coins < price) return false;

    this.player.coins -= price;
    row.purchases += 1;
    row.def.apply(this.player);
    this.refreshPrice(id);
    this.refreshCoins();
    return true;
  }

  purchaseCount(id: string): number {
    return this.state.get(id)?.purchases ?? 0;
  }

  private refreshPrice(id: string): void {
    const row = this.state.get(id);
    const text = this.priceTexts.get(id);
    if (row && text) {
      text.setText(`${priceFor(row.def.basePrice, row.purchases)} c`);
    }
  }

  /** Подсветка строк: жёлтая цена — можно купить, серая — не хватает монет. */
  refreshAffordability(): void {
    this.refreshCoins();
    for (const [id, text] of this.priceTexts) {
      const row = this.state.get(id);
      if (!row) continue;
      const price = priceFor(row.def.basePrice, row.purchases);
      text.setColor(this.player.coins >= price ? '#fbbf24' : '#64748b');
    }
  }

  private refreshCoins(): void {
    this.coinsText?.setText(`Монеты: ${Math.floor(this.player.coins)}`);
  }
}
