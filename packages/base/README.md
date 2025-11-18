<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://joseescrich.com/logos/nestjs-workflow.png">
  <source media="(prefers-color-scheme: light)" srcset="https://joseescrich.com/logos/nestjs-workflow-light.png">
  <img src="https://joseescrich.com/logos/nestjs-workflow.png" alt="NestJS Workflow Logo" width="200" style="margin-bottom:20px">
</picture>

# NestJS Workflow & State Machine
A flexible workflow engine built on top of NestJS framework, enabling developers to create, manage, and execute complex workflows in their Node.js applications.

## 🎯 Live Examples & Demos

Explore fully functional examples with **interactive visual demos** included in this repository under the `examples/` directory.

The examples include comprehensive real-world implementations:

1. **🚀 Basic Example** (`examples/00-basic-example`) - Simple task workflow to get started
2. **👤 User Onboarding Workflow** (`examples/01-user-onboarding`) - Multi-step verification, KYC/AML compliance, risk assessment
3. **📦 Order Processing System** (`examples/02-order-processing`) - Complete e-commerce lifecycle with payment retry logic
4. **📊 Kafka-Driven Inventory** (`examples/03-kafka-inventory`) - Real-time event-driven inventory management with Kafka integration
5. **🔄 BullMQ Task Processing** (`examples/04-bullmq-task`) - Redis-based job queue workflow with BullMQ integration

Each example features:
- ✨ **Interactive Visual Mode** - See workflows in action with real-time state visualization
- 🎮 **Interactive Controls** - Manually trigger transitions and explore different paths
- 🤖 **Automated Scenarios** - Pre-built test cases demonstrating various workflow paths
- 📝 **Full Source Code** - Production-ready implementations you can adapt

