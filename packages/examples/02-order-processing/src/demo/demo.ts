import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { OrderService } from '../order.service';
import { Order, OrderEvent, OrderStatus, OrderItem, PaymentMethod, ShippingMethod } from '../order.entity';
import { BaseInteractiveDemo, DemoUtils } from '../../../demo';
import { orderWorkflowDefinition } from '../order.workflow';
import * as chalk from 'chalk';
import { OrderProcessingVisualizer } from './demo.visualizer';

class InteractiveOrderDemo extends BaseInteractiveDemo<Order, OrderEvent, OrderStatus> {
  private orderService: OrderService;
  private visualizer: OrderProcessingVisualizer<Order, any, OrderEvent, OrderStatus>;

  constructor(orderService: OrderService) {
    super();
    this.orderService = orderService;
    this.visualizer = new OrderProcessingVisualizer(orderWorkflowDefinition);
    this.currentEntity = null;
  }

  protected async showVisualization(): Promise<void> {
    this.clearScreen();
    
    // Generate right column content
    const rightContent: string[] = [];
    
    if (this.currentEntity) {
      rightContent.push(chalk.bold.yellow('CURRENT ORDER'));
      rightContent.push(chalk.dim('─'.repeat(40)));
      rightContent.push('');
      rightContent.push(chalk.white('Order #: ') + chalk.cyan(this.currentEntity.orderNumber));
      rightContent.push(chalk.white('Customer: ') + chalk.cyan(this.currentEntity.customerName));
      rightContent.push(chalk.white('Status: ') + this.getStatusColor(this.currentEntity.status));
      rightContent.push('');
      
      // Order details
      rightContent.push(chalk.white('Items: ') + chalk.cyan(this.currentEntity.items.length + ' items'));
      rightContent.push(chalk.white('Subtotal: ') + chalk.green('$' + this.currentEntity.subtotal.toFixed(2)));
      rightContent.push(chalk.white('Tax: ') + chalk.green('$' + this.currentEntity.tax.toFixed(2)));
      rightContent.push(chalk.white('Shipping: ') + chalk.green('$' + this.currentEntity.shippingCost.toFixed(2)));
      rightContent.push(chalk.white('Total: ') + chalk.bold.green('$' + this.currentEntity.total.toFixed(2)));
      rightContent.push('');
      
      // Payment info
      if (this.currentEntity.payment) {
        rightContent.push(chalk.white('Payment: ') + 
          this.getPaymentStatusColor(this.currentEntity.payment.status) + ' ' +
          chalk.gray('(' + this.currentEntity.payment.method + ')'));
        
        if (this.currentEntity.payment.transactionId) {
          rightContent.push(chalk.white('Transaction: ') + chalk.gray(this.currentEntity.payment.transactionId.substring(0, 16) + '...'));
        }
      }
      
      // Shipping info
      if (this.currentEntity.shipping?.trackingNumber) {
        rightContent.push(chalk.white('Tracking: ') + chalk.blue(this.currentEntity.shipping.trackingNumber));
        rightContent.push(chalk.white('Carrier: ') + chalk.cyan(this.currentEntity.shipping.carrier));
      }
      
      rightContent.push('');
      rightContent.push(chalk.dim('─'.repeat(40)));
      rightContent.push('');
      
      // Available actions
      rightContent.push(chalk.bold.yellow('AVAILABLE ACTIONS'));
      rightContent.push('');
      
      const events = this.getAvailableEvents();
      if (events.length > 0) {
        events.forEach((event, index) => {
          rightContent.push(chalk.cyan(`${index + 1}. `) + chalk.white(this.getEventDescription(event)));
        });
      } else {
        rightContent.push(chalk.gray('No actions available in current state'));
      }
      
      // Show recent timeline
      if (this.currentEntity.timeline.length > 0) {
        rightContent.push('');
        rightContent.push(chalk.dim('─'.repeat(40)));
        rightContent.push('');
        rightContent.push(chalk.bold.yellow('RECENT ACTIVITY'));
        rightContent.push('');
        
        const recentEvents = this.currentEntity.timeline.slice(-3);
        recentEvents.forEach(event => {
          const time = new Date(event.timestamp).toLocaleTimeString();
          rightContent.push(chalk.gray(time) + ' ' + chalk.white(event.description));
        });
      }
    } else {
      rightContent.push(chalk.gray('No order created yet'));
      rightContent.push('');
      rightContent.push('Press ' + chalk.cyan('n') + ' to create a new order');
    }
    
    // Use two-column visualization
    const visualization = this.visualizer.visualizeTwoColumn(this.currentEntity?.status, rightContent);
    console.log(visualization);
  }

