import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { InventoryService } from '../inventory.service';
import { InventoryItem, InventoryStatus, InventoryEvent, StockReceivedPayload, StockAllocatedPayload, StockReleasedPayload, StockAdjustedPayload, AuditRequestedPayload } from '../inventory.entity';
import { InventoryWorkflowVisualizer } from './demo.visualizer';
import chalk from 'chalk';
import inquirer from 'inquirer';
import clear from 'clear';
import figlet from 'figlet';

class InventoryKafkaDemo {
  private kafkaProducer: KafkaProducerService;
  private inventoryService: InventoryService;
  private visualizer: InventoryWorkflowVisualizer;

  constructor(kafkaProducer: KafkaProducerService, inventoryService: InventoryService) {
    this.kafkaProducer = kafkaProducer;
    this.inventoryService = inventoryService;
    this.visualizer = new InventoryWorkflowVisualizer();
  }

  private printHeader() {
    console.log(chalk.cyan('═'.repeat(120)));
    console.log(chalk.cyan.bold(figlet.textSync('Kafka Inventory', { font: 'Small' })));
    console.log(chalk.cyan('═'.repeat(120)));
    console.log();
    console.log(chalk.yellow('This demo shows Kafka-driven inventory workflow management.'));
    console.log(chalk.yellow('Events published to Kafka are automatically consumed by the WorkflowModule.'));
    console.log();
  }

  private async showKafkaStatus() {
    console.log(chalk.cyan('KAFKA CONNECTION STATUS:'));
    if (this.kafkaProducer.isConnected()) {
      console.log(chalk.green('✓ Kafka producer connected on localhost:9093'));
      console.log(chalk.green('✓ WorkflowModule consuming Kafka events automatically'));
      console.log(chalk.gray('  Topics: inventory.stock.received, inventory.stock.allocated, inventory.stock.released'));
      console.log(chalk.gray('          inventory.stock.adjusted, inventory.audit.requested, inventory.reorder.triggered'));
    } else {
      console.log(chalk.yellow('⚠️  Kafka not available - demo will run without Kafka events'));
      console.log(chalk.gray('  Run "npm run kafka:up" to start Kafka'));
    }
    console.log();
  }

  private async displayInventory() {
    const items = await this.inventoryService.getAllInventory();
    
    if (items.length === 0) {
      console.log(chalk.gray('No inventory items yet. Create one using option 1.'));
      return;
    }

    console.log(chalk.cyan('CURRENT INVENTORY:'));
    console.log('─'.repeat(100));
    
    const headers = ['SKU', 'Product', 'Status', 'Qty', 'Available', 'Reserved', 'Location', 'Value'];
    console.log(
      chalk.bold(
        headers[0].padEnd(15) +
        headers[1].padEnd(20) +
        headers[2].padEnd(15) +
        headers[3].padEnd(8) +
        headers[4].padEnd(10) +
        headers[5].padEnd(10) +
        headers[6].padEnd(12) +
        headers[7].padEnd(10)
      )
    );
    console.log('─'.repeat(100));

    for (const item of items) {
      const statusColor = this.getStatusColor(item.status);
      console.log(
        item.sku.padEnd(15) +
        item.productName.substring(0, 19).padEnd(20) +
        statusColor(item.status.padEnd(15)) +
        String(item.quantity).padEnd(8) +
        String(item.availableQuantity).padEnd(10) +
        String(item.reservedQuantity).padEnd(10) +
        `${item.location.warehouse}-${item.location.zone}`.padEnd(12) +
        `$${item.totalValue.toFixed(2)}`.padEnd(10)
      );
    }
    console.log('─'.repeat(100));
    
    const totalValue = items.reduce((sum, item) => sum + item.totalValue, 0);
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    console.log(chalk.bold(`Total: ${items.length} SKUs, ${totalQuantity} units, $${totalValue.toFixed(2)}`));
    console.log();
  }