## Table of Contents
- [Features](#features)
- [Stateless Architecture](#stateless-architecture)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Module Registration](#module-registration)
- [Define a Workflow](#define-a-workflow)
- [Configuring Actions and Conditions](#configuring-actions-and-conditions)
- [Messaging Integration](#messaging-integration)
  - [When to Use Kafka vs BullMQ](#when-to-use-kafka-vs-bullmq)
  - [Kafka Integration](#kafka-integration)
  - [BullMQ Integration](#bullmq-integration)
- [Entity Service Implementation](#entity-service-implementation)
- [Examples & Learning Resources](#-examples--learning-resources)
  
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

### 🎮 Try the Interactive Demos First!

Before diving into code, experience workflows visually with our interactive demos:

```bash
# Navigate to the examples directory
cd examples/01-user-onboarding
npm install && npm run demo
```

You'll see an interactive workflow visualization like this:
```
╔══════════════╗     ┌──────────────┐     ┌──────────────┐
║  REGISTERED  ║ --> │EMAIL_VERIFIED│ --> │PROFILE_COMPLETE│
╚══════════════╝     └──────────────┘     └──────────────┘
      (current)            ↓                      ↓
                    ┌──────────────┐     ┌──────────────┐
                    │   SUSPENDED  │     │IDENTITY_VERIFIED│
                    └──────────────┘     └──────────────┘
                                               ↓
                                         ╔══════════╗
                                         ║  ACTIVE  ║
                                         ╚══════════╝
```

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
  id: string;
  name: string;
  price: number;
  items: string[];
  status: OrderStatus;
}

// Create workflow definition
const orderWorkflowDefinition: WorkflowDefinition<Order, any, OrderEvent, OrderStatus> = {
  states: {
    finals: [OrderStatus.Completed, OrderStatus.Failed],
    idles: [OrderStatus.Pending, OrderStatus.Processing, OrderStatus.Completed, OrderStatus.Failed],
    failed: OrderStatus.Failed,
  },
  transitions: [
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
        async (entity: Order, payload: any) => {
          entity.price = payload.price;
          entity.items = payload.items;
          return entity;
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
  entity: {
    new: () => new Order(),
    update: async (entity: Order, status: OrderStatus) => {
      entity.status = status;
      return entity;
    },
    load: async (urn: string) => {
      // In a real application, load from database
      return new Order();
    },
    status: (entity: Order) => entity.status,
    urn: (entity: Order) => entity.id,
  },
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
    order.id = 'order-123';
    order.name = 'Order 123';
    order.price = 100;
    order.items = ['Item 1', 'Item 2', 'Item 3'];
    order.status = OrderStatus.Pending;
    
    return order;
  }
  
  async submitOrder(id: string) {
    // Emit an event to trigger workflow transition
    const result = await this.workflowService.emit({ 
      urn: id, 
      event: OrderEvent.Submit 
    });
    
    return result;
  }
  
  async updateOrder(id: string, price: number, items: string[]) {
    // Emit an event with payload to update the order
    const result = await this.workflowService.emit({
      urn: id,
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
    async (entity: Order, payload: any) => {
      // Perform action
      return entity;
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
  execute(params: { entity: Order; payload: any }): Promise<Order> {
    const { entity, payload } = params;
    entity.price = entity.price * 100;
    return Promise.resolve(entity);
  }

  // Handler triggered when status changes
  @OnStatusChanged({ from: OrderStatus.Pending, to: OrderStatus.Processing })
  onStatusChanged(params: { entity: Order; payload: any }): Promise<Order> {
    const { entity, payload } = params;
    entity.name = 'Status changed to processing';
    return Promise.resolve(entity);
  }
}
```

Then include these action classes in your workflow definition:

```typescript
const definition: WorkflowDefinition<Order, any, OrderEvent, OrderStatus> = {
  actions: [OrderActions],
  // ...other properties
  states: {
    finals: [OrderStatus.Completed, OrderStatus.Failed],
    idles: [OrderStatus.Pending, OrderStatus.Processing, OrderStatus.Completed, OrderStatus.Failed],
    failed: OrderStatus.Failed,
  },
  transitions: [
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
  firstHandler(params: { entity: Order; payload: any }): Promise<Order> {
    // Executes first
    return Promise.resolve(params.entity);
  }

  @OnEvent({ event: OrderEvent.Submit, order: 2 })
  secondHandler(params: { entity: Order; payload: any }): Promise<Order> {
    // Executes second
    return Promise.resolve(params.entity);
  }
}
```

### Error Handling with @OnStatusChanged
By default, if a status change handler fails, the workflow will transition to the failed state:

```typescript
@OnStatusChanged({ from: OrderStatus.Pending, to: OrderStatus.Processing })
onStatusChanged(params: { entity: Order; payload: any }): Promise<Order> {
  // If this throws an error, the workflow will move to the failed state
  throw new Error("This will cause transition to failed state");
}
```

You can disable this behavior by setting failOnError: false:

```typescript
@OnStatusChanged({ 
  from: OrderStatus.Pending, 
  to: OrderStatus.Processing, 
  failOnError: false 
})
onStatusChanged(params: { entity: Order; payload: any }): Promise<Order> {
  // If this throws an error, the workflow will continue to the next state
  throw new Error("This error will be logged but won't affect the workflow");
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

## Messaging Integration

NestJS Workflow supports integration with popular messaging systems, allowing your workflows to react to events from message queues and event streaming platforms. Choose the messaging backend that best fits your infrastructure:

- **Kafka**: For high-throughput event streaming and distributed systems
- **BullMQ**: For Redis-based job queues with built-in retry logic and job management

### When to Use Kafka vs BullMQ

| Feature | Kafka | BullMQ |
|---------|-------|--------|
| **Best For** | Event streaming, high-throughput systems | Job queues, task processing, simpler setups |
| **Infrastructure** | Kafka + Zookeeper | Redis |
| **Complexity** | High (distributed system) | Low (single Redis instance) |
| **Throughput** | Very high (millions/sec) | High (thousands/sec) |
| **Latency** | Low | Very low |
| **Message Ordering** | Partition-level guarantees | Queue-level ordering |
| **Retry Logic** | Manual implementation | Built-in with exponential backoff |
| **Dead Letter Queue** | Manual implementation | Built-in |
| **Job Priorities** | Not supported | Supported |
| **Delayed Jobs** | Not supported | Supported |
| **Job Tracking** | Manual | Built-in with job IDs |
| **Persistence** | Disk-based (durable) | Redis persistence (AOF/RDB) |
| **Horizontal Scaling** | Consumer groups | Multiple workers |
| **Use Cases** | Event sourcing, log aggregation, real-time analytics | Background jobs, email sending, scheduled tasks |

**Choose Kafka when:**
- You need high-throughput event streaming
- You're building event-sourced systems
- You need long-term message retention
- You have distributed microservices

**Choose BullMQ when:**
- You already use Redis in your stack
- You need simple job queue functionality
- You want built-in retry and DLQ support
- You're building task processing systems
- You need job priorities or delayed execution

## Kafka Integration

NestJS Workflow supports integration with Apache Kafka, allowing your workflows to react to Kafka events and trigger state transitions based on messages from your event streaming platform.

### Setting Up Kafka Integration

To configure your workflow to listen to Kafka events, you need to add a `kafka` property to your workflow definition:

```typescript
const orderWorkflowDefinition: WorkflowDefinition<Order, any, OrderEvent, OrderStatus> = {
  // ... other workflow properties
  states: {
    finals: [OrderStatus.Completed, OrderStatus.Failed],
    idles: [OrderStatus.Pending, OrderStatus.Processing, OrderStatus.Completed, OrderStatus.Failed],
    failed: OrderStatus.Failed,
  },
  transitions: [
    // Your transitions here
  ],
  
  // Kafka configuration
  kafka: {
    brokers: 'localhost:9092',
    events: [
      { topic: 'orders.submitted', event: OrderEvent.Submit },
      { topic: 'orders.completed', event: OrderEvent.Complete },
      { topic: 'orders.failed', event: OrderEvent.Fail }
    ]
  },
  
  entity: {
    // Entity configuration
    new: () => new Order(),
    update: async (entity: Order, status: OrderStatus) => {
      entity.status = status;
      return entity;
    },
    load: async (urn: string) => {
      // Load entity from storage
      return new Order();
    },
    status: (entity: Order) => entity.status,
    urn: (entity: Order) => entity.id
  }
};
```

### How It Works

When you configure Kafka integration:

1. The workflow engine will connect to the specified Kafka brokers
2. It will subscribe to the topics you've defined in the `events` array
3. When a message arrives on a subscribed topic, the workflow engine will:
   - Map the topic to the corresponding workflow event
   - Extract the entity URN from the message
   - Load the entity using your defined `entity.load` function
   - Emit the mapped workflow event with the Kafka message as payload

### Complete Example with Kafka Integration

````typescript
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
  id: string;
  name: string;
  price: number;
  items: string[];
  status: OrderStatus;
}

// Create workflow definition with Kafka integration
const orderWorkflowDefinition: WorkflowDefinition<Order, any, OrderEvent, OrderStatus> = {
  states: {
    finals: [OrderStatus.Completed, OrderStatus.Failed],
    idles: [OrderStatus.Pending, OrderStatus.Processing, OrderStatus.Completed, OrderStatus.Failed],
    failed: OrderStatus.Failed,
  },
  transitions: [
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
  
  // Kafka configuration
  kafka: {
    brokers: 'localhost:9092',
    events: [
      { topic: 'orders.submitted', event: OrderEvent.Submit },
      { topic: 'orders.completed', event: OrderEvent.Complete },
      { topic: 'orders.failed', event: OrderEvent.Fail }
    ]
  },
  
  entity: {
    new: () => new Order(),
    update: async (entity: Order, status: OrderStatus) => {
      entity.status = status;
      return entity;
    },
    load: async (urn: string) => {
      // In a real application, load from database
      const order = new Order();
      order.id = urn;
      order.status = OrderStatus.Pending;
      return order;
    },
    status: (entity: Order) => entity.status,
    urn: (entity: Order) => entity.id
  }
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

````

### Message Format

The Kafka messages should include the entity URN so that the workflow engine can load the correct entity. For example:

```json
{
  "urn": "order-123",
  "price": 150,
  "items": ["Item 1", "Item 2"]
}
```

With this setup, your workflow will automatically react to Kafka messages and trigger the appropriate state transitions based on your workflow definition.

## BullMQ Integration

NestJS Workflow also supports BullMQ, a Redis-based queue system that provides reliable job processing with built-in retry logic, dead letter queues, and job management. BullMQ is an excellent choice for applications that need task queues without the complexity of Kafka.

### Why BullMQ?

BullMQ offers several advantages for workflow integration:

- **Simple Setup**: Only requires Redis (no Zookeeper or complex configuration)
- **Built-in Retry Logic**: Automatic job retries with exponential backoff
- **Dead Letter Queue**: Failed jobs are automatically moved to a DLQ for investigation
- **Job Tracking**: Every job has a unique ID and can be monitored
- **Job Priorities**: Process critical workflows first
- **Delayed Jobs**: Schedule workflow events for future execution
- **Lower Latency**: Redis-based processing is extremely fast
- **Familiar Stack**: If you already use Redis, BullMQ is a natural fit

### Installing BullMQ Dependencies

```bash
npm install bullmq ioredis
```

Or using yarn:

```bash
yarn add bullmq ioredis
```

### Setting Up BullMQ Integration

To configure your workflow to use BullMQ, add a `bullmq` property to your workflow definition:

```typescript
const orderWorkflowDefinition: WorkflowDefinition<Order, any, OrderEvent, OrderStatus> = {
  // ... other workflow properties
  states: {
    finals: [OrderStatus.Completed, OrderStatus.Failed],
    idles: [OrderStatus.Pending, OrderStatus.Processing, OrderStatus.Completed, OrderStatus.Failed],
    failed: OrderStatus.Failed,
  },
  transitions: [
    // Your transitions here
  ],
  
  // BullMQ configuration
  bullmq: {
    connection: {
      host: 'localhost',
      port: 6379,
      password: 'your-redis-password', // Optional
      db: 0, // Optional, default is 0
    },
    events: [
      { queue: 'orders.submitted', event: OrderEvent.Submit },
      { queue: 'orders.completed', event: OrderEvent.Complete },
      { queue: 'orders.failed', event: OrderEvent.Fail }
    ],
    defaultJobOptions: {
      attempts: 3, // Retry up to 3 times
      backoff: {
        type: 'exponential',
        delay: 30000, // 30 seconds base delay
      },
      removeOnComplete: 1000, // Keep last 1000 completed jobs
      removeOnFail: 5000, // Keep last 5000 failed jobs
    },
    deadLetterQueue: {
      enabled: true,
      suffix: '-dlq', // Failed jobs go to 'orders.submitted-dlq'
    }
  },
  
  entity: {
    // Entity configuration
    new: () => new Order(),
    update: async (entity: Order, status: OrderStatus) => {
      entity.status = status;
      return entity;
    },
    load: async (urn: string) => {
      // Load entity from storage
      return new Order();
    },
    status: (entity: Order) => entity.status,
    urn: (entity: Order) => entity.id
  }
};
```

### BullMQ Configuration Options

#### Connection Settings

```typescript
connection: {
  host: string;        // Redis host (default: 'localhost')
  port: number;        // Redis port (default: 6379)
  password?: string;   // Redis password (optional)
  db?: number;         // Redis database number (default: 0)
  tls?: object;        // TLS configuration for secure connections (optional)
}
```

#### Event Mapping

Map BullMQ queues to workflow events:

```typescript
events: [
  { 
    queue: 'orders.submitted',  // BullMQ queue name
    event: OrderEvent.Submit,   // Workflow event to trigger
    jobName?: 'submit-order'    // Optional: filter by job name
  }
]
```

#### Job Options

Configure retry behavior and job lifecycle:

```typescript
defaultJobOptions: {
  attempts: 3,              // Number of retry attempts (default: 3)
  backoff: {
    type: 'exponential',    // 'exponential' or 'fixed'
    delay: 30000,           // Base delay in milliseconds (default: 30000)
  },
  removeOnComplete: 1000,   // Keep last N completed jobs (or true/false)
  removeOnFail: 5000,       // Keep last N failed jobs (or true/false)
}
```

**Retry Schedule Example:**
- Attempt 1: Immediate
- Attempt 2: 30 seconds delay
- Attempt 3: 60 seconds delay (exponential backoff)
- After 3 attempts: Move to Dead Letter Queue

#### Dead Letter Queue

Configure automatic handling of permanently failed jobs:

```typescript
deadLetterQueue: {
  enabled: true,      // Enable DLQ (default: false)
  suffix: '-dlq',     // Queue suffix for failed jobs (default: '-dlq')
}
```

When enabled, jobs that fail after all retry attempts are automatically moved to a separate queue (e.g., `orders.submitted-dlq`) with full error context for investigation.

### Module Registration with BullMQ

Register your workflow with BullMQ support:

```typescript
import { Module } from '@nestjs/common';
import { WorkflowModule } from '@jescrich/nestjs-workflow';

@Module({
  imports: [
    WorkflowModule.register({
      name: 'orderWorkflow',
      definition: orderWorkflowDefinition,
      bullmq: {
        enabled: true,
        config: orderWorkflowDefinition.bullmq!
      }
    }),
  ],
})
export class AppModule {}
```

**Important:** You cannot enable both Kafka and BullMQ simultaneously. The module will throw an error if both are configured.

### Complete Example with BullMQ Integration

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
  id: string;
  name: string;
  price: number;
  items: string[];
  status: OrderStatus;
}

// Create workflow definition with BullMQ integration
const orderWorkflowDefinition: WorkflowDefinition<Order, any, OrderEvent, OrderStatus> = {
  states: {
    finals: [OrderStatus.Completed, OrderStatus.Failed],
    idles: [OrderStatus.Pending, OrderStatus.Processing, OrderStatus.Completed, OrderStatus.Failed],
    failed: OrderStatus.Failed,
  },
  transitions: [
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
  
  // BullMQ configuration
  bullmq: {
    connection: {
      host: 'localhost',
      port: 6379,
    },
    events: [
      { queue: 'orders.submitted', event: OrderEvent.Submit },
      { queue: 'orders.completed', event: OrderEvent.Complete },
      { queue: 'orders.failed', event: OrderEvent.Fail }
    ],
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 30000,
      },
    },
    deadLetterQueue: {
      enabled: true,
    }
  },
  
  entity: {
    new: () => new Order(),
    update: async (entity: Order, status: OrderStatus) => {
      entity.status = status;
      return entity;
    },
    load: async (urn: string) => {
      // In a real application, load from database
      const order = new Order();
      order.id = urn;
      order.status = OrderStatus.Pending;
      return order;
    },
    status: (entity: Order) => entity.status,
    urn: (entity: Order) => entity.id
  }
};

@Module({
  imports: [
    WorkflowModule.register({
      name: 'orderWorkflow',
      definition: orderWorkflowDefinition,
      bullmq: {
        enabled: true,
        config: orderWorkflowDefinition.bullmq!
      }
    }),
  ],
})
export class AppModule {}
```

### Producing Jobs to BullMQ

To trigger workflow events, produce jobs to BullMQ queues:

```typescript
import { Injectable } from '@nestjs/common';
import { BullMQClient } from '@jescrich/nestjs-workflow';

@Injectable()
export class OrderProducerService {
  constructor(private readonly bullmqClient: BullMQClient) {}
  
  async submitOrder(orderId: string, orderData: any) {
    // Add job to queue
    const job = await this.bullmqClient.produce(
      'orders.submitted',           // Queue name
      'submit-order',               // Job name
      {
        urn: orderId,               // Entity URN (required)
        payload: orderData          // Event payload (optional)
      }
    );
    
    console.log(`Job added with ID: ${job.id}`);
    return job;
  }
}
```

### Job Data Format

BullMQ jobs must include the entity URN so the workflow engine can load the correct entity:

```json
{
  "urn": "order-123",
  "payload": {
    "price": 150,
    "items": ["Item 1", "Item 2"]
  }
}
```

The `urn` field is required, while `payload` is optional and will be passed to your workflow actions and conditions.

### How BullMQ Integration Works

When you configure BullMQ integration:

1. The workflow engine connects to Redis using the provided connection settings
2. It creates BullMQ workers for each queue defined in the `events` array
3. When a job arrives on a subscribed queue:
   - The worker extracts the URN and payload from the job data
   - It loads the entity using your defined `entity.load` function
   - It emits the mapped workflow event with the job payload
   - If the transition succeeds, the job is marked as completed
   - If the transition fails, BullMQ automatically retries with backoff
   - After all retries are exhausted, the job moves to the dead letter queue

### Monitoring and Health Checks

Check BullMQ connection health:

```typescript
import { Injectable } from '@nestjs/common';
import { BullMQClient } from '@jescrich/nestjs-workflow';

@Injectable()
export class HealthService {
  constructor(private readonly bullmqClient: BullMQClient) {}
  
  async checkBullMQ(): Promise<boolean> {
    return await this.bullmqClient.isHealthy();
  }
}
```

### Error Handling and Logging

BullMQ integration provides comprehensive logging:

- **Worker Initialization**: Logs when workers are created for each queue
- **Job Processing**: Logs job ID, URN, and queue name for each job
- **Success**: Logs successful workflow transitions
- **Failures**: Logs errors with retry attempt numbers
- **Dead Letter Queue**: Logs when jobs are moved to DLQ
- **Connection Issues**: Logs Redis connection failures

Example log output:

```
[BullMQClient] Worker initialized for queue: orders.submitted
[BullMQClient] Processing job: job-123 (queue: orders.submitted, urn: order-456)
[BullMQClient] Job processed successfully: job-123 (urn: order-456)
[BullMQClient] Job processing failed: job-789 (attempt 2/3, urn: order-999)
[BullMQClient] Job exceeded retry limit: job-789 (urn: order-999)
[BullMQClient] Job sent to DLQ: job-789 (queue: orders.submitted-dlq)
```

### Graceful Shutdown

BullMQ workers shut down gracefully when your application stops:

```typescript
// Automatic shutdown when module is destroyed
// Workers complete in-flight jobs before closing
// Queues are properly closed to prevent connection leaks
```

The BullMQ client implements NestJS lifecycle hooks to ensure:
- Active jobs are completed before shutdown (with timeout)
- All workers are closed properly
- All queue connections are terminated
- Shutdown progress is logged

### Migrating from Kafka to BullMQ

If you're currently using Kafka and want to switch to BullMQ:

1. **Install BullMQ dependencies**: `npm install bullmq ioredis`
2. **Replace `kafka` with `bullmq`** in your workflow definition
3. **Update module registration** to enable BullMQ instead of Kafka
4. **Change topic names to queue names** in your event mappings
5. **Update producers** to use `BullMQClient.produce()` instead of Kafka producer

See the [BullMQ example](examples/04-bullmq-task) for a complete working implementation.

### BullMQ vs Kafka: Feature Comparison

| Feature | Kafka Implementation | BullMQ Implementation |
|---------|---------------------|----------------------|
| **Configuration** | `kafka: { brokers, events }` | `bullmq: { connection, events }` |
| **Event Mapping** | `{ topic, event }` | `{ queue, event }` |
| **Retry Logic** | Manual (pause/resume consumer) | Automatic with exponential backoff |
| **Dead Letter Queue** | Manual implementation required | Built-in with configuration |
| **Job Tracking** | Manual correlation IDs | Built-in job IDs |
| **Delayed Events** | Not supported | Supported (delayed jobs) |
| **Priority Events** | Not supported | Supported (job priorities) |
| **Health Checks** | Consumer group status | Redis ping |
| **Graceful Shutdown** | Consumer disconnect | Worker completion with timeout |
| **Message Ordering** | Partition-level guarantees | Queue-level FIFO |
| **Horizontal Scaling** | Consumer groups | Multiple workers |

### Best Practices

1. **Configure Dead Letter Queues**: Always enable DLQ to capture failed jobs for investigation
2. **Set Appropriate Retry Counts**: Balance between resilience and fast failure (3 attempts is a good default)
3. **Monitor Queue Depth**: Watch for growing queues that indicate processing issues
4. **Use Job Removal Policies**: Prevent Redis memory bloat by removing old completed/failed jobs
5. **Implement Health Checks**: Monitor Redis connectivity in your application health endpoints
6. **Use Unique Job IDs**: Include entity URN and timestamp in job names for traceability
7. **Log Comprehensively**: Use the built-in logging to track job lifecycle
8. **Test Retry Scenarios**: Verify your workflows handle transient failures correctly
9. **Secure Redis**: Use passwords and TLS for production Redis instances
10. **Plan for Scale**: Consider Redis Cluster for high-availability setups

### Additional Resources

For comprehensive API documentation including detailed method signatures, type definitions, and advanced usage examples, see:

- **[BullMQ API Documentation](docs/BULLMQ_API.md)** - Complete API reference for BullMQClient, interfaces, and types
- **[BullMQ Example](examples/04-bullmq-task)** - Working example with interactive demo

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
  new(): Promise<Order> {
    return Promise.resolve(new Order());
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
    return entity.id;
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

const orderWorkflowDefinition: WorkflowDefinition<Order, any, OrderEvent, OrderStatus> = {
  states: {
    finals: [OrderStatus.Completed, OrderStatus.Failed],
    idles: [OrderStatus.Pending, OrderStatus.Processing, OrderStatus.Completed, OrderStatus.Failed],
    failed: OrderStatus.Failed,
  },
  transitions: [
    // Your transitions here
  ],
  
  // Reference your EntityService class instead of inline functions
  entity: OrderEntityService,
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
      states: {
        finals: [OrderStatus.Completed, OrderStatus.Failed],
        idles: [OrderStatus.Pending, OrderStatus.Processing, OrderStatus.Completed, OrderStatus.Failed],
        failed: OrderStatus.Failed,
      },
      transitions: [
        // Your transitions here
      ],
      
      // You can still include entity here, but it will be overridden by the injected service
      entity: {
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

## 📚 Examples & Learning Resources

### Interactive Examples
The best way to learn is by exploring the comprehensive examples included in the `examples/` directory:

#### 1. Basic Example (`examples/00-basic-example`)
Simple task workflow to get started:
- Basic workflow setup and configuration
- Simple state transitions
- Entity service implementation
- States: `PENDING` → `IN_PROGRESS` → `COMPLETED`

#### 2. User Onboarding Workflow (`examples/01-user-onboarding`)
Demonstrates a real-world user registration and verification system:
- Progressive profile completion with automatic transitions
- Multi-factor authentication flows
- Risk assessment integration
- Compliance checks (KYC/AML)
- States: `REGISTERED` → `EMAIL_VERIFIED` → `PROFILE_COMPLETE` → `IDENTITY_VERIFIED` → `ACTIVE`

#### 3. E-Commerce Order Processing (`examples/02-order-processing`)
Complete order lifecycle management system:
- Payment processing with retry logic
- Inventory reservation and management
- Multi-state shipping workflows
- Refund and return handling
- States: `CREATED` → `PAYMENT_PENDING` → `PAID` → `PROCESSING` → `SHIPPED` → `DELIVERED`

#### 4. Kafka-Driven Inventory Management (`examples/03-kafka-inventory`)
Event-driven inventory system with Kafka integration:
- Real-time stock level updates via Kafka events
- Automatic reorder triggering
- Quality control and quarantine workflows
- Multi-warehouse support
- Special states for `QUARANTINE`, `AUDITING`, `DAMAGED`, `EXPIRED`

#### 5. BullMQ Task Processing (`examples/04-bullmq-task`)
Redis-based job queue workflow with BullMQ integration:
- BullMQ queue configuration and setup
- Job retry logic with exponential backoff
- Dead letter queue for failed jobs
- Task processing with workflow state management
- States: `PENDING` → `PROCESSING` → `COMPLETED` / `FAILED`

### Running the Examples

```bash
# Navigate to the examples directory
cd examples

# Install all examples at once
npm run install:all
# Or on Windows
install-all.bat

# Run individual examples with interactive demos
cd 01-user-onboarding
npm install
npm run demo    # Interactive demo with visual workflow diagrams

cd ../02-order-processing
npm install
npm run demo

cd ../04-bullmq-task
npm install
npm run demo
```

The interactive demos feature:
- **ASCII-art workflow visualization** showing current state and possible transitions
- **Real-time state updates** as you interact with the workflow
- **Menu-driven interface** to trigger events and explore different paths
- **Automated scenarios** to demonstrate various workflow patterns

## Advanced Usage
For more advanced usage, including custom actions, conditions, and event handling, please check the documentation and explore the examples repository.
```
