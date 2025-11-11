import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { OrderService } from '../order.service';
import { Order, OrderEvent, OrderStatus, PaymentMethod, ShippingMethod } from '../order.entity';
import { BaseDemoRunner, DemoScenario, DemoScenarioStep, DemoUtils } from '../../../demo';
import * as chalk from 'chalk';

class OrderDemoRunner extends BaseDemoRunner<Order, OrderEvent, OrderStatus> {
  private orderService: OrderService;

  constructor(orderService: OrderService) {
    super();
    this.orderService = orderService;
  }

  protected async processEvent(entityId: string, event: OrderEvent, payload?: any): Promise<Order> {
    try {
      return await this.orderService.processWorkflowEvent(entityId, event, payload);
    } catch (error: any) {
      console.log(chalk.red(`✗ Error: ${error.message}`));
      throw error;
    }
  }

  protected getStatusColor(status: string): string {
    const statusColors: { [key: string]: (text: string) => string } = {
      [OrderStatus.CREATED]: chalk.gray,
      [OrderStatus.PAYMENT_PENDING]: chalk.yellow,
      [OrderStatus.PAYMENT_FAILED]: chalk.red,
      [OrderStatus.PAID]: chalk.green,
      [OrderStatus.PROCESSING]: chalk.blue,
      [OrderStatus.READY_TO_SHIP]: chalk.cyan,
      [OrderStatus.SHIPPED]: chalk.magenta,
      [OrderStatus.OUT_FOR_DELIVERY]: chalk.magentaBright,
      [OrderStatus.DELIVERED]: chalk.bold.green,
      [OrderStatus.CANCELLED]: chalk.red,
      [OrderStatus.REFUNDED]: chalk.yellow,
      [OrderStatus.RETURNED]: chalk.blue
    };

    const colorFn = statusColors[status] || chalk.white;
    return colorFn(status.toUpperCase());
  }

  protected printEntityState(entity: Order): void {
    DemoUtils.printBox([
      `Order #: ${entity.orderNumber}`,
      `Status: ${this.getStatusColor(entity.status)}`,
      `Customer: ${entity.customerName}`,
      `Total: $${entity.total.toFixed(2)}`,
      entity.payment ? `Payment: ${entity.payment.status}` : '',
      entity.shipping?.trackingNumber ? `Tracking: ${entity.shipping.trackingNumber}` : ''
    ].filter(Boolean));
  }

  protected async createEntity(data?: any): Promise<Order> {
    console.log(chalk.blue('📦 Creating new order...'));
    
    const orderData = {
      customerId: `CUST-${Date.now()}`,
      customerEmail: `demo-${Date.now()}@example.com`,
      customerName: data?.customerName || 'John Doe',
      items: data?.items || [
        {
          productId: 'LAPTOP-001',
          productName: 'MacBook Pro 16"',
          quantity: 1,
          unitPrice: 2499.99,
          subtotal: 2499.99
        }
      ],
      shippingAddress: {
        street: '123 Demo Street',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'USA',
        recipientName: 'John Doe',
        phoneNumber: '+1-555-0123'
      },
      shippingMethod: data?.shippingMethod || ShippingMethod.STANDARD,
      paymentMethod: data?.paymentMethod || PaymentMethod.CREDIT_CARD,
      notes: 'Demo order',
      specialInstructions: data?.instructions
    };
    
    const order = await this.orderService.createOrder(orderData);
    this.printEntityState(order);
    return order;
  }

  async run(): Promise<void> {
    const scenarios = this.defineScenarios();
    await this.runAllScenarios(scenarios);
  }

