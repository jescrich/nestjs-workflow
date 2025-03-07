# NestJS Workflow & State Machine

A flexible workflow engine built on top of NestJS framework, enabling developers to create, manage, and execute complex workflows in their Node.js applications.

## Features

- Workflow Definitions: Define workflows using a simple, declarative syntax
- State Management: Track and persist workflow states
- Event-Driven Architecture: Built on NestJS's event system for flexible workflow triggers
- Transition Rules: Configure complex transition conditions between workflow states
- Extensible: Easily extend with custom actions, conditions, and triggers
- TypeScript Support: Full TypeScript support with strong typing
- Integration Friendly: Seamlessly integrates with existing NestJS applications

## Installation

```bash
npm install @jescrich/nestjs-workflow
```

Or using yarn:

```bash
yarn add @jescrich/nestjs-workflow
```

## Quick Start

### Module Registration

```typescript
import { Module } from '@nestjs/common';
import { WorkflowModule } from '@jescrich/nestjs-workflow';

@Module({
  imports: [
    WorkflowModule.forRoot({
      storage: {
        type: 'memory'
      }
    }),
  ],
})
export class AppModule {}
```

### Define a Workflow

```typescript
import { WorkflowDefinition } from '@jescrich/nestjs-workflow';

// Define your entity and state/event enums
export enum OrderEvent {
  Create = 'order.create',
  Submit = 'order.submit',
  Update = 'order.update',
  Complete = 'order.complete',
  Fail = 'order.fail',
  Cancel = 'order.cancel',
}

export enum OrderStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
}

export class Order {
  urn: string;
  name: string;
  price: number;
  items: string[];
  status: OrderStatus;
}

// Create workflow definition
const orderWorkflowDefinition = (entity: Order): WorkflowDefinition<Order, any, OrderEvent, OrderStatus> => {
  return {
    FinalStates: [OrderStatus.Completed, OrderStatus.Failed],
    IdleStates: [OrderStatus.Pending, OrderStatus.Processing, OrderStatus.Completed, OrderStatus.Failed],
    Transitions: [
      {
        from: OrderStatus.Pending,
        to: OrderStatus.Processing,
        event: OrderEvent.Submit,
        conditions: [(entity: Order, payload: any) => entity.price > 10],
      },
      {
        from: OrderStatus.Pending,
        to: OrderStatus.Pending,
        event: OrderEvent.Update,
        actions: [
          (entity: Order, payload: any) => {
            entity.price = payload.price;
            entity.items = payload.items;
            return Promise.resolve(entity);
          },
        ],
      },
      {
        from: OrderStatus.Processing,
        to: OrderStatus.Completed,
        event: OrderEvent.Complete,
      },
      {
        from: OrderStatus.Processing,
        to: OrderStatus.Failed,
        event: OrderEvent.Fail,
      },
    ],
    FailedState: OrderStatus.Failed,
    Entity: {
      new: () => new Order(),
      update: async (entity: Order, status: OrderStatus) => {
        entity.status = status;
        return entity;
      },
      load: async (urn: string) => {
        return entity;
      },
      status: (entity: Order) => entity.status,
      urn: function (entity: Order): string {
        return entity.urn;
      },
    },
  };
};
```

### Use the Workflow in a Service

```typescript
import { Injectable } from '@nestjs/common';
import { WorkflowService } from '@jescrich/nestjs-workflow';
import { Order, OrderEvent, OrderStatus } from './order.model';

@Injectable()
export class OrderService {
  constructor(
    private readonly workflowService: WorkflowService<Order, any, OrderEvent, OrderStatus>,
  ) {}
  
  async createOrder() {
    const order = new Order();
    order.urn = 'urn:order:123';
    order.name = 'Order 123';
    order.price = 100;
    order.items = ['Item 1', 'Item 2', 'Item 3'];
    order.status = OrderStatus.Pending;
    
    // Initialize workflow with order entity
    const workflowDefinition = orderWorkflowDefinition(order);
    const workflow = new WorkflowService<Order, any, OrderEvent, OrderStatus>(workflowDefinition);
    
    return order;
  }
  
  async submitOrder(urn: string) {
    // Emit an event to trigger workflow transition
    const result = await this.workflowService.emit({ 
      urn: urn, 
      event: OrderEvent.Submit 
    });
    
    return result;
  }
  
  async updateOrder(urn: string, price: number, items: string[]) {
    // Emit an event with payload to update the order
    const result = await this.workflowService.emit({
      urn: urn,
      event: OrderEvent.Update,
      payload: {
        price: price,
        items: items,
      },
    });
    
    return result;
  }
}
```

## Configuration Options

The WorkflowModule.forRoot() method accepts the following configuration options:

```typescript
interface WorkflowModuleOptions {
  storage: {
    type: 'memory' | 'database';
    options?: any;
  };
}
```

## Advanced Usage

For more advanced usage, including custom actions, conditions, and event handling, please check the documentation.