  protected printEntityInfo(): void {
    console.log('\n' + chalk.bold.yellow('Order Information:'));
    DemoUtils.printDivider();
    console.log(chalk.white('  Order #: ') + chalk.cyan(this.currentEntity.orderNumber));
    console.log(chalk.white('  Customer: ') + chalk.cyan(this.currentEntity.customerName));
    console.log(chalk.white('  Status: ') + this.getStatusColor(this.currentEntity.status));
    console.log(chalk.white('  Total: ') + chalk.bold.green('$' + this.currentEntity.total.toFixed(2)));
    DemoUtils.printDivider();
  }

  protected getStatusColor(status: string): string {
    switch (status) {
      case OrderStatus.CREATED:
        return chalk.gray('CREATED');
      case OrderStatus.PAYMENT_PENDING:
        return chalk.yellow('PAYMENT PENDING');
      case OrderStatus.PAYMENT_FAILED:
        return chalk.red('PAYMENT FAILED');
      case OrderStatus.PAID:
        return chalk.green('PAID');
      case OrderStatus.PROCESSING:
        return chalk.blue('PROCESSING');
      case OrderStatus.READY_TO_SHIP:
        return chalk.cyan('READY TO SHIP');
      case OrderStatus.SHIPPED:
        return chalk.magenta('SHIPPED');
      case OrderStatus.OUT_FOR_DELIVERY:
        return chalk.magentaBright('OUT FOR DELIVERY');
      case OrderStatus.DELIVERED:
        return chalk.bold.green('DELIVERED');
      case OrderStatus.CANCELLED:
        return chalk.red('CANCELLED');
      case OrderStatus.REFUNDED:
        return chalk.yellow('REFUNDED');
      case OrderStatus.RETURNED:
        return chalk.blue('RETURNED');
      default:
        return chalk.white(status);
    }
  }

  private getPaymentStatusColor(status: string): string {
    switch (status) {
      case 'success':
        return chalk.green('✓ Success');
      case 'failed':
        return chalk.red('✗ Failed');
      case 'pending':
        return chalk.yellow('⏳ Pending');
      case 'refunded':
        return chalk.blue('↺ Refunded');
      default:
        return chalk.white(status);
    }
  }

  protected async showMenu(): Promise<string> {
    console.log('');
    console.log(chalk.dim('═'.repeat(120)));
    console.log(chalk.bold.yellow('MENU OPTIONS:'));
    
    const menuItems: string[] = [];
    
    if (this.currentEntity) {
      const events = this.getAvailableEvents();
      events.forEach((event, index) => {
        menuItems.push(chalk.cyan(`${index + 1}`) + ' ' + this.getEventDescription(event));
      });
    }
    
    menuItems.push(chalk.cyan('v') + ' Full visualization');
    menuItems.push(chalk.cyan('c') + ' Compact view');
    menuItems.push(chalk.cyan('t') + ' Transition table');
    menuItems.push(chalk.cyan('n') + ' New order');
    menuItems.push(chalk.cyan('s') + ' Run scenario');
    menuItems.push(chalk.cyan('h') + ' Order history');
    menuItems.push(chalk.cyan('q') + ' Quit');
    
    // Display menu items in columns
    const itemsPerRow = 3;
    const columnWidth = 40;
    
    for (let i = 0; i < menuItems.length; i += itemsPerRow) {
      let row = '';
      for (let j = 0; j < itemsPerRow && i + j < menuItems.length; j++) {
        const item = menuItems[i + j];
        const padding = columnWidth - this.stripAnsi(item).length;
        row += item + ' '.repeat(Math.max(0, padding));
      }
      console.log('  ' + row);
    }
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise<string>((resolve) => {
      rl.question('\n' + chalk.cyan('Select option: '), (answer: string) => {
        rl.close();
        resolve(answer);
      });
    });
  }
  