  public defineScenarios(): DemoScenario<OrderEvent>[] {
    return [
      {
        name: 'Happy Path - Complete Order Fulfillment',
        description: 'Order successfully goes through payment, processing, shipping, and delivery',
        steps: [
          {
            description: 'Initiating payment',
            event: OrderEvent.INITIATE_PAYMENT
          },
          {
            description: 'Processing order items',
            event: OrderEvent.COMPLETE_PROCESSING
          },
          {
            description: 'Preparing for shipment',
            event: OrderEvent.SHIP
          },
          {
            description: 'Order out for delivery',
            event: OrderEvent.OUT_FOR_DELIVERY
          },
          {
            description: 'Order delivered successfully',
            event: OrderEvent.DELIVER
          }
        ]
      },
      
      {
        name: 'Payment Failure and Retry',
        description: 'Payment fails initially but succeeds on retry',
        steps: [
          {
            description: 'Initiating payment (will fail)',
            event: OrderEvent.INITIATE_PAYMENT
          },
          {
            description: 'Payment failed - retrying',
            event: OrderEvent.RETRY_PAYMENT,
            payload: { paymentAttempts: 1 }
          },
          {
            description: 'Second payment attempt',
            event: OrderEvent.PAYMENT_SUCCESS,
            payload: { transactionId: 'TXN-RETRY-123' }
          },
          {
            description: 'Processing after successful payment',
            event: OrderEvent.COMPLETE_PROCESSING
          }
        ]
      },
      
      {
        name: 'Order Cancellation Before Shipping',
        description: 'Customer cancels order after payment but before shipping',
        steps: [
          {
            description: 'Initiating payment',
            event: OrderEvent.INITIATE_PAYMENT
          },
          {
            description: 'Starting order processing',
            event: OrderEvent.START_PROCESSING
          },
          {
            description: 'Customer requests cancellation',
            event: OrderEvent.CANCEL,
            payload: { 
              cancellationReason: 'Customer changed mind',
              inventoryReserved: true
            }
          }
        ]
      },
      
      {
        name: 'Express Shipping with Quick Delivery',
        description: 'Order with express shipping for faster delivery',
        steps: [
          {
            description: 'Processing payment',
            event: OrderEvent.INITIATE_PAYMENT
          },
          {
            description: 'Fast-track processing',
            event: OrderEvent.COMPLETE_PROCESSING
          },
          {
            description: 'Express shipping initiated',
            event: OrderEvent.SHIP
          },
          {
            description: 'Out for express delivery',
            event: OrderEvent.OUT_FOR_DELIVERY
          },
          {
            description: 'Delivered within 2 days',
            event: OrderEvent.DELIVER
          }
        ]
      },
      
      {
        name: 'Return and Refund Process',
        description: 'Customer returns delivered item and receives refund',
        steps: [
          {
            description: 'Processing payment',
            event: OrderEvent.INITIATE_PAYMENT
          },
          {
            description: 'Processing order',
            event: OrderEvent.COMPLETE_PROCESSING
          },
          {
            description: 'Shipping order',
            event: OrderEvent.SHIP
          },
          {
            description: 'Out for delivery',
            event: OrderEvent.OUT_FOR_DELIVERY
          },
          {
            description: 'Order delivered',
            event: OrderEvent.DELIVER
          },
          {
            description: 'Customer initiates return',
            event: OrderEvent.INITIATE_RETURN,
            payload: { returnReason: 'Product not as described' }
          },
          {
            description: 'Return processed, refund issued',
            event: OrderEvent.COMPLETE_RETURN,
            payload: { refundAmount: 2499.99 }
          }
        ]
      },
      
      {
        name: 'Failed Payment with Cancellation',
        description: 'Payment fails multiple times, order gets cancelled',
        steps: [
          {
            description: 'First payment attempt',
            event: OrderEvent.INITIATE_PAYMENT
          },
          {
            description: 'Payment failed',
            event: OrderEvent.PAYMENT_FAILED,
            payload: { failureReason: 'Insufficient funds' }
          },
          {
            description: 'Retry payment',
            event: OrderEvent.RETRY_PAYMENT,
            payload: { paymentAttempts: 1 }
          },
          {
            description: 'Second payment also failed',
            event: OrderEvent.PAYMENT_FAILED,
            payload: { failureReason: 'Card declined' }
          },
          {
            description: 'Cancelling order due to payment issues',
            event: OrderEvent.CANCEL,
            payload: { cancellationReason: 'Payment failed after multiple attempts' }
          }
        ]
      },
      
      {
        name: 'Partial Refund After Shipping',
        description: 'Customer receives partial refund for damaged item',
        steps: [
          {
            description: 'Processing payment',
            event: OrderEvent.INITIATE_PAYMENT
          },
          {
            description: 'Processing order',
            event: OrderEvent.COMPLETE_PROCESSING
          },
          {
            description: 'Shipping order',
            event: OrderEvent.SHIP
          },
          {
            description: 'Customer reports damage, partial refund issued',
            event: OrderEvent.PROCESS_REFUND,
            payload: { 
              refundAmount: 500.00,
              reason: 'Item arrived with minor damage - partial refund'
            }
          }
        ]
      }
    ];
  }
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false
  });
  
  const orderService = app.get(OrderService);
  const runner = new OrderDemoRunner(orderService);
  
  try {
    await runner.run();
  } finally {
    await app.close();
    process.exit(0);
  }
}

bootstrap().catch(error => {
  console.error(chalk.red('Error running demo:'), error);
  process.exit(1);
});