  private getStatusColor(status: InventoryStatus): (text: string) => string {
    const colors = {
      [InventoryStatus.AVAILABLE]: chalk.green,
      [InventoryStatus.RESERVED]: chalk.yellow,
      [InventoryStatus.ALLOCATED]: chalk.blue,
      [InventoryStatus.IN_TRANSIT]: chalk.cyan,
      [InventoryStatus.RECEIVING]: chalk.magenta,
      [InventoryStatus.QUARANTINE]: chalk.red,
      [InventoryStatus.DAMAGED]: chalk.red.bold,
      [InventoryStatus.EXPIRED]: chalk.gray,
      [InventoryStatus.AUDITING]: chalk.yellow.bold,
      [InventoryStatus.REORDER_PENDING]: chalk.magentaBright,
      [InventoryStatus.REORDERED]: chalk.greenBright
    };
    return colors[status] || chalk.white;
  }

  private async publishKafkaEvent(topic: string, payload: any, description: string) {
    console.log(chalk.yellow(`\n📨 Publishing Kafka Event to ${topic}`));
    console.log(chalk.gray(JSON.stringify(payload, null, 2)));
    
    if (!this.kafkaProducer.isConnected()) {
      console.log(chalk.yellow('⚠️  Kafka not connected - simulating event locally'));
      // Could still process locally if needed
      return;
    }

    try {
      // Publish to Kafka - the WorkflowModule will automatically consume and process
      switch (topic) {
        case 'inventory.stock.received':
          await this.kafkaProducer.publishStockReceived(payload);
          break;
        case 'inventory.stock.allocated':
          await this.kafkaProducer.publishStockAllocated(payload);
          break;
        case 'inventory.stock.released':
          await this.kafkaProducer.publishStockReleased(payload);
          break;
        case 'inventory.stock.adjusted':
          await this.kafkaProducer.publishStockAdjusted(payload);
          break;
        case 'inventory.audit.requested':
          await this.kafkaProducer.publishAuditRequested(payload);
          break;
      }
      
      console.log(chalk.green(`✓ Event published: ${description}`));
      console.log(chalk.gray('  WorkflowModule will consume and process this event automatically'));
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Show updated inventory
      const item = await this.inventoryService.getInventoryBySku(payload.sku);
      if (item) {
        console.log(chalk.cyan(`\n📦 Updated Item State (after Kafka processing):`));
        console.log(`  SKU: ${item.sku}`);
        console.log(`  Status: ${this.getStatusColor(item.status)(item.status)}`);
        console.log(`  Quantity: ${item.quantity} (Available: ${item.availableQuantity}, Reserved: ${item.reservedQuantity})`);
        
        if (item.movements.length > 0) {
          const lastMovement = item.movements[item.movements.length - 1];
          console.log(`  Last Movement: ${lastMovement.type} ${lastMovement.quantity} - ${lastMovement.reason}`);
        }
      }
    } catch (error: any) {
      console.log(chalk.red(`✗ Error: ${error.message}`));
    }
  }

