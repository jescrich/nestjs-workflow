import { WorkflowDefinition, KafkaEvent } from '@jescrich/nestjs-workflow';
import { InventoryItem, InventoryStatus, InventoryEvent } from './inventory.entity';
import { InventoryEntityService } from './inventory.entity.service';

export interface InventoryContext {
  adjustmentReason?: string;
  auditRequired?: boolean;
  reorderTriggered?: boolean;
  damageDetails?: string;
  quarantineReason?: string;
}

export const inventoryWorkflowDefinition: WorkflowDefinition<InventoryItem, InventoryContext, InventoryEvent, InventoryStatus> = {
  name: 'InventoryManagementWorkflow',
  entity: InventoryEntityService,
  states: {
    finals: [
      InventoryStatus.DAMAGED,
      InventoryStatus.EXPIRED,
      InventoryStatus.REORDERED
    ],
    idles: [
      InventoryStatus.AVAILABLE,
      InventoryStatus.RESERVED,
      InventoryStatus.QUARANTINE,
      InventoryStatus.AUDITING,
      InventoryStatus.REORDER_PENDING
    ],
    failed: InventoryStatus.DAMAGED
  },
  
  // Kafka event configuration
  kafka: {
    brokers: 'localhost:9093',
    events: [
      {
        topic: 'inventory.stock.received',
        event: InventoryEvent.STOCK_RECEIVED
      },
      {
        topic: 'inventory.stock.allocated',
        event: InventoryEvent.STOCK_ALLOCATED
      },
      {
        topic: 'inventory.stock.released',
        event: InventoryEvent.STOCK_RELEASED
      },
      {
        topic: 'inventory.stock.adjusted',
        event: InventoryEvent.STOCK_ADJUSTED
      },
      {
        topic: 'inventory.audit.requested',
        event: InventoryEvent.AUDIT_REQUESTED
      },
      {
        topic: 'inventory.reorder.triggered',
        event: InventoryEvent.REORDER_TRIGGERED
      }
    ] as KafkaEvent<InventoryEvent>[]
  },
  
  transitions: [
    // Stock receiving flow (from Kafka)
    {
      from: InventoryStatus.RECEIVING,
      to: InventoryStatus.AVAILABLE,
      event: InventoryEvent.STOCK_RECEIVED,
      conditions: [
        (item: InventoryItem) => item.quantity > 0
      ]
    },
    
    // Reservation and allocation flow
    {
      from: InventoryStatus.AVAILABLE,
      to: InventoryStatus.RESERVED,
      event: InventoryEvent.RESERVE,
      conditions: [
        (item: InventoryItem) => item.availableQuantity > 0
      ]
    },
    {
      from: InventoryStatus.RESERVED,
      to: InventoryStatus.ALLOCATED,
      event: InventoryEvent.STOCK_ALLOCATED,
      conditions: [
        (item: InventoryItem) => item.reservedQuantity > 0
      ]
    },
    {
      from: InventoryStatus.ALLOCATED,
      to: InventoryStatus.IN_TRANSIT,
      event: InventoryEvent.SHIP
    },
    
    // Release flow (from Kafka)
    {
      from: [InventoryStatus.RESERVED, InventoryStatus.ALLOCATED],
      to: InventoryStatus.AVAILABLE,
      event: InventoryEvent.STOCK_RELEASED
    },
    
    // Adjustment flow (from Kafka)
    {
      from: [InventoryStatus.AVAILABLE, InventoryStatus.RESERVED],
      to: InventoryStatus.AVAILABLE,
      event: InventoryEvent.STOCK_ADJUSTED
    },
    
    // Audit flow (from Kafka)
    {
      from: [InventoryStatus.AVAILABLE, InventoryStatus.RESERVED],
      to: InventoryStatus.AUDITING,
      event: InventoryEvent.AUDIT_REQUESTED
    },
    {
      from: InventoryStatus.AUDITING,
      to: InventoryStatus.AVAILABLE,
      event: InventoryEvent.AUDIT_COMPLETE
    },
    
    // Quarantine flow
    {
      from: [InventoryStatus.AVAILABLE, InventoryStatus.RECEIVING],
      to: InventoryStatus.QUARANTINE,
      event: InventoryEvent.QUARANTINE,
      conditions: [
        (item: InventoryItem, payload: any) => payload?.reason !== undefined
      ]
    },
    {
      from: InventoryStatus.QUARANTINE,
      to: InventoryStatus.AVAILABLE,
      event: InventoryEvent.RELEASE_FROM_QUARANTINE
    },
    {
      from: InventoryStatus.QUARANTINE,
      to: InventoryStatus.DAMAGED,
      event: InventoryEvent.DAMAGE_REPORTED
    },
    
    // Damage and expiration
    {
      from: [InventoryStatus.AVAILABLE, InventoryStatus.RESERVED, InventoryStatus.ALLOCATED],
      to: InventoryStatus.DAMAGED,
      event: InventoryEvent.DAMAGE_REPORTED
    },
    {
      from: [InventoryStatus.AVAILABLE, InventoryStatus.RESERVED],
      to: InventoryStatus.EXPIRED,
      event: InventoryEvent.EXPIRE,
      conditions: [
        (item: InventoryItem) => item.isExpired()
      ]
    },
    
    // Reorder flow (from Kafka)
    {
      from: InventoryStatus.AVAILABLE,
      to: InventoryStatus.REORDER_PENDING,
      event: InventoryEvent.REORDER_TRIGGERED,
      conditions: [
        (item: InventoryItem) => item.isLowStock()
      ]
    },
    {
      from: InventoryStatus.REORDER_PENDING,
      to: InventoryStatus.REORDERED,
      event: InventoryEvent.STOCK_RECEIVED
    }
  ]
};