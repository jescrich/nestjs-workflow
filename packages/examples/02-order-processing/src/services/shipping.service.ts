import { Injectable, Logger } from '@nestjs/common';
import { Order, ShippingMethod } from '../order.entity';

export interface ShipmentInfo {
  trackingNumber: string;
  carrier: string;
  estimatedDeliveryDays: number;
}

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  async createShipment(order: Order): Promise<ShipmentInfo> {
    this.logger.log(`Creating shipment for order ${order.orderNumber}`);
    
    const carrier = this.getCarrier(order.shipping?.method);
    const trackingNumber = this.generateTrackingNumber(carrier);
    const estimatedDeliveryDays = this.getEstimatedDeliveryDays(order.shipping?.method);
    
    return {
      trackingNumber,
      carrier,
      estimatedDeliveryDays
    };
  }

  calculateShippingCost(method: ShippingMethod, subtotal: number): number {
    const baseCost = this.getBaseShippingCost(method);
    const weightMultiplier = 1 + (subtotal / 1000) * 0.1; // Add 10% for every $1000
    
    return Math.round(baseCost * weightMultiplier * 100) / 100;
  }

  private getCarrier(method?: ShippingMethod): string {
    switch (method) {
      case ShippingMethod.OVERNIGHT:
        return 'FedEx';
      case ShippingMethod.EXPRESS:
        return 'UPS';
      case ShippingMethod.STANDARD:
        return 'USPS';
      case ShippingMethod.PICKUP:
        return 'In-Store';
      default:
        return 'USPS';
    }
  }

  private generateTrackingNumber(carrier: string): string {
    const prefix = carrier.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    return `${prefix}-${timestamp}-${random}`;
  }

  private getEstimatedDeliveryDays(method?: ShippingMethod): number {
    switch (method) {
      case ShippingMethod.OVERNIGHT:
        return 1;
      case ShippingMethod.EXPRESS:
        return 2;
      case ShippingMethod.STANDARD:
        return 5;
      case ShippingMethod.PICKUP:
        return 0;
      default:
        return 7;
    }
  }

  private getBaseShippingCost(method: ShippingMethod): number {
    switch (method) {
      case ShippingMethod.OVERNIGHT:
        return 29.99;
      case ShippingMethod.EXPRESS:
        return 14.99;
      case ShippingMethod.STANDARD:
        return 5.99;
      case ShippingMethod.PICKUP:
        return 0;
      default:
        return 5.99;
    }
  }

  async trackShipment(trackingNumber: string): Promise<{
    status: string;
    location: string;
    lastUpdate: Date;
  }> {
    // Simulate tracking information
    const statuses = [
      { status: 'In Transit', location: 'Distribution Center' },
      { status: 'Out for Delivery', location: 'Local Facility' },
      { status: 'Delivered', location: 'Customer Address' }
    ];
    
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    
    return {
      ...randomStatus,
      lastUpdate: new Date()
    };
  }
}