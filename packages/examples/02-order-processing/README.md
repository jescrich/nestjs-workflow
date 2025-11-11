# Order Processing Workflow Example

This example demonstrates a comprehensive e-commerce order processing workflow using `@jescrich/nestjs-workflow`. It showcases how to manage the complete lifecycle of an order from creation through payment, fulfillment, and delivery.

## Features

- **Complete Order Lifecycle**: Manages orders from creation to delivery
- **Payment Processing**: Handles payment attempts, failures, and retries
- **Inventory Management**: Reserves and releases inventory based on order status
- **Shipping Integration**: Tracks shipping status and delivery
- **Cancellation & Refunds**: Supports order cancellation and refund processing
- **Returns Management**: Handles product returns and associated refunds

## Workflow States

The order workflow includes the following states:

1. **CREATED** - Initial state when order is placed
2. **PAYMENT_PENDING** - Awaiting payment processing
3. **PAYMENT_FAILED** - Payment was declined or failed
4. **PAID** - Payment successfully processed
5. **PROCESSING** - Order is being prepared
6. **READY_TO_SHIP** - Order packed and ready for shipment
7. **SHIPPED** - Order has been shipped
8. **OUT_FOR_DELIVERY** - Order is with delivery service
9. **DELIVERED** - Order successfully delivered
10. **CANCELLED** - Order was cancelled
11. **REFUNDED** - Payment has been refunded
12. **RETURNED** - Product has been returned

## Installation

```bash
cd examples/03-order-processing
npm install
```

## Running the Examples

### Interactive Demo
Experience the workflow interactively with visualization:
```bash
npm run demo
```

The interactive demo allows you to:
- Create new orders
- Process workflow events manually
- View workflow visualization
- See order status and timeline
- Run automated scenarios

### Automated Scenarios
Run all predefined scenarios:
```bash
npm run demo:all
```

Scenarios include:
- Happy path (successful delivery)
- Payment failure with retry
- Order cancellation
- Express shipping
- Returns and refunds
- Partial refunds

### API Server
Start the REST API server:
```bash
npm start
```

The API runs on http://localhost:3001

## API Endpoints

- `POST /orders` - Create a new order
- `GET /orders` - Get all orders
- `GET /orders/:id` - Get order by ID
- `GET /orders/customer/:customerId` - Get customer's orders
- `PUT /orders/:id/event` - Process workflow event
- `POST /orders/:id/pay` - Initiate payment
- `POST /orders/:id/cancel` - Cancel order
- `POST /orders/:id/ship` - Ship order
- `POST /orders/:id/deliver` - Mark as delivered
- `POST /orders/:id/refund` - Process refund

## Project Structure

```
03-order-processing/
├── src/
│   ├── demo/
│   │   ├── demo.ts              # Interactive demo
│   │   ├── demo.runner.ts       # Automated scenarios
│   │   └── demo.visualizer.ts   # Workflow visualization
│   ├── services/
│   │   ├── payment.service.ts   # Payment processing
│   │   ├── inventory.service.ts # Inventory management
│   │   └── shipping.service.ts  # Shipping operations
│   ├── order.entity.ts          # Order entity and enums
│   ├── order.workflow.ts        # Workflow definition
│   ├── order.service.ts         # Order service with workflow
│   ├── order.controller.ts      # REST API controller
│   ├── order.module.ts          # NestJS module
│   └── main.ts                  # Application entry point
└── package.json
```

## Key Concepts Demonstrated

### 1. Auto-transitions
When payment succeeds, the order automatically transitions to processing:
```typescript
[OrderStatus.PAID]: async (order: Order) => {
  // Auto-transition to processing
  return { event: OrderEvent.START_PROCESSING };
}
```

### 2. Conditional Transitions
Payment retry is only allowed if attempts are below the maximum:
```typescript
{
  from: OrderStatus.PAYMENT_FAILED,
  to: OrderStatus.PAYMENT_PENDING,
  event: OrderEvent.RETRY_PAYMENT,
  condition: async (order, context) => {
    return context.paymentAttempts < context.maxPaymentAttempts;
  }
}
```

### 3. Multiple Source States
Orders can be cancelled from various states:
```typescript
{
  from: [
    OrderStatus.CREATED,
    OrderStatus.PAYMENT_PENDING,
    OrderStatus.PAID,
    OrderStatus.PROCESSING
  ],
  to: OrderStatus.CANCELLED,
  event: OrderEvent.CANCEL
}
```

### 4. State Actions
Actions are executed on state entry/exit:
```typescript
onEnter: {
  [OrderStatus.SHIPPED]: async (order) => {
    order.shipping.shippedAt = new Date();
    order.addTimelineEvent('order_shipped', 'Order shipped');
  }
}
```

## Extending the Example

You can extend this example by:

1. **Adding new payment methods**: Extend `PaymentMethod` enum and update payment service
2. **Custom shipping carriers**: Add carrier-specific logic in shipping service
3. **Inventory strategies**: Implement different inventory reservation strategies
4. **Email notifications**: Add email service to notify customers on status changes
5. **Webhook integrations**: Add webhooks for external system notifications
6. **Analytics tracking**: Track metrics for each state transition

## Testing Scenarios

The demo includes several test scenarios:

1. **Happy Path**: Order → Payment → Processing → Shipping → Delivery
2. **Payment Retry**: Failed payment → Retry → Success
3. **Cancellation**: Order → Payment → Cancel (with refund)
4. **Returns**: Delivered → Return → Refund
5. **Partial Refund**: Shipping damage → Partial refund

## Notes

- Payment success rates vary by payment method (configurable in PaymentService)
- Inventory is automatically reserved during processing and released on cancellation
- Shipping estimates are calculated based on shipping method
- All state transitions are logged in the order timeline

## License

MIT