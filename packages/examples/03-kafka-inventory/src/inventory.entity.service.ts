import { Injectable, Logger } from '@nestjs/common';
import { EntityService } from '@jescrich/nestjs-workflow';
import { InventoryItem, InventoryStatus } from './inventory.entity';

@Injectable()
export class InventoryEntityService extends EntityService<InventoryItem, InventoryStatus> {
  private readonly logger = new Logger(InventoryEntityService.name);
  // Use static to ensure single store across all instances (for demo purposes)
  private static inventoryStore: Map<string, InventoryItem> = new Map();
  
  private get inventory(): Map<string, InventoryItem> {
    return InventoryEntityService.inventoryStore;
  }

  async new(): Promise<InventoryItem> {
    const item = new InventoryItem();
    item.status = InventoryStatus.RECEIVING; // Items start in receiving status
    return item;
  }

  async update(entity: InventoryItem, status: InventoryStatus): Promise<InventoryItem> {
    entity.status = status;
    entity.updatedAt = new Date();
    entity.lastActivityDate = new Date();
    this.inventory.set(entity.id, entity);
    this.logger.log(`Updated inventory item ${entity.sku} to status ${status}. Total items: ${this.inventory.size}`);
    return entity;
  }

  async load(urn: string): Promise<InventoryItem | null> {
    const item = this.inventory.get(urn) || null;
    this.logger.log(`Loading inventory item ${urn}: ${item ? 'found' : 'not found'}. Total items: ${this.inventory.size}`);
    if (!item && this.inventory.size > 0) {
      this.logger.debug(`Available item IDs: ${Array.from(this.inventory.keys()).join(', ')}`);
    }
    return item;
  }

  status(entity: InventoryItem): InventoryStatus {
    return entity.status;
  }

  urn(entity: InventoryItem): string {
    return entity.id;
  }

  // Additional helper methods for inventory management
  async findById(id: string): Promise<InventoryItem | null> {
    return this.inventory.get(id) || null;
  }

  async findBySku(sku: string): Promise<InventoryItem | null> {
    const items = Array.from(this.inventory.values());
    return items.find(item => item.sku === sku) || null;
  }

  async save(item: InventoryItem): Promise<InventoryItem> {
    this.inventory.set(item.id, item);
    this.logger.log(`Saved inventory item ${item.sku} (${item.id}). Total items: ${this.inventory.size}`);
    return item;
  }

  async findAll(): Promise<InventoryItem[]> {
    return Array.from(this.inventory.values());
  }

  async findByStatus(status: InventoryStatus): Promise<InventoryItem[]> {
    return Array.from(this.inventory.values()).filter(item => item.status === status);
  }

  async findByLocation(warehouse: string, zone?: string): Promise<InventoryItem[]> {
    return Array.from(this.inventory.values()).filter(item => {
      if (item.location.warehouse !== warehouse) return false;
      if (zone && item.location.zone !== zone) return false;
      return true;
    });
  }

  async findLowStock(): Promise<InventoryItem[]> {
    return Array.from(this.inventory.values()).filter(item => item.isLowStock());
  }

  async findExpiring(daysThreshold: number = 30): Promise<InventoryItem[]> {
    return Array.from(this.inventory.values()).filter(item => item.isExpiringSoon(daysThreshold));
  }

  async findExpired(): Promise<InventoryItem[]> {
    return Array.from(this.inventory.values()).filter(item => item.isExpired());
  }

  async getTotalValue(): Promise<number> {
    const items = Array.from(this.inventory.values());
    return items.reduce((total, item) => total + item.totalValue, 0);
  }

  async getWarehouseStats(warehouse: string): Promise<{
    totalItems: number;
    totalValue: number;
    availableQuantity: number;
    reservedQuantity: number;
    allocatedQuantity: number;
  }> {
    const items = await this.findByLocation(warehouse);
    
    return {
      totalItems: items.length,
      totalValue: items.reduce((sum, item) => sum + item.totalValue, 0),
      availableQuantity: items.reduce((sum, item) => sum + item.availableQuantity, 0),
      reservedQuantity: items.reduce((sum, item) => sum + item.reservedQuantity, 0),
      allocatedQuantity: items.reduce((sum, item) => sum + item.allocatedQuantity, 0)
    };
  }

  // Clear all inventory (for testing)
  async clearAll(): Promise<void> {
    InventoryEntityService.inventoryStore.clear();
    this.logger.log('Cleared all inventory items');
  }
}