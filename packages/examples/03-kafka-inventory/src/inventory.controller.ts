import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryItem, InventoryStatus } from './inventory.entity';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async getAllInventory(): Promise<InventoryItem[]> {
    return await this.inventoryService.getAllInventory();
  }

  @Get('status/:status')
  async getByStatus(@Param('status') status: InventoryStatus): Promise<InventoryItem[]> {
    return await this.inventoryService.getInventoryByStatus(status);
  }

  @Get('sku/:sku')
  async getBySku(@Param('sku') sku: string): Promise<InventoryItem | null> {
    return await this.inventoryService.getInventoryBySku(sku);
  }

  @Get('low-stock')
  async getLowStock(): Promise<InventoryItem[]> {
    return await this.inventoryService.getLowStockItems();
  }

  @Get('expiring/:days')
  async getExpiring(@Param('days') days: string): Promise<InventoryItem[]> {
    return await this.inventoryService.getExpiringItems(parseInt(days));
  }

  @Get('warehouse/:warehouse/stats')
  async getWarehouseStats(@Param('warehouse') warehouse: string) {
    return await this.inventoryService.getWarehouseStats(warehouse);
  }

  @Post('create')
  async createItem(@Body() data: any): Promise<InventoryItem> {
    return await this.inventoryService.createInventoryItem(data);
  }

  @Post(':sku/reserve')
  async reserveStock(@Param('sku') sku: string, @Body() data: { quantity: number }): Promise<InventoryItem> {
    return await this.inventoryService.reserveStock(sku, data.quantity);
  }

  @Post(':sku/ship')
  async shipInventory(@Param('sku') sku: string): Promise<InventoryItem> {
    return await this.inventoryService.shipInventory(sku);
  }

  @Post(':sku/quarantine')
  async quarantineItem(@Param('sku') sku: string, @Body() data: { reason: string }): Promise<InventoryItem> {
    return await this.inventoryService.quarantineItem(sku, data.reason);
  }

  @Post(':sku/audit/complete')
  async completeAudit(
    @Param('sku') sku: string,
    @Body() data: { actualQuantity: number; notes?: string }
  ): Promise<InventoryItem> {
    return await this.inventoryService.completeAudit(sku, data.actualQuantity, data.notes);
  }
}