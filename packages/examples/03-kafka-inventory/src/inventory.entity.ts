export enum InventoryStatus {
  AVAILABLE = 'available',
  RESERVED = 'reserved',
  ALLOCATED = 'allocated',
  IN_TRANSIT = 'in_transit',
  RECEIVING = 'receiving',
  QUARANTINE = 'quarantine',
  DAMAGED = 'damaged',
  EXPIRED = 'expired',
  AUDITING = 'auditing',
  REORDER_PENDING = 'reorder_pending',
  REORDERED = 'reordered'
}

export enum InventoryEvent {
  // Kafka-driven events
  STOCK_RECEIVED = 'inventory.stock.received',
  STOCK_ALLOCATED = 'inventory.stock.allocated',
  STOCK_RELEASED = 'inventory.stock.released',
  STOCK_ADJUSTED = 'inventory.stock.adjusted',
  AUDIT_REQUESTED = 'inventory.audit.requested',
  REORDER_TRIGGERED = 'inventory.reorder.triggered',
  
  // Internal workflow events
  RESERVE = 'inventory.reserve',
  SHIP = 'inventory.ship',
  DAMAGE_REPORTED = 'inventory.damage.reported',
  EXPIRE = 'inventory.expire',
  AUDIT_COMPLETE = 'inventory.audit.complete',
  QUARANTINE = 'inventory.quarantine',
  RELEASE_FROM_QUARANTINE = 'inventory.release.quarantine'
}

export interface Location {
  warehouse: string;
  zone: string;
  shelf: string;
  bin: string;
}

export interface StockMovement {
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason: string;
  timestamp: Date;
  reference?: string;
  performedBy?: string;
}

export interface AuditInfo {
  requestedAt?: Date;
  completedAt?: Date;
  discrepancy?: number;
  notes?: string;
  auditor?: string;
}

export interface ReorderInfo {
  reorderPoint: number;
  reorderQuantity: number;
  lastReorderDate?: Date;
  supplier?: string;
  leadTimeDays?: number;
}

export class InventoryItem {
  id: string;
  sku: string;
  productName: string;
  description?: string;
  
  status: InventoryStatus;
  
  quantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  allocatedQuantity: number;
  
  location: Location;
  
  unitCost: number;
  totalValue: number;
  
  movements: StockMovement[];
  
  batchNumber?: string;
  serialNumbers?: string[];
  expirationDate?: Date;
  
  auditInfo?: AuditInfo;
  reorderInfo?: ReorderInfo;
  
  lastActivityDate: Date;
  createdAt: Date;
  updatedAt: Date;
  
  constructor(partial?: Partial<InventoryItem>) {
    Object.assign(this, partial);
    this.id = this.id || `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.sku = this.sku || `SKU-${Date.now()}`;
    this.status = this.status || InventoryStatus.AVAILABLE;
    this.movements = this.movements || [];
    this.quantity = this.quantity || 0;
    this.availableQuantity = this.availableQuantity || this.quantity;
    this.reservedQuantity = this.reservedQuantity || 0;
    this.allocatedQuantity = this.allocatedQuantity || 0;
    this.createdAt = this.createdAt || new Date();
    this.updatedAt = this.updatedAt || new Date();
    this.lastActivityDate = this.lastActivityDate || new Date();
  }
  
  addMovement(type: 'in' | 'out' | 'adjustment', quantity: number, reason: string, reference?: string): void {
    this.movements.push({
      type,
      quantity,
      reason,
      timestamp: new Date(),
      reference
    });
    this.lastActivityDate = new Date();
  }
  
  calculateTotalValue(): void {
    this.totalValue = this.quantity * this.unitCost;
  }
  
  isLowStock(): boolean {
    if (!this.reorderInfo) return false;
    return this.availableQuantity <= this.reorderInfo.reorderPoint;
  }
  
  isExpired(): boolean {
    if (!this.expirationDate) return false;
    return new Date() > this.expirationDate;
  }
  
  isExpiringSoon(daysThreshold: number = 30): boolean {
    if (!this.expirationDate) return false;
    const daysUntilExpiry = Math.floor((this.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= daysThreshold && daysUntilExpiry > 0;
  }
  
  reserve(quantity: number): boolean {
    if (this.availableQuantity >= quantity) {
      this.reservedQuantity += quantity;
      this.availableQuantity -= quantity;
      return true;
    }
    return false;
  }
  
  allocate(quantity: number): boolean {
    if (this.reservedQuantity >= quantity) {
      this.allocatedQuantity += quantity;
      this.reservedQuantity -= quantity;
      this.quantity -= quantity;
      return true;
    }
    return false;
  }
  
  release(quantity: number): void {
    this.availableQuantity += quantity;
    this.reservedQuantity = Math.max(0, this.reservedQuantity - quantity);
  }
}

// Kafka message payload interfaces
export interface StockReceivedPayload {
  sku: string;
  quantity: number;
  batchNumber?: string;
  expirationDate?: string;
  location: Location;
  unitCost: number;
  supplier?: string;
  purchaseOrderNumber?: string;
}

export interface StockAllocatedPayload {
  sku: string;
  quantity: number;
  orderId: string;
  customerId?: string;
  shippingAddress?: string;
}

export interface StockReleasedPayload {
  sku: string;
  quantity: number;
  reason: string;
  orderId?: string;
}

export interface StockAdjustedPayload {
  sku: string;
  adjustmentQuantity: number; // positive or negative
  reason: string;
  performedBy: string;
  notes?: string;
}

export interface AuditRequestedPayload {
  sku: string;
  requestedBy: string;
  priority: 'low' | 'medium' | 'high';
  notes?: string;
}

export interface ReorderTriggeredPayload {
  sku: string;
  currentQuantity: number;
  reorderQuantity: number;
  supplier: string;
  urgency: 'normal' | 'urgent';
}