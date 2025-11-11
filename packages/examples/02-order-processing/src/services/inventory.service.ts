import { Injectable, Logger } from '@nestjs/common';
import { OrderItem } from '../order.entity';

interface InventoryItem {
  productId: string;
  available: number;
  reserved: number;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);
  private inventory: Map<string, InventoryItem> = new Map();

  constructor() {
    this.initializeInventory();
  }

  private initializeInventory() {
    // Initialize with some sample inventory
    const products = [
      { productId: 'LAPTOP-001', available: 50 },
      { productId: 'PHONE-001', available: 100 },
      { productId: 'TABLET-001', available: 30 },
      { productId: 'WATCH-001', available: 75 },
      { productId: 'HEADPHONES-001', available: 200 },
      { productId: 'KEYBOARD-001', available: 150 },
      { productId: 'MOUSE-001', available: 180 },
      { productId: 'MONITOR-001', available: 40 },
      { productId: 'CHARGER-001', available: 300 },
      { productId: 'CASE-001', available: 250 }
    ];

    products.forEach(product => {
      this.inventory.set(product.productId, {
        productId: product.productId,
        available: product.available,
        reserved: 0
      });
    });
  }

  async checkAvailability(items: OrderItem[]): Promise<boolean> {
    for (const item of items) {
      const inventoryItem = this.inventory.get(item.productId);
      
      if (!inventoryItem) {
        // If product doesn't exist in our inventory, assume it's available
        // (for demo purposes)
        this.inventory.set(item.productId, {
          productId: item.productId,
          available: 1000,
          reserved: 0
        });
        continue;
      }
      
      if (inventoryItem.available < item.quantity) {
        this.logger.warn(`Insufficient inventory for ${item.productId}: ${inventoryItem.available} < ${item.quantity}`);
        return false;
      }
    }
    
    return true;
  }

  async reserveItems(items: OrderItem[]): Promise<boolean> {
    // First check if all items are available
    if (!await this.checkAvailability(items)) {
      return false;
    }
    
    // Reserve the items
    for (const item of items) {
      const inventoryItem = this.inventory.get(item.productId);
      
      if (inventoryItem) {
        inventoryItem.available -= item.quantity;
        inventoryItem.reserved += item.quantity;
        this.logger.log(`Reserved ${item.quantity} units of ${item.productId}`);
      }
    }
    
    return true;
  }

  async releaseItems(items: OrderItem[]): Promise<void> {
    for (const item of items) {
      const inventoryItem = this.inventory.get(item.productId);
      
      if (inventoryItem) {
        inventoryItem.available += item.quantity;
        inventoryItem.reserved = Math.max(0, inventoryItem.reserved - item.quantity);
        this.logger.log(`Released ${item.quantity} units of ${item.productId}`);
      }
    }
  }

  async commitItems(items: OrderItem[]): Promise<void> {
    for (const item of items) {
      const inventoryItem = this.inventory.get(item.productId);
      
      if (inventoryItem) {
        inventoryItem.reserved = Math.max(0, inventoryItem.reserved - item.quantity);
        this.logger.log(`Committed ${item.quantity} units of ${item.productId}`);
      }
    }
  }

  getInventoryStatus(): Map<string, InventoryItem> {
    return new Map(this.inventory);
  }

  resetInventory(): void {
    this.inventory.clear();
    this.initializeInventory();
  }
}