  private stripAnsi(str: string): string {
    return str.replace(/\u001b\[[0-9;]*m/g, '');
  }

  protected getAvailableEvents(): OrderEvent[] {
    if (!this.currentEntity) return [];
    
    const currentStatus = this.currentEntity.status;
    const statusEvents: { [key: string]: OrderEvent[] } = {
      [OrderStatus.CREATED]: [OrderEvent.INITIATE_PAYMENT, OrderEvent.CANCEL],
      [OrderStatus.PAYMENT_PENDING]: [OrderEvent.PAYMENT_SUCCESS, OrderEvent.PAYMENT_FAILED, OrderEvent.CANCEL],
      [OrderStatus.PAYMENT_FAILED]: [OrderEvent.RETRY_PAYMENT, OrderEvent.CANCEL],
      [OrderStatus.PAID]: [OrderEvent.START_PROCESSING, OrderEvent.CANCEL, OrderEvent.PROCESS_REFUND],
      [OrderStatus.PROCESSING]: [OrderEvent.COMPLETE_PROCESSING, OrderEvent.CANCEL, OrderEvent.PROCESS_REFUND],
      [OrderStatus.READY_TO_SHIP]: [OrderEvent.SHIP, OrderEvent.PROCESS_REFUND],
      [OrderStatus.SHIPPED]: [OrderEvent.OUT_FOR_DELIVERY],
      [OrderStatus.OUT_FOR_DELIVERY]: [OrderEvent.DELIVER],
      [OrderStatus.DELIVERED]: [OrderEvent.INITIATE_RETURN, OrderEvent.PROCESS_REFUND],
      [OrderStatus.RETURNED]: [OrderEvent.COMPLETE_RETURN],
    };
    
    return statusEvents[currentStatus] || [];
  }

  protected getEventDescription(event: OrderEvent): string {
    const descriptions: { [key: string]: string } = {
      [OrderEvent.INITIATE_PAYMENT]: 'Initiate payment',
      [OrderEvent.PAYMENT_SUCCESS]: 'Payment successful',
      [OrderEvent.PAYMENT_FAILED]: 'Payment failed',
      [OrderEvent.RETRY_PAYMENT]: 'Retry payment',
      [OrderEvent.START_PROCESSING]: 'Start processing',
      [OrderEvent.COMPLETE_PROCESSING]: 'Complete processing',
      [OrderEvent.SHIP]: 'Ship order',
      [OrderEvent.OUT_FOR_DELIVERY]: 'Out for delivery',
      [OrderEvent.DELIVER]: 'Mark as delivered',
      [OrderEvent.CANCEL]: 'Cancel order',
      [OrderEvent.PROCESS_REFUND]: 'Process refund',
      [OrderEvent.INITIATE_RETURN]: 'Initiate return',
      [OrderEvent.COMPLETE_RETURN]: 'Complete return',
    };
    
    return descriptions[event] || event;
  }

  protected async processEvent(event: OrderEvent): Promise<void> {
    console.log('\n' + chalk.yellow('Processing: ') + chalk.white(this.getEventDescription(event)));
    
    const payload = this.generatePayload(event);
    
    try {
      const previousStatus = this.currentEntity.status;
      
      if (payload) {
        console.log(chalk.dim('  Payload: ') + chalk.gray(DemoUtils.formatJson(payload)));
      }
      
      this.currentEntity = await this.orderService.processWorkflowEvent(
        this.currentEntity.id,
        event,
        payload
      );
      
      if (this.currentEntity.status !== previousStatus) {
        this.history.push(this.currentEntity.status);
        console.log(chalk.green('✓ Transition successful: ') + 
          this.getStatusColor(previousStatus) + 
          chalk.white(' → ') + 
          this.getStatusColor(this.currentEntity.status));
      } else {
        console.log(chalk.yellow('⚠ No transition occurred'));
      }
      
      await this.delay(1500);
      
    } catch (error: any) {
      console.log(chalk.red('✗ Error: ') + chalk.red(error.message));
      await this.delay(2000);
    }
  }

  private generatePayload(event: OrderEvent): any {
    switch (event) {
      case OrderEvent.PAYMENT_SUCCESS:
        return { transactionId: `TXN-${Date.now()}` };
      case OrderEvent.PAYMENT_FAILED:
        return { failureReason: 'Card declined' };
      case OrderEvent.CANCEL:
        return { cancellationReason: 'Customer requested' };
      case OrderEvent.PROCESS_REFUND:
        return { refundAmount: this.currentEntity?.total };
      case OrderEvent.INITIATE_RETURN:
        return { returnReason: 'Product defect' };
      default:
        return {};
    }
  }

  protected async createNewEntity(): Promise<void> {
    console.log('\n' + chalk.bold.green('Creating new order...'));
    
    const items: OrderItem[] = this.generateRandomItems();
    
    const orderData = {
      customerId: `CUST-${Date.now()}`,
      customerEmail: `customer-${Date.now()}@example.com`,
      customerName: this.getRandomCustomerName(),
      items,
      shippingAddress: {
        street: '123 Main Street',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'USA',
        recipientName: 'John Doe',
        phoneNumber: '+1-555-0123'
      },
      shippingMethod: this.getRandomShippingMethod(),
      paymentMethod: this.getRandomPaymentMethod(),
      notes: 'Handle with care',
      specialInstructions: 'Leave at door if not home'
    };
    
    this.currentEntity = await this.orderService.createOrder(orderData);
    this.history = [OrderStatus.CREATED];
    
    console.log(chalk.green('✓ Order created successfully!'));
    console.log(chalk.white('  Order #: ') + chalk.cyan(this.currentEntity.orderNumber));
    console.log(chalk.white('  Total: ') + chalk.bold.green('$' + this.currentEntity.total.toFixed(2)));
    
    await this.delay(1500);
  }

  private generateRandomItems(): OrderItem[] {
    const products = [
      { id: 'LAPTOP-001', name: 'MacBook Pro 16"', price: 2499.99 },
      { id: 'PHONE-001', name: 'iPhone 15 Pro', price: 999.99 },
      { id: 'TABLET-001', name: 'iPad Air', price: 599.99 },
      { id: 'WATCH-001', name: 'Apple Watch Ultra', price: 799.99 },
      { id: 'HEADPHONES-001', name: 'AirPods Pro', price: 249.99 },
      { id: 'KEYBOARD-001', name: 'Magic Keyboard', price: 99.99 },
      { id: 'MOUSE-001', name: 'Magic Mouse', price: 79.99 },
      { id: 'MONITOR-001', name: '27" 4K Display', price: 1299.99 },
      { id: 'CHARGER-001', name: 'USB-C Charger', price: 49.99 },
      { id: 'CASE-001', name: 'iPhone Case', price: 39.99 }
    ];
    
    const numItems = 1 + Math.floor(Math.random() * 3);
    const selectedProducts = [];
    
    for (let i = 0; i < numItems; i++) {
      const product = products[Math.floor(Math.random() * products.length)];
      const quantity = 1 + Math.floor(Math.random() * 3);
      
      selectedProducts.push({
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice: product.price,
        subtotal: product.price * quantity
      });
    }
    
    return selectedProducts;
  }

  private getRandomCustomerName(): string {
    const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emma', 'James', 'Lisa'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
    
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    
    return `${firstName} ${lastName}`;
  }

  private getRandomShippingMethod(): ShippingMethod {
    const methods = [
      ShippingMethod.STANDARD,
      ShippingMethod.EXPRESS,
      ShippingMethod.OVERNIGHT
    ];
    return methods[Math.floor(Math.random() * methods.length)];
  }

  private getRandomPaymentMethod(): PaymentMethod {
    const methods = [
      PaymentMethod.CREDIT_CARD,
      PaymentMethod.DEBIT_CARD,
      PaymentMethod.PAYPAL
    ];
    return methods[Math.floor(Math.random() * methods.length)];
  }

  private async waitForInput(prompt: string): Promise<string> {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question(prompt, (answer: string) => {
        rl.close();
        resolve(answer);
      });
    });
  }
  
  protected async showHistory(): Promise<void> {
    this.clearScreen();
    this.printHeader('Order Timeline');
    
    if (this.currentEntity && this.currentEntity.timeline.length > 0) {
      console.log(chalk.bold('Order Timeline:'));
      console.log('');
      
      this.currentEntity.timeline.forEach(event => {
        const time = new Date(event.timestamp).toLocaleString();
        console.log(chalk.gray(time) + ' - ' + chalk.white(event.description));
        if (event.metadata) {
          console.log('  ' + chalk.dim(DemoUtils.formatJson(event.metadata)));
        }
      });
    } else {
      console.log(chalk.gray('No timeline events yet.'));
    }
    
    await this.waitForInput('\nPress Enter to continue...');
  }
  
  protected async showCompactView(): Promise<void> {
    this.clearScreen();
    this.printHeader('Order Processing Workflow - Compact View');
    
    const visualization = this.visualizer.visualizeCompact(this.currentEntity?.status);
    console.log(visualization);
    
    if (this.currentEntity) {
      this.printEntityInfo();
    }
    
    await this.waitForInput('\nPress Enter to continue...');
  }
  
  protected async showTransitionTable(): Promise<void> {
    this.clearScreen();
    this.printHeader('Order Processing Workflow - Transition Table');
    
    const table = this.visualizer.printTransitionTable();
    console.log(table);
    
    await this.waitForInput('\nPress Enter to continue...');
  }
  
  protected async handleInput(input: string): Promise<boolean> {
    // Handle numeric inputs for events
    const eventIndex = parseInt(input) - 1;
    const events = this.getAvailableEvents();
    
    if (!isNaN(eventIndex) && eventIndex >= 0 && eventIndex < events.length) {
      await this.processEvent(events[eventIndex]);
      return true;
    }
    
    // Handle other commands
    switch(input.toLowerCase()) {
      case 'v':
        await this.showVisualization();
        return true;
      case 'c':
        await this.showCompactView();
        return true;
      case 't':
        await this.showTransitionTable();
        return true;
      case 'n':
        await this.createNewEntity();
        return true;
      case 's':
        await this.runAutomatedScenario();
        return true;
      case 'h':
        await this.showHistory();
        return true;
      case 'q':
        return false;
      default:
        console.log(chalk.red('Invalid option. Please try again.'));
        await this.delay(1000);
        return true;
    }
  }
  
  public async run(): Promise<void> {
    this.clearScreen();
    this.printHeader('Order Processing Interactive Demo');
    
    console.log('\nWelcome to the Order Processing Workflow Demo!');
    console.log('This demo simulates an e-commerce order fulfillment system.\n');
    
    // Create initial order
    await this.createNewEntity();
    
    // Main loop
    let running = true;
    while (running) {
      await this.showVisualization();
      const input = await this.showMenu();
      running = await this.handleInput(input);
    }
    
    console.log('\nThank you for using the demo!');
  }
  
  public cleanup(): void {
    // Any cleanup if needed
  }
  
  protected async runAutomatedScenario(): Promise<void> {
    console.log('\n' + chalk.bold.yellow('Select scenario:'));
    console.log(chalk.cyan('1') + ' Happy path (successful delivery)');
    console.log(chalk.cyan('2') + ' Payment failure with retry');
    console.log(chalk.cyan('3') + ' Order cancellation');
    console.log(chalk.cyan('4') + ' Return and refund');
    
    const choice = await this.waitForInput('\nSelect scenario (1-4): ');
    
    switch(choice) {
      case '1':
        await this.runHappyPath();
        break;
      case '2':
        await this.runPaymentFailure();
        break;
      case '3':
        await this.runCancellation();
        break;
      case '4':
        await this.runReturnRefund();
        break;
      default:
        console.log(chalk.red('Invalid scenario'));
    }
    
    await this.delay(2000);
  }

  private async runHappyPath(): Promise<void> {
    console.log('\n' + chalk.bold.green('Running happy path scenario...'));
    await this.delay(1000);
    
    // Create new order if needed
    if (!this.currentEntity || this.currentEntity.status !== OrderStatus.CREATED) {
      await this.createNewEntity();
    }
    
    const steps = [
      { event: OrderEvent.INITIATE_PAYMENT, delay: 2000 },
      { event: OrderEvent.COMPLETE_PROCESSING, delay: 1500 },
      { event: OrderEvent.SHIP, delay: 1500 },
      { event: OrderEvent.OUT_FOR_DELIVERY, delay: 1500 },
      { event: OrderEvent.DELIVER, delay: 1000 }
    ];
    
    for (const step of steps) {
      await this.showVisualization();
      await this.delay(step.delay);
      
      if (this.getAvailableEvents().includes(step.event)) {
        await this.processEvent(step.event);
      }
    }
    
    console.log('\n' + chalk.bold.green('✓ Order successfully delivered!'));
  }

  private async runPaymentFailure(): Promise<void> {
    console.log('\n' + chalk.bold.yellow('Running payment failure scenario...'));
    await this.delay(1000);
    
    // Create new order if needed
    if (!this.currentEntity || this.currentEntity.status !== OrderStatus.CREATED) {
      await this.createNewEntity();
    }
    
    // First attempt fails
    await this.processEvent(OrderEvent.INITIATE_PAYMENT);
    await this.delay(2000);
    
    // Simulate payment failure
    if (this.currentEntity.status === OrderStatus.PAYMENT_PENDING) {
      await this.processEvent(OrderEvent.PAYMENT_FAILED);
      await this.delay(2000);
    }
    
    // Retry payment
    if (this.currentEntity.status === OrderStatus.PAYMENT_FAILED) {
      console.log(chalk.yellow('Retrying payment...'));
      await this.processEvent(OrderEvent.RETRY_PAYMENT);
      await this.delay(2000);
    }
    
    console.log('\n' + chalk.bold.yellow('Payment retry scenario completed'));
  }

  private async runCancellation(): Promise<void> {
    console.log('\n' + chalk.bold.red('Running cancellation scenario...'));
    await this.delay(1000);
    
    // Create new order if needed
    if (!this.currentEntity || this.currentEntity.status !== OrderStatus.CREATED) {
      await this.createNewEntity();
    }
    
    // Process payment first
    await this.processEvent(OrderEvent.INITIATE_PAYMENT);
    await this.delay(2000);
    
    // Cancel while processing
    if (this.getAvailableEvents().includes(OrderEvent.CANCEL)) {
      await this.processEvent(OrderEvent.CANCEL);
    }
    
    console.log('\n' + chalk.bold.red('Order cancelled'));
  }

  private async runReturnRefund(): Promise<void> {
    console.log('\n' + chalk.bold.blue('Running return and refund scenario...'));
    console.log(chalk.dim('This will run through delivery then process a return'));
    await this.delay(2000);
    
    // Run happy path first to get to delivered state
    await this.runHappyPath();
    await this.delay(2000);
    
    // Initiate return
    if (this.currentEntity.status === OrderStatus.DELIVERED) {
      console.log(chalk.blue('Customer initiating return...'));
      await this.processEvent(OrderEvent.INITIATE_RETURN);
      await this.delay(2000);
    }
    
    // Complete return and refund
    if (this.currentEntity.status === OrderStatus.RETURNED) {
      await this.processEvent(OrderEvent.COMPLETE_RETURN);
    }
    
    console.log('\n' + chalk.bold.blue('Return and refund processed'));
  }
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false // Disable NestJS logging for cleaner output
  });
  
  const orderService = app.get(OrderService);
  const demo = new InteractiveOrderDemo(orderService);
  
  try {
    await demo.run();
  } finally {
    demo.cleanup();
    await app.close();
    process.exit(0);
  }
}

bootstrap().catch(error => {
  console.error(chalk.red('Error running demo:'), error);
  process.exit(1);
});