export enum OrderStatus {
  CREATED = 'created',
  PAYMENT_PENDING = 'payment_pending',
  PAYMENT_FAILED = 'payment_failed',
  PAID = 'paid',
  PROCESSING = 'processing',
  READY_TO_SHIP = 'ready_to_ship',
  SHIPPED = 'shipped',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  RETURNED = 'returned'
}

export enum OrderEvent {
  INITIATE_PAYMENT = 'order.initiate.payment',
  PAYMENT_SUCCESS = 'order.payment.success',
  PAYMENT_FAILED = 'order.payment.failed',
  RETRY_PAYMENT = 'order.retry.payment',
  START_PROCESSING = 'order.start.processing',
  COMPLETE_PROCESSING = 'order.complete.processing',
  PREPARE_SHIPMENT = 'order.prepare.shipment',
  SHIP = 'order.ship',
  OUT_FOR_DELIVERY = 'order.out.for.delivery',
  DELIVER = 'order.deliver',
  CANCEL = 'order.cancel',
  REQUEST_REFUND = 'order.request.refund',
  PROCESS_REFUND = 'order.process.refund',
  INITIATE_RETURN = 'order.initiate.return',
  COMPLETE_RETURN = 'order.complete.return'
}

export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  PAYPAL = 'paypal',
  BANK_TRANSFER = 'bank_transfer',
  CASH_ON_DELIVERY = 'cod'
}

export enum ShippingMethod {
  STANDARD = 'standard',
  EXPRESS = 'express',
  OVERNIGHT = 'overnight',
  PICKUP = 'pickup'
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  recipientName: string;
  phoneNumber: string;
}

export interface PaymentInfo {
  method: PaymentMethod;
  transactionId?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'success' | 'failed' | 'refunded';
  failureReason?: string;
  processedAt?: Date;
}

export interface ShippingInfo {
  method: ShippingMethod;
  carrier?: string;
  trackingNumber?: string;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  shippedAt?: Date;
  address: ShippingAddress;
}

export interface OrderTimeline {
  event: string;
  timestamp: Date;
  description: string;
  metadata?: any;
}

export class Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  
  status: OrderStatus;
  
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shippingCost: number;
  total: number;
  
  payment?: PaymentInfo;
  shipping?: ShippingInfo;
  
  timeline: OrderTimeline[];
  
  notes?: string;
  specialInstructions?: string;
  
  createdAt: Date;
  updatedAt: Date;
  
  constructor(partial?: Partial<Order>) {
    Object.assign(this, partial);
    this.id = this.id || `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.orderNumber = this.orderNumber || `ORD-${Date.now()}`;
    this.status = this.status || OrderStatus.CREATED;
    this.timeline = this.timeline || [];
    this.items = this.items || [];
    this.createdAt = this.createdAt || new Date();
    this.updatedAt = this.updatedAt || new Date();
  }
  
  addTimelineEvent(event: string, description: string, metadata?: any): void {
    this.timeline.push({
      event,
      timestamp: new Date(),
      description,
      metadata
    });
  }
  
  calculateTotals(): void {
    this.subtotal = this.items.reduce((sum, item) => sum + item.subtotal, 0);
    this.tax = this.subtotal * 0.1; // 10% tax
    this.total = this.subtotal + this.tax + (this.shippingCost || 0);
  }
  
  getEstimatedDeliveryDays(): number {
    if (!this.shipping) return 0;
    
    switch (this.shipping.method) {
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
}