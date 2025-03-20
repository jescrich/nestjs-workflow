<img src="https://joseescrich.com/logos/nestjs-workflow.png" alt="logo" width="200" style="margin-bottom:20px"/>

# NestJS Workflow & State Machine
A flexible workflow engine built on top of NestJS framework, enabling developers to create, manage, and execute complex workflows in their Node.js applications.

## Table of Contents
- [Features](#features)
- [Stateless Architecture](#stateless-architecture)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Module Registration](#module-registration)
- [Define a Workflow](#define-a-workflow)
- [Message Format](#message-format)
- [Configuring Actions and Conditions](#configuring-actions-and-conditions)
- [Complete Example with Kafka Integration](#complete-example-with-kafka-integration)
- [Entity Service](#entity-service)
- [Kafka Integration](#kafka-integration)
  
## Features
- Workflow Definitions: Define workflows using a simple, declarative syntax
- State Management: Track and persist workflow states
- Event-Driven Architecture: Built on NestJS's event system for flexible workflow triggers
- Transition Rules: Configure complex transition conditions between workflow states
- Extensible: Easily extend with custom actions, conditions, and triggers
- TypeScript Support: Full TypeScript support with strong typing
- Integration Friendly: Seamlessly integrates with existing NestJS applications
- Kafka Integration: Easily integrate with Kafka for event-driven workflows
- Stateless Design: Lightweight implementation with no additional storage requirements

Documentation: https://jescrich.github.io/libraries/docs/workflow/intro

# Stateless Architecture
## NestJS Workflow is designed with a stateless architecture, which offers several key benefits:

Benefits of Stateless Design

- Simplicity: No additional database or storage configuration required
- Domain-Driven: State is maintained within your domain entities where it belongs
- Lightweight: Minimal overhead and dependencies
- Scalability: Easily scales horizontally with your application
- Flexibility: Works with any persistence layer or storage mechanism
- Integration: Seamlessly integrates with your existing data model and repositories
- The workflow engine doesn't maintain any state itself - instead, it operates on your domain entities, reading their current state and applying transitions according to your defined rules. This approach aligns with domain-driven design principles by keeping the state with the entity it belongs to.

This stateless design means you can:

Use your existing repositories and data access patterns
Persist workflow state alongside your entity data
Avoid complex synchronization between separate state stores
Maintain transactional integrity with your domain operations
```
// Example of how state is part of your domain entity
export class Order {
  id: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus; // The workflow state is a property of your entity
  
  // Your domain logic here
}
```

The workflow engine simply reads and updates this state property according to your defined transitions, without needing to maintain any separate state storage.

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

## Kafka Integration

NestJS Workflow now supports integration with Apache Kafka, allowing your workflows to react to Kafka events and trigger state transitions based on messages from your event streaming platform.

### Setting Up Kafka Integration

To configure your workflow to listen to Kafka events, you need to add a `Kafka` property to your workflow definition:

```typescript
const orderWorkflowDefinition = (entity: Order): WorkflowDefinition<Order, any, OrderEvent, OrderStatus> => {
  return {
    // ... other workflow properties
    FinalStates: [OrderStatus.Completed, OrderStatus.Failed],
    IdleStates: [OrderStatus.Pending, OrderStatus.Processing, OrderStatus.Completed, OrderStatus.Failed],
    Transitions: [
      // Your transitions here
    ],
    FailedState: OrderStatus.Failed,
    
    // Kafka configuration
    Kafka: {
      brokers: 'localhost:9092',
      events: [
        { topic: 'orders.submitted', event: OrderEvent.Submit },
        { topic: 'orders.completed', event: OrderEvent.Complete },
        { topic: 'orders.failed', event: OrderEvent.Fail }
      ]
    },
    
    Entity: {
      // Entity configuration
      new: () => new Order(),
      update: async (entity: Order, status: OrderStatus) => {
        entity.status = status;
        return entity;
      },
      load: async (urn: string) => {
        // Load entity from storage
        return entity;
      },
      status: (entity: Order) => entity.status,
      urn: (entity: Order) => entity.urn
    }
  };
};
```

### How It Works

When you configure Kafka integration:

1. The workflow engine will connect to the specified Kafka brokers
2. It will subscribe to the topics you've defined in the `events` array
3. When a message arrives on a subscribed topic, the workflow engine will:
   - Map the topic to the corresponding workflow event
   - Extract the entity URN from the message
   - Load the entity using your defined `Entity.load` function
   - Emit the mapped workflow event with the Kafka message as payload

### Complete Example with Kafka Integration

```typescript
import { Injectable, Module } from '@nestjs/common';
import { WorkflowModule, WorkflowDefinition, WorkflowService } from '@jescrich/nestjs-workflow';

// Define your entity and state/event enums
export enum OrderEvent {
  Create = 'order.create',
  Submit = 'order.submit',
  Complete = 'order.complete',
  Fail = 'order.fail',
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

// Create workflow definition with Kafka integration
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
    
    // Kafka configuration
    Kafka: {
      brokers: 'localhost:9092',
      events: [
        { topic: 'orders.submitted', event: OrderEvent.Submit },
        { topic: 'orders.completed', event: OrderEvent.Complete },
        { topic: 'orders.failed', event: OrderEvent.Fail }
      ]
    },
    
    Entity: {
      new: () => new Order(),
      update: async (entity: Order, status: OrderStatus) => {
        entity.status = status;
        return entity;
      },
      load: async (urn: string) => {
        // In a real application, load from database
        const order = new Order();
        order.urn = urn;
        order.status = OrderStatus.Pending;
        return order;
      },
      status: (entity: Order) => entity.status,
      urn: (entity: Order) => entity.urn
    }
  };
};

@Module({
  imports: [
    WorkflowModule.register({
      name: 'orderWorkflow',
      definition: orderWorkflowDefinition,
    }),
  ],
})
export class AppModule {}
```

### Message Format

The Kafka messages should include the entity URN so that the workflow engine can load the correct entity. For example:

```json
{
  "urn": "urn:order:123",
  "price": 150,
  "items": ["Item 1", "Item 2"]
}
```

With this setup, your workflow will automatically react to Kafka messages and trigger the appropriate state transitions based on your workflow definition.

## Entity Service Implementation

NestJS Workflow allows you to implement an `EntityService` to manage your entity's lifecycle and state. This provides a cleaner separation of concerns between your workflow logic and entity management.

### Creating an EntityService

Instead of defining entity operations inline in your workflow definition, you can create a dedicated service:

```typescript
import { Injectable } from '@nestjs/common';
import { EntityService } from '@jescrich/nestjs-workflow';
import { Order, OrderStatus } from './order.model';
import { OrderRepository } from './order.repository';

@Injectable()
export class OrderEntityService extends EntityService<Order, OrderStatus> {
  constructor(private readonly orderRepository: OrderRepository) {
    super();
  }

  // Create a new entity instance
  new(): Order {
    return new Order();
  }

  // Update entity status
  async update(entity: Order, status: OrderStatus): Promise<Order> {
    entity.status = status;
    return this.orderRepository.save(entity);
  }

  // Load entity by URN
  async load(urn: string): Promise<Order> {
    const order = await this.orderRepository.findByUrn(urn);
    if (!order) {
      throw new Error(`Order with URN ${urn} not found`);
    }
    return order;
  }

  // Get current status
  status(entity: Order): OrderStatus {
    return entity.status;
  }

  // Get entity URN
  urn(entity: Order): string {
    return entity.urn;
  }
}
```

### Registering the EntityService

Register your EntityService as a provider in your module:

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([OrderEntity]),
  ],
  providers: [
    OrderEntityService,
    OrderRepository,
  ],
  exports: [OrderEntityService],
})
export class OrderModule {}
```

### Using EntityService with Workflow

There are two ways to use your EntityService with a workflow:

#### 1. Reference in Workflow Definition

```typescript
import { Module } from '@nestjs/common';
import { WorkflowModule } from '@jescrich/nestjs-workflow';
import { OrderEntityService } from './order-entity.service';

const orderWorkflowDefinition = {
  FinalStates: [OrderStatus.Completed, OrderStatus.Failed],
  IdleStates: [OrderStatus.Pending, OrderStatus.Processing, OrderStatus.Completed, OrderStatus.Failed],
  Transitions: [
    // Your transitions here
  ],
  FailedState: OrderStatus.Failed,
  
  // Reference your EntityService class instead of inline functions
  Entity: OrderEntityService,
};

@Module({
  imports: [
    WorkflowModule.register({
      name: 'orderWorkflow',
      definition: orderWorkflowDefinition,
    }),
  ],
})
export class AppModule {}
```

#### 2. Inject into WorkflowService

You can also inject your EntityService directly when creating a WorkflowService instance:

```typescript
@Injectable()
export class OrderService {
  private workflowService: WorkflowService<Order, any, OrderEvent, OrderStatus>;
  
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly orderEntityService: OrderEntityService
  ) {
    const workflowDefinition = {
      FinalStates: [OrderStatus.Completed, OrderStatus.Failed],
      IdleStates: [OrderStatus.Pending, OrderStatus.Processing, OrderStatus.Completed, OrderStatus.Failed],
      Transitions: [
        // Your transitions here
      ],
      FailedState: OrderStatus.Failed,
      
      // You can still include Entity here, but it will be overridden by the injected service
      Entity: {
        new: () => new Order(),
        // other methods...
      }
    };
    
    this.workflowService = new WorkflowService(
      workflowDefinition,
      this.moduleRef,
      this.orderEntityService // Inject the entity service
    );
  }
  
  // Your service methods using workflowService
}
```

### Benefits of Using EntityService

Using a dedicated EntityService provides several advantages:

1. **Separation of Concerns**: Keep entity management logic separate from workflow definitions
2. **Dependency Injection**: Leverage NestJS dependency injection for your entity operations
3. **Reusability**: Use the same EntityService across multiple workflows
4. **Testability**: Easier to mock and test your entity operations
5. **Database Integration**: Cleanly integrate with your database through repositories

This approach is particularly useful for complex applications where entities are stored in databases and require sophisticated loading and persistence logic.

## Advanced Usage
For more advanced usage, including custom actions, conditions, and event handling, please check the documentation.
