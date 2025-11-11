import chalk from 'chalk';
import { InventoryStatus } from '../inventory.entity';

export class InventoryWorkflowVisualizer {
  protected getStateDisplayName(state: InventoryStatus): string {
    const displayNames = {
      [InventoryStatus.AVAILABLE]: 'Available',
      [InventoryStatus.RESERVED]: 'Reserved',
      [InventoryStatus.ALLOCATED]: 'Allocated',
      [InventoryStatus.IN_TRANSIT]: 'In Transit',
      [InventoryStatus.RECEIVING]: 'Receiving',
      [InventoryStatus.QUARANTINE]: 'Quarantine',
      [InventoryStatus.DAMAGED]: 'Damaged',
      [InventoryStatus.EXPIRED]: 'Expired',
      [InventoryStatus.AUDITING]: 'Auditing',
      [InventoryStatus.REORDER_PENDING]: 'Reorder Pending',
      [InventoryStatus.REORDERED]: 'Reordered'
    };
    return displayNames[state] || state;
  }

  protected getStateColor(state: InventoryStatus): (text: string) => string {
    const colors = {
      [InventoryStatus.AVAILABLE]: chalk.green,
      [InventoryStatus.RESERVED]: chalk.yellow,
      [InventoryStatus.ALLOCATED]: chalk.blue,
      [InventoryStatus.IN_TRANSIT]: chalk.cyan,
      [InventoryStatus.RECEIVING]: chalk.magenta,
      [InventoryStatus.QUARANTINE]: chalk.red,
      [InventoryStatus.DAMAGED]: chalk.red.bold,
      [InventoryStatus.EXPIRED]: chalk.gray,
      [InventoryStatus.AUDITING]: chalk.yellow.bold,
      [InventoryStatus.REORDER_PENDING]: chalk.magentaBright,
      [InventoryStatus.REORDERED]: chalk.greenBright
    };
    return colors[state] || chalk.white;
  }

  protected isFinalState(state: InventoryStatus): boolean {
    return [
      InventoryStatus.DAMAGED,
      InventoryStatus.EXPIRED,
      InventoryStatus.REORDERED
    ].includes(state);
  }

  protected renderFlowDiagram(): string[] {
    return [
      'KAFKA-DRIVEN INVENTORY WORKFLOW:',
      '',
      '  Kafka Events                    Workflow States',
      '  ═══════════════════════════════════════════════════════════',
      '',
      '  📨 stock.received ──────────┐',
      '                              ▼',
      '                        ┌──────────────┐',
      '                        │   RECEIVING  │',
      '                        └──────────────┘',
      '                              │',
      '                              ▼',
      '                        ┌──────────────┐',
      '  📨 stock.adjusted ───▶│   AVAILABLE  │◀─── 📨 stock.released',
      '                        └──────────────┘',
      '                              │',
      '                          ┌───┴───┐',
      '                          ▼       ▼',
      '                    ┌──────────┐  ┌──────────┐',
      '                    │ RESERVED │  │ AUDITING │◀─ 📨 audit.requested',
      '                    └──────────┘  └──────────┘',
      '                          │',
      '  📨 stock.allocated ─────▼',
      '                    ┌──────────┐',
      '                    │ALLOCATED │',
      '                    └──────────┘',
      '                          │',
      '                          ▼',
      '                    ┌──────────────┐',
      '                    │  IN TRANSIT  │',
      '                    └──────────────┘',
      '',
      '  SPECIAL STATES:',
      '  ═══════════════════════════════════════════════════════════',
      '',
      '    ┌────────────┐     ┌──────────┐     ┌──────────────┐',
      '    │ QUARANTINE │     │  DAMAGED │     │   EXPIRED    │',
      '    └────────────┘     └──────────┘     └──────────────┘',
      '',
      '    ┌──────────────────┐           ┌──────────────┐',
      '    │ REORDER PENDING │◀───────────│   REORDERED  │',
      '    └──────────────────┘           └──────────────┘',
      '         ▲                              ▲',
      '         └── 📨 reorder.triggered ──────┘',
      '',
      '  ═══════════════════════════════════════════════════════════'
    ];
  }

  protected getTransitions(): Array<{ from: InventoryStatus; to: InventoryStatus; label: string }> {
    return [
      { from: InventoryStatus.RECEIVING, to: InventoryStatus.AVAILABLE, label: 'stock.received' },
      { from: InventoryStatus.AVAILABLE, to: InventoryStatus.RESERVED, label: 'reserve' },
      { from: InventoryStatus.RESERVED, to: InventoryStatus.ALLOCATED, label: 'stock.allocated' },
      { from: InventoryStatus.ALLOCATED, to: InventoryStatus.IN_TRANSIT, label: 'ship' },
      { from: InventoryStatus.RESERVED, to: InventoryStatus.AVAILABLE, label: 'stock.released' },
      { from: InventoryStatus.ALLOCATED, to: InventoryStatus.AVAILABLE, label: 'stock.released' },
      { from: InventoryStatus.AVAILABLE, to: InventoryStatus.AUDITING, label: 'audit.requested' },
      { from: InventoryStatus.AUDITING, to: InventoryStatus.AVAILABLE, label: 'audit.complete' },
      { from: InventoryStatus.AVAILABLE, to: InventoryStatus.QUARANTINE, label: 'quarantine' },
      { from: InventoryStatus.QUARANTINE, to: InventoryStatus.AVAILABLE, label: 'release' },
      { from: InventoryStatus.QUARANTINE, to: InventoryStatus.DAMAGED, label: 'damage' },
      { from: InventoryStatus.AVAILABLE, to: InventoryStatus.REORDER_PENDING, label: 'reorder.triggered' },
      { from: InventoryStatus.REORDER_PENDING, to: InventoryStatus.REORDERED, label: 'stock.received' }
    ];
  }

  public render(currentState: InventoryStatus | null): string {
    const lines = this.renderFlowDiagram();
    return lines.join('\n');
  }
}