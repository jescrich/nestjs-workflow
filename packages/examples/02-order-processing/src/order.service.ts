import { Injectable, Inject, Logger } from '@nestjs/common';
import { WorkflowService } from '@jescrich/nestjs-workflow';
import { Order, OrderStatus, OrderEvent, OrderItem, PaymentMethod, ShippingMethod, ShippingAddress } from './order.entity';
import { OrderEntityService } from './order.entity.service';
import { PaymentService } from './services/payment.service';
import { InventoryService } from './services/inventory.service';
import { ShippingService } from './services/shipping.service';

export interface CreateOrderDto {
  customerId: string;
  customerEmail: string;
  customerName: string;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  shippingMethod: ShippingMethod;
  paymentMethod: PaymentMethod;
  notes?: string;
  specialInstructions?: string;
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @Inject('OrderProcessingWorkflow')
    private readonly workflowService: WorkflowService<Order, any, OrderEvent, OrderStatus>,
    private readonly entityService: OrderEntityService,
    private readonly paymentService: PaymentService,
    private readonly inventoryService: InventoryService,
    private readonly shippingService: ShippingService
  ) {}

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    // Create a new order through the entity service
    const order = await this.entityService.new();
    
    // Set order properties - preserve the ID!
    order.customerId = dto.customerId;
    order.customerEmail = dto.customerEmail;
    order.customerName = dto.customerName;
    order.items = dto.items;
    order.notes = dto.notes;
    order.specialInstructions = dto.specialInstructions;
    order.shipping = {
      method: dto.shippingMethod,
      address: dto.shippingAddress,
      shippedAt: undefined,
      estimatedDelivery: undefined,
      actualDelivery: undefined,
      carrier: undefined,
      trackingNumber: undefined
    };
    order.payment = {
      method: dto.paymentMethod,
      amount: 0, // Will be calculated
      currency: 'USD',
      status: 'pending',
      transactionId: undefined,
      processedAt: undefined,
      failureReason: undefined
    };

    // Calculate pricing
    order.calculateTotals();
    order.shippingCost = this.shippingService.calculateShippingCost(dto.shippingMethod, order.subtotal);
    order.calculateTotals(); // Recalculate with shipping
    
    if (order.payment) {
      order.payment.amount = order.total;
    }

    order.addTimelineEvent('order_created', 'Order created successfully');
    
    // Save the order
    const savedOrder = await this.entityService.save(order);
    
    return savedOrder;
  }

  async processWorkflowEvent(orderId: string, event: OrderEvent, payload?: any): Promise<Order> {
    const order = await this.entityService.findById(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Handle specific events with business logic
    switch (event) {
      case OrderEvent.INITIATE_PAYMENT:
        return await this.handlePaymentInitiation(order, payload);
      
      case OrderEvent.PAYMENT_SUCCESS:
        return await this.handlePaymentSuccess(order, payload);
      
      case OrderEvent.PAYMENT_FAILED:
        return await this.handlePaymentFailed(order, payload);
      
      case OrderEvent.START_PROCESSING:
        return await this.handleStartProcessing(order, payload);
      
      case OrderEvent.COMPLETE_PROCESSING:
        return await this.handleCompleteProcessing(order, payload);
      
      case OrderEvent.SHIP:
        return await this.handleShipping(order, payload);
        
      case OrderEvent.OUT_FOR_DELIVERY:
        return await this.handleOutForDelivery(order, payload);
      
      case OrderEvent.DELIVER:
        return await this.handleDelivery(order, payload);
      
      case OrderEvent.CANCEL:
        return await this.handleCancellation(order, payload);
      
      case OrderEvent.PROCESS_REFUND:
        return await this.handleRefund(order, payload);
      
      case OrderEvent.INITIATE_RETURN:
        return await this.handleReturn(order, payload);
      
      default:
        // For other events, just trigger the workflow transition
        return await this.workflowService.emit({
          urn: order.id,
          event: event,
          payload: payload
        });
    }
  }

  private async handlePaymentInitiation(order: Order, payload: any): Promise<Order> {
    this.logger.log(`Initiating payment for order ${order.orderNumber}`);
    
    // Update payment attempts in timeline
    order.addTimelineEvent('payment_initiated', 'Payment processing started');
    
    // For now, manually update status instead of using workflow
    order.status = OrderStatus.PAYMENT_PENDING;
    const updatedOrder = await this.entityService.save(order);
    
    // Simulate payment processing
    const paymentResult = await this.paymentService.processPayment(updatedOrder);
    
    if (paymentResult.success) {
      return await this.processWorkflowEvent(updatedOrder.id, OrderEvent.PAYMENT_SUCCESS, {
        transactionId: paymentResult.transactionId
      });
    } else {
      return await this.processWorkflowEvent(updatedOrder.id, OrderEvent.PAYMENT_FAILED, {
        failureReason: paymentResult.error
      });
    }
  }

  private async handlePaymentSuccess(order: Order, payload: any): Promise<Order> {
    this.logger.log(`Payment successful for order ${order.orderNumber}`);
    
    if (order.payment) {
      order.payment.status = 'success';
      order.payment.transactionId = payload?.transactionId;
      order.payment.processedAt = new Date();
    }
    
    order.addTimelineEvent('payment_completed', 'Payment successfully processed', {
      transactionId: payload?.transactionId
    });
    
    const updatedOrder = await this.workflowService.emit({
      urn: order.id,
      event: OrderEvent.PAYMENT_SUCCESS,
      payload: payload
    });
    await this.entityService.save(updatedOrder);
    
    // Auto-start processing
    return await this.processWorkflowEvent(updatedOrder.id, OrderEvent.START_PROCESSING);
  }

  private async handlePaymentFailed(order: Order, payload: any): Promise<Order> {
    this.logger.warn(`Payment failed for order ${order.orderNumber}: ${payload?.failureReason}`);
    
    if (order.payment) {
      order.payment.status = 'failed';
      order.payment.failureReason = payload?.failureReason;
    }
    
    order.addTimelineEvent('payment_failed', `Payment failed: ${payload?.failureReason}`);
    
    const updatedOrder = await this.workflowService.emit({
      urn: order.id,
      event: OrderEvent.PAYMENT_FAILED,
      payload: payload
    });
    return await this.entityService.save(updatedOrder);
  }

  private async handleStartProcessing(order: Order, payload: any): Promise<Order> {
    this.logger.log(`Starting processing for order ${order.orderNumber}`);
    
    // Reserve inventory
    const reserved = await this.inventoryService.reserveItems(order.items);
    if (!reserved) {
      throw new Error('Failed to reserve inventory');
    }
    
    order.addTimelineEvent('processing_started', 'Order processing started');
    
    const updatedOrder = await this.workflowService.emit({
      urn: order.id,
      event: OrderEvent.START_PROCESSING,
      payload: {
        ...payload,
        inventoryReserved: true
      }
    });
    
    return await this.entityService.save(updatedOrder);
  }

  private async handleCompleteProcessing(order: Order, payload: any): Promise<Order> {
    this.logger.log(`Processing complete for order ${order.orderNumber}`);
    
    order.addTimelineEvent('processing_complete', 'Order processing completed');
    
    const updatedOrder = await this.workflowService.emit({
      urn: order.id,
      event: OrderEvent.COMPLETE_PROCESSING,
      payload: payload
    });
    return await this.entityService.save(updatedOrder);
  }

  private async handleShipping(order: Order, payload: any): Promise<Order> {
    this.logger.log(`Shipping order ${order.orderNumber}`);
    
    // Generate tracking information
    const trackingInfo = await this.shippingService.createShipment(order);
    
    if (order.shipping) {
      order.shipping.trackingNumber = trackingInfo.trackingNumber;
      order.shipping.carrier = trackingInfo.carrier;
      order.shipping.shippedAt = new Date();
      const deliveryDays = order.getEstimatedDeliveryDays();
      order.shipping.estimatedDelivery = new Date(
        Date.now() + deliveryDays * 24 * 60 * 60 * 1000
      );
    }
    
    order.addTimelineEvent('order_shipped', `Order shipped via ${trackingInfo.carrier}`, {
      trackingNumber: trackingInfo.trackingNumber,
      estimatedDelivery: order.shipping?.estimatedDelivery
    });
    
    const updatedOrder = await this.workflowService.emit({
      urn: order.id,
      event: OrderEvent.SHIP,
      payload: payload
    });
    return await this.entityService.save(updatedOrder);
  }

  private async handleOutForDelivery(order: Order, payload: any): Promise<Order> {
    this.logger.log(`Order ${order.orderNumber} out for delivery`);
    
    order.addTimelineEvent('out_for_delivery', 'Order is out for delivery');
    
    const updatedOrder = await this.workflowService.emit({
      urn: order.id,
      event: OrderEvent.OUT_FOR_DELIVERY,
      payload: payload
    });
    return await this.entityService.save(updatedOrder);
  }

  private async handleDelivery(order: Order, payload: any): Promise<Order> {
    this.logger.log(`Order ${order.orderNumber} delivered`);
    
    if (order.shipping) {
      order.shipping.actualDelivery = new Date();
    }
    
    order.addTimelineEvent('order_delivered', 'Order successfully delivered');
    
    const updatedOrder = await this.workflowService.emit({
      urn: order.id,
      event: OrderEvent.DELIVER,
      payload: payload
    });
    return await this.entityService.save(updatedOrder);
  }

  private async handleCancellation(order: Order, payload: any): Promise<Order> {
    this.logger.log(`Cancelling order ${order.orderNumber}: ${payload?.cancellationReason}`);
    
    // Release inventory if reserved
    if (payload?.inventoryReserved) {
      await this.inventoryService.releaseItems(order.items);
    }
    
    // Process refund if payment was made
    if (order.payment?.status === 'success') {
      await this.paymentService.refund(order);
    }
    
    order.addTimelineEvent('order_cancelled', 'Order has been cancelled', {
      reason: payload?.cancellationReason
    });
    
    const updatedOrder = await this.workflowService.emit({
      urn: order.id,
      event: OrderEvent.CANCEL,
      payload: payload
    });
    return await this.entityService.save(updatedOrder);
  }

  private async handleRefund(order: Order, payload: any): Promise<Order> {
    this.logger.log(`Processing refund for order ${order.orderNumber}`);
    
    const refundAmount = payload?.refundAmount || order.total;
    await this.paymentService.refund(order, refundAmount);
    
    if (order.payment) {
      order.payment.status = 'refunded';
    }
    
    order.addTimelineEvent('order_refunded', `Refund processed for $${refundAmount}`, {
      amount: refundAmount
    });
    
    const updatedOrder = await this.workflowService.emit({
      urn: order.id,
      event: OrderEvent.PROCESS_REFUND,
      payload: payload
    });
    return await this.entityService.save(updatedOrder);
  }

  private async handleReturn(order: Order, payload: any): Promise<Order> {
    this.logger.log(`Processing return for order ${order.orderNumber}`);
    
    order.addTimelineEvent('return_initiated', 'Return process started', {
      reason: payload?.returnReason
    });
    
    const updatedOrder = await this.workflowService.emit({
      urn: order.id,
      event: OrderEvent.INITIATE_RETURN,
      payload: payload
    });
    return await this.entityService.save(updatedOrder);
  }

  // Query methods
  async getOrder(orderId: string): Promise<Order | null> {
    return await this.entityService.findById(orderId);
  }

  async getOrdersByStatus(status: OrderStatus): Promise<Order[]> {
    return await this.entityService.findByStatus(status);
  }

  async getCustomerOrders(customerId: string): Promise<Order[]> {
    return await this.entityService.findByCustomer(customerId);
  }

  async getAllOrders(): Promise<Order[]> {
    return await this.entityService.findAll();
  }
}