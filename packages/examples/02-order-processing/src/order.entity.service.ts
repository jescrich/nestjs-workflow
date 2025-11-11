import { Injectable, Logger } from '@nestjs/common';
import { EntityService } from '@jescrich/nestjs-workflow';
import { Order, OrderStatus } from './order.entity';

@Injectable()
export class OrderEntityService extends EntityService<Order, OrderStatus> {
  private readonly logger = new Logger(OrderEntityService.name);
  private static ordersStore: Map<string, Order> = new Map();
  
  // Use static to ensure single store across all instances
  private get orders(): Map<string, Order> {
    return OrderEntityService.ordersStore;
  }

  async new(): Promise<Order> {
    return new Order();
  }

  async update(entity: Order, status: OrderStatus): Promise<Order> {
    entity.status = status;
    entity.updatedAt = new Date();
    this.orders.set(entity.id, entity);
    this.logger.log(`Updated order ${entity.id} to status ${status}. Total orders in store: ${this.orders.size}`);
    return entity;
  }

  async load(urn: string): Promise<Order | null> {
    const order = this.orders.get(urn) || null;
    this.logger.log(`Loading order ${urn}: ${order ? 'found' : 'not found'}. Total orders in store: ${this.orders.size}`);
    if (!order && this.orders.size > 0) {
      this.logger.debug(`Available order IDs: ${Array.from(this.orders.keys()).join(', ')}`);
    }
    return order;
  }

  status(entity: Order): OrderStatus {
    return entity.status;
  }

  urn(entity: Order): string {
    return entity.id;
  }

  // Additional helper methods
  async findById(id: string): Promise<Order | null> {
    return this.orders.get(id) || null;
  }

  async save(order: Order): Promise<Order> {
    this.orders.set(order.id, order);
    this.logger.log(`Saved order ${order.id}. Total orders in store: ${this.orders.size}`);
    return order;
  }

  async findAll(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  async findByStatus(status: OrderStatus): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(order => order.status === status);
  }

  async findByCustomer(customerId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(order => order.customerId === customerId);
  }

  async deleteById(id: string): Promise<boolean> {
    return this.orders.delete(id);
  }

  async clear(): Promise<void> {
    this.orders.clear();
  }
}