<img src="https://joseescrich.com/logos/nestjs-workflow.png" alt="logo" width="200" style="margin-bottom:20px"/>

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

Documentation: https://jescrich.github.io/libraries/docs/workflow/intro

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

// Register a workflow
@Module({
  imports: [
    WorkflowModule.register({
      name: 'simpleworkflow',
      definition: orderWorkflowDefinition,
    }),
  ],
})
export class AppModule {}

// Inject and use in a service
@Injectable()
class OrderService {
    constructor(
        @Inject('simpleworkflow')
        private readonly orderWorkflow: Workflow<Order, OrderEvent>) {}

    async submitOrder(urn: string) {
        return await this.orderWorkflow.emit({ urn, event: OrderEvent.Submit });
    }
}

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

## Configuring Actions and Conditions
NestJS Workflow provides two different approaches for configuring actions and conditions in your workflows:

### 1. Inline Functions in Transitions
You can define actions and conditions directly in the transition definition as shown in the example above:

```typescript
{
  from: OrderStatus.Pending,
  to: OrderStatus.Processing,
  event: OrderEvent.Submit,
  conditions: [(entity: Order, payload: any) => entity.price > 10],
  actions: [
    (entity: Order, payload: any) => {
      // Perform action
      return Promise.resolve(entity);
    },
  ],
}
```

### 2. Using Decorators (Class-based approach)
For more complex workflows, you can use a class-based approach with decorators:

```typescript
import { Injectable } from '@nestjs/common';
import { WorkflowAction, OnEvent, OnStatusChanged } from '@jescrich/nestjs-workflow';

@Injectable()
@WorkflowAction()
export class OrderActions {
  // Handler triggered on specific event
  @OnEvent({ event: OrderEvent.Submit })
  execute(params: { entity: Order; payload: any }) {
    const { entity, payload } = params;
    entity.price = entity.price * 100;
    return Promise.resolve(entity);
  }

  // Handler triggered when status changes
  @OnStatusChanged({ from: OrderStatus.Pending, to: OrderStatus.Processing })
  onStatusChanged(params: { entity: Order; payload: any }) {
    const { entity, payload } = params;
    entity.name = 'Status changed to processing';
    return Promise.resolve(entity);
  }
}
```

Then include these action classes in your workflow definition:

```typescript
const definition: WorkflowDefinition<Order, any, OrderEvent, OrderStatus> = {
  Actions: [OrderActions],
  // ...other properties
  Transitions: [
    {
      from: OrderStatus.Pending,
      to: OrderStatus.Processing,
      event: OrderEvent.Submit,
    },
    // Other transitions
  ],
  // ...
};
```

### Execution Order with @OnEvent
You can control the execution order of multiple handlers for the same event:

```typescript
@Injectable()
@WorkflowAction()
export class OrderActions {
  @OnEvent({ event: OrderEvent.Submit, order: 1 })
  firstHandler(params: { entity: Order; payload: any }) {
    // Executes first
    return Promise.resolve(params.entity);
  }

  @OnEvent({ event: OrderEvent.Submit, order: 2 })
  secondHandler(params: { entity: Order; payload: any }) {
    // Executes second
    return Promise.resolve(params.entity);
  }
}
```

### Error Handling with @OnStatusChanged
By default, if a status change handler fails, the workflow will transition to the failed state:

```typescript
@OnStatusChanged({ from: OrderStatus.Pending, to: OrderStatus.Processing })
onStatusChanged(params: { entity: Order; payload: any }) {
  // If this throws an error, the workflow will move to the failed state
}
```

You can disable this behavior by setting failOnError: false:

```typescript
@OnStatusChanged({ 
  from: OrderStatus.Pending, 
  to: OrderStatus.Processing, 
  failOnError: false 
})
onStatusChanged(params: { entity: Order; payload: any }) {
  // If this throws an error, the workflow will continue to the next state
}
```

Remember to register your action classes as providers in your module:

```typescript
@Module({
  imports: [
    WorkflowModule.register({
      name: 'orderWorkflow',
      definition,
    }),
  ],
  providers: [OrderActions],
})
export class OrderModule {}
```

## Advanced Usage
For more advanced usage, including custom actions, conditions, and event handling, please check the documentation.
