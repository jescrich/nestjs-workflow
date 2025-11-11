import { WorkflowDefinition } from '@jescrich/nestjs-workflow';
import { Order, OrderStatus, OrderEvent } from './order.entity';
import { OrderEntityService } from './order.entity.service';

export interface OrderContext {
  paymentAttempts: number;
  maxPaymentAttempts: number;
  inventoryReserved: boolean;
  refundAmount?: number;
  returnReason?: string;
  cancellationReason?: string;
}

export const orderWorkflowDefinition: WorkflowDefinition<Order, OrderContext, OrderEvent, OrderStatus> = {
  name: 'OrderProcessingWorkflow',
  entity: OrderEntityService,
  states: {
    finals: [
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
      OrderStatus.REFUNDED,
      OrderStatus.RETURNED
    ],
    idles: [
      OrderStatus.CREATED,
      OrderStatus.PAYMENT_PENDING,
      OrderStatus.READY_TO_SHIP
    ],
    failed: OrderStatus.PAYMENT_FAILED
  },
  transitions: [
    // Payment flow
    {
      from: OrderStatus.CREATED,
      to: OrderStatus.PAYMENT_PENDING,
      event: OrderEvent.INITIATE_PAYMENT
    },
    {
      from: OrderStatus.PAYMENT_PENDING,
      to: OrderStatus.PAID,
      event: OrderEvent.PAYMENT_SUCCESS
    },
    {
      from: OrderStatus.PAYMENT_PENDING,
      to: OrderStatus.PAYMENT_FAILED,
      event: OrderEvent.PAYMENT_FAILED
    },
    {
      from: OrderStatus.PAYMENT_FAILED,
      to: OrderStatus.PAYMENT_PENDING,
      event: OrderEvent.RETRY_PAYMENT,
      conditions: [
        (order: Order, context: OrderContext) => {
          return context.paymentAttempts < context.maxPaymentAttempts;
        }
      ]
    },
    
    // Order processing flow
    {
      from: OrderStatus.PAID,
      to: OrderStatus.PROCESSING,
      event: OrderEvent.START_PROCESSING
    },
    {
      from: OrderStatus.PROCESSING,
      to: OrderStatus.READY_TO_SHIP,
      event: OrderEvent.COMPLETE_PROCESSING
    },
    
    // Shipping flow
    {
      from: OrderStatus.READY_TO_SHIP,
      to: OrderStatus.SHIPPED,
      event: OrderEvent.SHIP
    },
    {
      from: OrderStatus.SHIPPED,
      to: OrderStatus.OUT_FOR_DELIVERY,
      event: OrderEvent.OUT_FOR_DELIVERY
    },
    {
      from: OrderStatus.OUT_FOR_DELIVERY,
      to: OrderStatus.DELIVERED,
      event: OrderEvent.DELIVER
    },
    
    // Cancellation flow (can cancel from multiple states)
    {
      from: [
        OrderStatus.CREATED,
        OrderStatus.PAYMENT_PENDING,
        OrderStatus.PAYMENT_FAILED,
        OrderStatus.PAID,
        OrderStatus.PROCESSING
      ],
      to: OrderStatus.CANCELLED,
      event: OrderEvent.CANCEL
    },
    
    // Refund flow
    {
      from: [OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.READY_TO_SHIP],
      to: OrderStatus.REFUNDED,
      event: OrderEvent.PROCESS_REFUND
    },
    {
      from: OrderStatus.DELIVERED,
      to: OrderStatus.REFUNDED,
      event: OrderEvent.PROCESS_REFUND
    },
    
    // Return flow
    {
      from: OrderStatus.DELIVERED,
      to: OrderStatus.RETURNED,
      event: OrderEvent.INITIATE_RETURN
    },
    {
      from: OrderStatus.RETURNED,
      to: OrderStatus.REFUNDED,
      event: OrderEvent.COMPLETE_RETURN
    }
  ]
};