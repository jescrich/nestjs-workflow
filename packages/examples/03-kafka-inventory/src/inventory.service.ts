import { Injectable, Inject, Logger } from '@nestjs/common';
import { WorkflowService } from '@jescrich/nestjs-workflow';
import { 
  InventoryItem, 
  InventoryStatus, 
  InventoryEvent,
  Location
} from './inventory.entity';
import { InventoryEntityService } from './inventory.entity.service';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @Inject('InventoryManagementWorkflow')
    private readonly workflowService: WorkflowService<InventoryItem, any, InventoryEvent, InventoryStatus>,
    private readonly entityService: InventoryEntityService
  ) {}

  // Create new inventory item
  async createInventoryItem(data: {
    sku: string;
    productName: string;
    description?: string;
    location: Location;
    unitCost: number;
    reorderPoint?: number;
    reorderQuantity?: number;
    supplier?: string;
  }): Promise<InventoryItem> {
    // Check if item already exists
    const existing = await this.entityService.findBySku(data.sku);
    if (existing) {
      this.logger.log(`Inventory item ${data.sku} already exists`);
      return existing;
    }

    const item = await this.entityService.new();
    
    item.sku = data.sku;
    item.productName = data.productName;
    item.description = data.description;
    item.location = data.location;
    item.unitCost = data.unitCost;
    item.quantity = 0;
    item.availableQuantity = 0;
    item.status = InventoryStatus.RECEIVING; // Items start in receiving status
    
    if (data.reorderPoint) {
      item.reorderInfo = {
        reorderPoint: data.reorderPoint,
        reorderQuantity: data.reorderQuantity || data.reorderPoint * 2,
        supplier: data.supplier,
        leadTimeDays: 7
      };
    }
    
    item.calculateTotalValue();
    
    const savedItem = await this.entityService.save(item);
    this.logger.log(`Created inventory item: ${item.sku} with ID: ${item.id}`);
    
    return savedItem;
  }

  // Process workflow events (called by workflow actions if needed)
  async processStockReceived(item: InventoryItem, quantity: number, batchNumber?: string, expirationDate?: string): Promise<InventoryItem> {
    item.quantity += quantity;
    item.availableQuantity += quantity;
    
    if (batchNumber) {
      item.batchNumber = batchNumber;
    }
    
    if (expirationDate) {
      item.expirationDate = new Date(expirationDate);
    }
    
    item.addMovement('in', quantity, 'Stock received from Kafka event');
    item.calculateTotalValue();
    
    await this.entityService.save(item);
    this.logger.log(`Stock received for ${item.sku}: +${quantity} units (total: ${item.quantity})`);
    
    return item;
  }

  async processStockAllocated(item: InventoryItem, quantity: number, orderId: string): Promise<InventoryItem> {
    if (item.allocate(quantity)) {
      item.addMovement('out', quantity, 'Stock allocated via Kafka', orderId);
      item.calculateTotalValue();
      
      await this.entityService.save(item);
      this.logger.log(`Stock allocated for ${item.sku}: -${quantity} units for order ${orderId}`);
      
      // Check if reorder is needed
      if (item.isLowStock()) {
        this.logger.warn(`Low stock alert for ${item.sku}: ${item.availableQuantity} units remaining`);
      }
    }
    
    return item;
  }

  async processStockReleased(item: InventoryItem, quantity: number, reason: string): Promise<InventoryItem> {
    item.release(quantity);
    item.addMovement('in', quantity, `Stock released: ${reason}`);
    
    await this.entityService.save(item);
    this.logger.log(`Stock released for ${item.sku}: +${quantity} units returned`);
    
    return item;
  }

  async processStockAdjusted(item: InventoryItem, adjustmentQuantity: number, reason: string, performedBy: string): Promise<InventoryItem> {
    const previousQuantity = item.quantity;
    item.quantity += adjustmentQuantity;
    item.availableQuantity += adjustmentQuantity;
    
    // Ensure non-negative quantities
    item.quantity = Math.max(0, item.quantity);
    item.availableQuantity = Math.max(0, item.availableQuantity);
    
    item.addMovement(
      'adjustment', 
      adjustmentQuantity, 
      `Adjustment: ${reason} by ${performedBy}`
    );
    item.calculateTotalValue();
    
    await this.entityService.save(item);
    this.logger.log(`Stock adjusted for ${item.sku}: ${previousQuantity} → ${item.quantity} (${adjustmentQuantity > 0 ? '+' : ''}${adjustmentQuantity})`);
    
    return item;
  }

  async startAudit(item: InventoryItem, requestedBy: string, notes?: string): Promise<InventoryItem> {
    item.auditInfo = {
      requestedAt: new Date(),
      notes,
      auditor: requestedBy
    };
    
    await this.entityService.save(item);
    this.logger.log(`Audit started for ${item.sku} by ${requestedBy}`);
    
    return item;
  }

  async completeAudit(sku: string, actualQuantity: number, notes?: string): Promise<InventoryItem> {
    const item = await this.entityService.findBySku(sku);
    
    if (!item || item.status !== InventoryStatus.AUDITING) {
      throw new Error(`Item ${sku} is not in auditing status`);
    }
    
    const discrepancy = actualQuantity - item.quantity;
    
    if (item.auditInfo) {
      item.auditInfo.completedAt = new Date();
      item.auditInfo.discrepancy = discrepancy;
      item.auditInfo.notes = notes;
    }
    
    // Apply adjustment if there's a discrepancy
    if (discrepancy !== 0) {
      await this.processStockAdjusted(
        item,
        discrepancy,
        'Audit adjustment',
        item.auditInfo?.auditor || 'System'
      );
    }
    
    const updatedItem = await this.workflowService.emit({
      urn: item.id,
      event: InventoryEvent.AUDIT_COMPLETE,
      payload: { actualQuantity, discrepancy, notes }
    });
    
    await this.entityService.save(updatedItem);
    this.logger.log(`Audit completed for ${item.sku}: discrepancy of ${discrepancy} units`);
    
    return updatedItem;
  }

  // Manual workflow triggers (for non-Kafka events)
  async reserveStock(sku: string, quantity: number): Promise<InventoryItem> {
    const item = await this.entityService.findBySku(sku);
    
    if (!item) {
      throw new Error(`Inventory item ${sku} not found`);
    }
    
    if (!item.reserve(quantity)) {
      throw new Error(`Insufficient stock for ${sku}. Available: ${item.availableQuantity}, Requested: ${quantity}`);
    }
    
    const updatedItem = await this.workflowService.emit({
      urn: item.id,
      event: InventoryEvent.RESERVE,
      payload: { quantity }
    });
    
    await this.entityService.save(updatedItem);
    this.logger.log(`Reserved ${quantity} units of ${sku}`);
    
    return updatedItem;
  }

  async shipInventory(sku: string): Promise<InventoryItem> {
    const item = await this.entityService.findBySku(sku);
    
    if (!item || item.status !== InventoryStatus.ALLOCATED) {
      throw new Error(`Item ${sku} is not in allocated status`);
    }
    
    const updatedItem = await this.workflowService.emit({
      urn: item.id,
      event: InventoryEvent.SHIP,
      payload: { shippedAt: new Date() }
    });
    
    await this.entityService.save(updatedItem);
    this.logger.log(`Shipped inventory for ${sku}`);
    
    return updatedItem;
  }

  async quarantineItem(sku: string, reason: string): Promise<InventoryItem> {
    const item = await this.entityService.findBySku(sku);
    
    if (!item) {
      throw new Error(`Inventory item ${sku} not found`);
    }
    
    const updatedItem = await this.workflowService.emit({
      urn: item.id,
      event: InventoryEvent.QUARANTINE,
      payload: { reason }
    });
    
    await this.entityService.save(updatedItem);
    this.logger.log(`Item ${sku} moved to quarantine: ${reason}`);
    
    return updatedItem;
  }

  // Query methods
  async getInventoryItem(id: string): Promise<InventoryItem | null> {
    return await this.entityService.findById(id);
  }

  async getInventoryBySku(sku: string): Promise<InventoryItem | null> {
    return await this.entityService.findBySku(sku);
  }

  async getAllInventory(): Promise<InventoryItem[]> {
    return await this.entityService.findAll();
  }

  async getInventoryByStatus(status: InventoryStatus): Promise<InventoryItem[]> {
    return await this.entityService.findByStatus(status);
  }

  async getLowStockItems(): Promise<InventoryItem[]> {
    return await this.entityService.findLowStock();
  }

  async getExpiringItems(daysThreshold: number = 30): Promise<InventoryItem[]> {
    return await this.entityService.findExpiring(daysThreshold);
  }

  async getWarehouseStats(warehouse: string) {
    return await this.entityService.getWarehouseStats(warehouse);
  }
}