  async showMenu(): Promise<boolean> {
    console.log();
    console.log(chalk.cyan('MENU OPTIONS:'));
    console.log('─'.repeat(60));
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Select action:',
        choices: [
          { name: '1. ➕ Add Inventory Item (Simple)', value: 'add' },
          { name: '2. 📦 Receive Stock (Workflow Event)', value: '1' },
          { name: '3. 🏷️  Reserve Stock', value: 'reserve' },
          { name: '4. 🚚 Ship Inventory', value: 'ship' },
          { name: '5. 🔍 Request Audit', value: 'audit' },
          { name: '6. 🎬 Run Demo Scenario', value: '6' },
          { name: '7. 📊 Show Workflow Diagram', value: '7' },
          { name: '8. 📈 Show Warehouse Stats', value: '8' },
          { name: '9. 🗑️  Clear All Inventory', value: '10' },
          { name: '─────────────────', value: null, disabled: true },
          { name: '0. Exit', value: '0' }
        ]
      }
    ]);

    switch (action) {
      case 'add':
        await this.addInventoryItem();
        break;
      case '1':
        await this.receiveStock();
        break;
      case 'reserve':
        await this.reserveStockSimple();
        break;
      case 'ship':
        await this.shipInventorySimple();
        break;
      case 'audit':
        await this.requestAuditSimple();
        break;
      case '6':
        await this.runSimpleDemoScenario();
        break;
      case '7':
        await this.showWorkflowDiagram();
        break;
      case '8':
        await this.showWarehouseStats();
        break;
      case '10':
        await this.clearInventory();
        break;
      case '0':
        return false;
    }

    return true;
  }

  private async addInventoryItem() {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'sku',
        message: 'SKU:',
        default: `SKU-${Date.now().toString().slice(-6)}`
      },
      {
        type: 'input',
        name: 'productName',
        message: 'Product Name:',
        default: 'Laptop Computer'
      },
      {
        type: 'number',
        name: 'quantity',
        message: 'Initial Quantity:',
        default: 100
      },
      {
        type: 'number',
        name: 'unitCost',
        message: 'Unit Cost:',
        default: 499.99
      }
    ]);

    // Create the item with initial quantity
    const item = await this.inventoryService.createInventoryItem({
      sku: answers.sku,
      productName: answers.productName,
      location: {
        warehouse: 'WH-001',
        zone: 'A',
        shelf: '1',
        bin: 'A1'
      },
      unitCost: answers.unitCost,
      reorderPoint: 20,
      reorderQuantity: 100,
      supplier: 'Tech Supplier Co.'
    });

    // Process initial stock
    await this.inventoryService.processStockReceived(item, answers.quantity);
    
    // Transition to available
    const workflowService = (this.inventoryService as any).workflowService;
    await workflowService.emit({
      urn: item.id,
      event: InventoryEvent.STOCK_RECEIVED,
      payload: { quantity: answers.quantity }
    });
    
    console.log(chalk.green(`✓ Created inventory item: ${answers.sku} with ${answers.quantity} units`));
  }

  private async reserveStockSimple() {
    const items = await this.inventoryService.getAllInventory();
    const availableItems = items.filter(i => i.availableQuantity > 0);
    
    if (availableItems.length === 0) {
      console.log(chalk.red('No items with available stock.'));
      return;
    }

    const { sku, quantity } = await inquirer.prompt([
      {
        type: 'list',
        name: 'sku',
        message: 'Select SKU:',
        choices: availableItems.map(i => ({
          name: `${i.sku} (Available: ${i.availableQuantity})`,
          value: i.sku
        }))
      },
      {
        type: 'number',
        name: 'quantity',
        message: 'Quantity to reserve:',
        default: 10
      }
    ]);

    try {
      await this.inventoryService.reserveStock(sku, quantity);
      console.log(chalk.green(`✓ Reserved ${quantity} units of ${sku}`));
    } catch (error: any) {
      console.log(chalk.red(`✗ Error: ${error.message}`));
    }
  }

  private async shipInventorySimple() {
    const items = await this.inventoryService.getAllInventory();
    const allocatedItems = items.filter(i => i.status === InventoryStatus.ALLOCATED);
    
    if (allocatedItems.length === 0) {
      console.log(chalk.red('No items in allocated status. Reserve and allocate items first.'));
      return;
    }

    const { sku } = await inquirer.prompt([
      {
        type: 'list',
        name: 'sku',
        message: 'Select SKU to ship:',
        choices: allocatedItems.map(i => i.sku)
      }
    ]);

    try {
      await this.inventoryService.shipInventory(sku);
      console.log(chalk.green(`✓ Shipped ${sku}`));
    } catch (error: any) {
      console.log(chalk.red(`✗ Error: ${error.message}`));
    }
  }

  private async requestAuditSimple() {
    const items = await this.inventoryService.getAllInventory();
    
    if (items.length === 0) {
      console.log(chalk.red('No inventory items.'));
      return;
    }

    const { sku } = await inquirer.prompt([
      {
        type: 'list',
        name: 'sku',
        message: 'Select SKU to audit:',
        choices: items.map(i => ({
          name: `${i.sku} (Qty: ${i.quantity}, Status: ${i.status})`,
          value: i.sku
        }))
      }
    ]);

    const item = await this.inventoryService.getInventoryBySku(sku);
    if (!item) return;

    const workflowService = (this.inventoryService as any).workflowService;
    await workflowService.emit({
      urn: item.id,
      event: InventoryEvent.AUDIT_REQUESTED,
      payload: { requestedBy: 'Demo User' }
    });

    await this.inventoryService.startAudit(item, 'Demo User', 'Regular audit');
    console.log(chalk.green(`✓ Audit requested for ${sku}`));
  }

  private async runSimpleDemoScenario() {
    try {
      console.log(chalk.cyan('\n🎬 Running Simple Demo Scenario...'));
      console.log(chalk.gray('This will demonstrate the workflow without Kafka complexity.'));
      
      // Create an item
      console.log(chalk.yellow('\n1. Creating inventory item...'));
      const sku = `DEMO-${Date.now().toString().slice(-6)}`;
      const item = await this.inventoryService.createInventoryItem({
        sku,
        productName: 'Demo Product',
        location: {
          warehouse: 'WH-001',
          zone: 'A',
          shelf: '1',
          bin: 'A1'
        },
        unitCost: 100,
        reorderPoint: 20,
        reorderQuantity: 100,
        supplier: 'Demo Supplier'
      });

      // Receive stock
      console.log(chalk.yellow('\n2. Receiving stock...'));
      await this.inventoryService.processStockReceived(item, 50);
      const workflowService = (this.inventoryService as any).workflowService;
      await workflowService.emit({
        urn: item.id,
        event: InventoryEvent.STOCK_RECEIVED,
        payload: { quantity: 50 }
      });

      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 500));

      // Reserve stock
      console.log(chalk.yellow('\n3. Reserving stock...'));
      await this.inventoryService.reserveStock(sku, 10);

      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 500));

      // Show final state
      console.log(chalk.green('\n✓ Demo scenario completed!'));
      const finalItem = await this.inventoryService.getInventoryBySku(sku);
      if (finalItem) {
        console.log(chalk.cyan('\nFinal item state:'));
        console.log(`  SKU: ${finalItem.sku}`);
        console.log(`  Status: ${finalItem.status}`);
        console.log(`  Total: ${finalItem.quantity}, Available: ${finalItem.availableQuantity}, Reserved: ${finalItem.reservedQuantity}`);
      }
    } catch (error: any) {
      console.log(chalk.red(`\n✗ Error in demo scenario: ${error.message}`));
      console.error(error.stack);
    }
  }

  private async receiveStock() {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'sku',
        message: 'SKU:',
        default: `SKU-${Date.now().toString().slice(-6)}`
      },
      {
        type: 'input',
        name: 'productName',
        message: 'Product Name:',
        default: 'Laptop Computer'
      },
      {
        type: 'number',
        name: 'quantity',
        message: 'Quantity:',
        default: 100
      },
      {
        type: 'number',
        name: 'unitCost',
        message: 'Unit Cost:',
        default: 499.99
      }
    ]);

    // First create the item if it doesn't exist
    const item = await this.inventoryService.createInventoryItem({
      sku: answers.sku,
      productName: answers.productName,
      location: {
        warehouse: 'WH-001',
        zone: 'A',
        shelf: '1',
        bin: 'A1'
      },
      unitCost: answers.unitCost,
      reorderPoint: 20,
      reorderQuantity: 100,
      supplier: 'Tech Supplier Co.'
    });

    // Use the workflow service to emit the event directly to the entity
    const workflowService = (this.inventoryService as any).workflowService;
    await workflowService.emit({
      urn: item.id,
      event: InventoryEvent.STOCK_RECEIVED,
      payload: {
        sku: answers.sku,
        quantity: answers.quantity,
        location: {
          warehouse: 'WH-001',
          zone: 'A',
          shelf: '1',
          bin: 'A1'
        },
        unitCost: answers.unitCost,
        supplier: 'Tech Supplier Co.',
        purchaseOrderNumber: `PO-${Date.now()}`
      }
    });

    // Process the stock received
    await this.inventoryService.processStockReceived(item, answers.quantity);
    
    console.log(chalk.green(`✓ Stock received: ${answers.quantity} units of ${answers.sku}`));
    
    // Show updated item
    const updatedItem = await this.inventoryService.getInventoryBySku(answers.sku);
    if (updatedItem) {
      console.log(chalk.cyan(`\n📦 Updated Item State:`));
      console.log(`  SKU: ${updatedItem.sku}`);
      console.log(`  Status: ${this.getStatusColor(updatedItem.status)(updatedItem.status)}`);
      console.log(`  Quantity: ${updatedItem.quantity}`);
    }
  }

  private async allocateStock() {
    const items = await this.inventoryService.getAllInventory();
    const availableItems = items.filter(i => i.availableQuantity > 0);
    
    if (availableItems.length === 0) {
      console.log(chalk.red('No items with available stock. Receive some stock first.'));
      return;
    }

    const { sku } = await inquirer.prompt([
      {
        type: 'list',
        name: 'sku',
        message: 'Select SKU to allocate:',
        choices: availableItems.map(i => ({
          name: `${i.sku} - ${i.productName} (Available: ${i.availableQuantity})`,
          value: i.sku
        }))
      }
    ]);

    const item = availableItems.find(i => i.sku === sku)!;

    const { quantity } = await inquirer.prompt([
      {
        type: 'number',
        name: 'quantity',
        message: `Quantity to allocate (max ${item.availableQuantity}):`,
        default: Math.min(10, item.availableQuantity),
        validate: (value) => value <= item.availableQuantity || `Maximum available: ${item.availableQuantity}`
      }
    ]);

    // First reserve the stock locally
    await this.inventoryService.reserveStock(sku, quantity);
    
    // Then publish Kafka event for allocation
    const payload: StockAllocatedPayload = {
      sku,
      quantity,
      orderId: `ORD-${Date.now()}`,
      customerId: 'CUST-001'
    };

    await this.publishKafkaEvent(
      'inventory.stock.allocated',
      payload,
      `Allocated ${quantity} units of ${sku}`
    );
  }

  private async releaseStock() {
    const items = await this.inventoryService.getAllInventory();
    const reservedItems = items.filter(i => i.reservedQuantity > 0 || i.allocatedQuantity > 0);
    
    if (reservedItems.length === 0) {
      console.log(chalk.red('No items with reserved or allocated stock.'));
      return;
    }

    const { sku } = await inquirer.prompt([
      {
        type: 'list',
        name: 'sku',
        message: 'Select SKU to release:',
        choices: reservedItems.map(i => ({
          name: `${i.sku} - ${i.productName} (Reserved: ${i.reservedQuantity}, Allocated: ${i.allocatedQuantity})`,
          value: i.sku
        }))
      }
    ]);

    const item = reservedItems.find(i => i.sku === sku)!;
    const maxRelease = item.reservedQuantity + item.allocatedQuantity;

    const answers = await inquirer.prompt([
      {
        type: 'number',
        name: 'quantity',
        message: `Quantity to release (max ${maxRelease}):`,
        default: Math.min(5, maxRelease),
        validate: (value) => value <= maxRelease || `Maximum releasable: ${maxRelease}`
      },
      {
        type: 'input',
        name: 'reason',
        message: 'Reason for release:',
        default: 'Order cancelled'
      }
    ]);

    const payload: StockReleasedPayload = {
      sku,
      quantity: answers.quantity,
      reason: answers.reason
    };

    await this.publishKafkaEvent(
      'inventory.stock.released',
      payload,
      `Released ${answers.quantity} units of ${sku}`
    );
  }

  private async adjustStock() {
    const items = await this.inventoryService.getAllInventory();
    
    if (items.length === 0) {
      console.log(chalk.red('No inventory items. Create some first.'));
      return;
    }

    const { sku } = await inquirer.prompt([
      {
        type: 'list',
        name: 'sku',
        message: 'Select SKU to adjust:',
        choices: items.map(i => ({
          name: `${i.sku} - ${i.productName} (Current: ${i.quantity})`,
          value: i.sku
        }))
      }
    ]);

    const answers = await inquirer.prompt([
      {
        type: 'number',
        name: 'adjustmentQuantity',
        message: 'Adjustment quantity (positive to add, negative to remove):',
        default: -5
      },
      {
        type: 'input',
        name: 'reason',
        message: 'Reason for adjustment:',
        default: 'Physical count discrepancy'
      }
    ]);

    const payload: StockAdjustedPayload = {
      sku,
      adjustmentQuantity: answers.adjustmentQuantity,
      reason: answers.reason,
      performedBy: 'Demo User'
    };

    await this.publishKafkaEvent(
      'inventory.stock.adjusted',
      payload,
      `Adjusted ${sku} by ${answers.adjustmentQuantity} units`
    );
  }

  private async requestAudit() {
    const items = await this.inventoryService.getAllInventory();
    
    if (items.length === 0) {
      console.log(chalk.red('No inventory items. Create some first.'));
      return;
    }

    const { sku } = await inquirer.prompt([
      {
        type: 'list',
        name: 'sku',
        message: 'Select SKU to audit:',
        choices: items.map(i => ({
          name: `${i.sku} - ${i.productName} (Status: ${i.status})`,
          value: i.sku
        }))
      }
    ]);

    const { priority } = await inquirer.prompt([
      {
        type: 'list',
        name: 'priority',
        message: 'Audit priority:',
        choices: ['low', 'medium', 'high'],
        default: 'medium'
      }
    ]);

    const payload: AuditRequestedPayload = {
      sku,
      requestedBy: 'Audit Manager',
      priority: priority as 'low' | 'medium' | 'high',
      notes: 'Regular inventory audit'
    };

    await this.publishKafkaEvent(
      'inventory.audit.requested',
      payload,
      `Requested audit for ${sku}`
    );
  }

  private async runKafkaDemo() {
    console.log(chalk.cyan('\n🎬 KAFKA DEMO SCENARIO - Complete workflow driven by Kafka events\n'));
    console.log(chalk.yellow('The WorkflowModule will automatically consume and process all events'));
    console.log();
    
    const sku = `DEMO-${Date.now().toString().slice(-6)}`;
    
    // Step 1: Create and receive stock
    console.log(chalk.yellow('\nStep 1: Creating item and receiving stock via Kafka...'));
    await this.inventoryService.createInventoryItem({
      sku,
      productName: 'Demo Laptop',
      location: { warehouse: 'WH-001', zone: 'A', shelf: '1', bin: 'A1' },
      unitCost: 999.99,
      reorderPoint: 20,
      reorderQuantity: 100,
      supplier: 'Demo Supplier'
    });

    await this.publishKafkaEvent(
      'inventory.stock.received',
      {
        sku,
        quantity: 100,
        location: { warehouse: 'WH-001', zone: 'A', shelf: '1', bin: 'A1' },
        unitCost: 999.99,
        supplier: 'Demo Supplier',
        purchaseOrderNumber: `PO-DEMO-001`
      } as StockReceivedPayload,
      'Initial stock received'
    );
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 2: Reserve stock first
    console.log(chalk.yellow('\nStep 2: Reserving stock (non-Kafka)...'));
    await this.inventoryService.reserveStock(sku, 30);
    
    // Step 3: Allocate stock via Kafka
    console.log(chalk.yellow('\nStep 3: Allocating reserved stock via Kafka...'));
    await this.publishKafkaEvent(
      'inventory.stock.allocated',
      {
        sku,
        quantity: 30,
        orderId: 'ORD-DEMO-001',
        customerId: 'CUST-DEMO'
      } as StockAllocatedPayload,
      'Stock allocated for order'
    );
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 4: Release some stock
    console.log(chalk.yellow('\nStep 4: Releasing stock (partial cancellation) via Kafka...'));
    await this.publishKafkaEvent(
      'inventory.stock.released',
      {
        sku,
        quantity: 10,
        reason: 'Order partially cancelled'
      } as StockReleasedPayload,
      'Stock released back to available'
    );
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 5: Adjust stock
    console.log(chalk.yellow('\nStep 5: Adjusting stock (inventory count) via Kafka...'));
    await this.publishKafkaEvent(
      'inventory.stock.adjusted',
      {
        sku,
        adjustmentQuantity: -5,
        reason: 'Damaged items removed',
        performedBy: 'Warehouse Manager'
      } as StockAdjustedPayload,
      'Stock adjusted'
    );
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 6: Request audit
    console.log(chalk.yellow('\nStep 6: Requesting audit via Kafka...'));
    await this.publishKafkaEvent(
      'inventory.audit.requested',
      {
        sku,
        requestedBy: 'Quality Manager',
        priority: 'high',
        notes: 'Demo audit request'
      } as AuditRequestedPayload,
      'Audit requested'
    );
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(chalk.green('\n✓ Kafka demo scenario completed!'));
    console.log(chalk.cyan('\nFinal inventory state (all transitions triggered by Kafka):'));
    await this.displayInventory();
  }

  private async manualActions() {
    const items = await this.inventoryService.getAllInventory();
    
    if (items.length === 0) {
      console.log(chalk.red('No inventory items. Create some first.'));
      return;
    }

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Select manual action (non-Kafka):',
        choices: [
          'Reserve Stock',
          'Ship Inventory',
          'Quarantine Item',
          'Complete Audit',
          'Back'
        ]
      }
    ]);

    switch (action) {
      case 'Reserve Stock':
        const { sku: reserveSku, quantity } = await inquirer.prompt([
          {
            type: 'list',
            name: 'sku',
            message: 'Select SKU:',
            choices: items.map(i => i.sku)
          },
          {
            type: 'number',
            name: 'quantity',
            message: 'Quantity to reserve:',
            default: 10
          }
        ]);
        await this.inventoryService.reserveStock(reserveSku, quantity);
        console.log(chalk.green(`✓ Reserved ${quantity} units of ${reserveSku}`));
        break;

      case 'Ship Inventory':
        const allocatedItems = items.filter(i => i.status === InventoryStatus.ALLOCATED);
        if (allocatedItems.length === 0) {
          console.log(chalk.red('No items in allocated status'));
          return;
        }
        const { sku: shipSku } = await inquirer.prompt([
          {
            type: 'list',
            name: 'sku',
            message: 'Select SKU to ship:',
            choices: allocatedItems.map(i => i.sku)
          }
        ]);
        await this.inventoryService.shipInventory(shipSku);
        console.log(chalk.green(`✓ Shipped ${shipSku}`));
        break;

      case 'Quarantine Item':
        const { sku: quarantineSku, reason } = await inquirer.prompt([
          {
            type: 'list',
            name: 'sku',
            message: 'Select SKU:',
            choices: items.map(i => i.sku)
          },
          {
            type: 'input',
            name: 'reason',
            message: 'Quarantine reason:',
            default: 'Quality inspection required'
          }
        ]);
        await this.inventoryService.quarantineItem(quarantineSku, reason);
        console.log(chalk.green(`✓ Item ${quarantineSku} quarantined`));
        break;

      case 'Complete Audit':
        const auditingItems = items.filter(i => i.status === InventoryStatus.AUDITING);
        if (auditingItems.length === 0) {
          console.log(chalk.red('No items in auditing status'));
          return;
        }
        const { sku: auditSku, actualQuantity } = await inquirer.prompt([
          {
            type: 'list',
            name: 'sku',
            message: 'Select SKU:',
            choices: auditingItems.map(i => `${i.sku} (Current: ${i.quantity})`)
          },
          {
            type: 'number',
            name: 'actualQuantity',
            message: 'Actual quantity found:',
            default: 100
          }
        ]);
        await this.inventoryService.completeAudit(auditSku.split(' ')[0], actualQuantity);
        console.log(chalk.green(`✓ Audit completed for ${auditSku}`));
        break;
    }
  }

  private async showWorkflowDiagram() {
    clear();
    this.printHeader();
    console.log(this.visualizer.render(null));
    
    // Wait for user to press Enter to continue
    console.log();
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: 'Press Enter to continue...'
      }
    ]);
  }

  private async showWarehouseStats() {
    const items = await this.inventoryService.getAllInventory();
    const warehouses = new Set(items.map(i => i.location.warehouse));
    
    console.log(chalk.cyan('\nWAREHOUSE STATISTICS:'));
    console.log('─'.repeat(60));
    
    for (const warehouse of warehouses) {
      const stats = await this.inventoryService.getWarehouseStats(warehouse);
      console.log(chalk.yellow(`\n${warehouse}:`));
      console.log(`  Total Items: ${stats.totalItems}`);
      console.log(`  Total Value: $${stats.totalValue.toFixed(2)}`);
      console.log(`  Available Quantity: ${stats.availableQuantity}`);
      console.log(`  Reserved Quantity: ${stats.reservedQuantity}`);
      console.log(`  Allocated Quantity: ${stats.allocatedQuantity}`);
    }
    
    const lowStock = await this.inventoryService.getLowStockItems();
    if (lowStock.length > 0) {
      console.log(chalk.red(`\n⚠️  Low Stock Items: ${lowStock.length}`));
      lowStock.forEach(item => {
        console.log(`  - ${item.sku}: ${item.availableQuantity} units remaining`);
      });
    }
  }

  private async clearInventory() {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to clear all inventory?',
        default: false
      }
    ]);

    if (confirm) {
      const entityService = (this.inventoryService as any).entityService;
      await entityService.clearAll();
      console.log(chalk.green('✓ All inventory cleared'));
    }
  }

  async run() {
    // Initial display
    clear();
    this.printHeader();
    await this.showKafkaStatus();
    
    // Add initial delay to ensure everything is loaded
    await new Promise(resolve => setTimeout(resolve, 100));

    let continueRunning = true;
    while (continueRunning) {
      clear();
      this.printHeader();
      await this.showKafkaStatus();
      await this.displayInventory();
      continueRunning = await this.showMenu();
    }

    console.log(chalk.cyan('\nThank you for using Kafka Inventory Demo! 👋'));
    console.log(chalk.gray('The WorkflowModule continues consuming Kafka events in the background.'));
  }
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false // Disable logs for cleaner demo experience
  });

  const kafkaProducer = app.get(KafkaProducerService);
  const inventoryService = app.get(InventoryService);

  // Initialize Kafka producer connection
  await kafkaProducer.onModuleInit();

  const demo = new InventoryKafkaDemo(kafkaProducer, inventoryService);

  try {
    await demo.run();
  } finally {
    await app.close();
    process.exit(0);
  }
}

bootstrap().catch(error => {
  console.error(chalk.red('Error running demo:'), error);
  console.error(error.stack);
  process.exit(1);
});