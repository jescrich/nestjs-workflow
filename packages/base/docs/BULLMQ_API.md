# BullMQ API Documentation

This document provides comprehensive API documentation for the BullMQ integration in the NestJS Workflow Library.

## Table of Contents

- [Overview](#overview)
- [Interfaces and Types](#interfaces-and-types)
  - [BullMQConfig](#bullmqconfig)
  - [BullMQEvent](#bullmqevent)
  - [WorkflowJobData](#workflowjobdata)
  - [DLQJobData](#dlqjobdata)
- [BullMQClient Class](#bullmqclient-class)
  - [Constructor](#constructor)
  - [Methods](#methods)
- [Usage Examples](#usage-examples)
  - [Basic Configuration](#basic-configuration)
  - [Producing Jobs](#producing-jobs)
  - [Consuming Jobs](#consuming-jobs)
  - [Health Checks](#health-checks)
  - [Dead Letter Queue](#dead-letter-queue)
- [Integration with WorkflowModule](#integration-with-workflowmodule)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

## Overview

The BullMQ integration provides a Redis-based messaging backend for the NestJS Workflow Library. It allows workflows to be triggered by jobs in BullMQ queues, with built-in support for retries, dead letter queues, and graceful shutdown.

## Interfaces and Types

### BullMQConfig

Configuration interface for BullMQ connection and behavior.

```typescript
interface BullMQConfig {
  connection: {
    host: string;           // Redis server hostname
    port: number;           // Redis server port
    password?: string;      // Optional Redis password
    db?: number;            // Optional Redis database number (default: 0)
    tls?: object;           // Optional TLS configuration
  };
  events: BullMQEvent<any>[];  // Array of queue-to-event mappings
  defaultJobOptions?: {
    attempts?: number;      // Number of retry attempts (default: 3)
    backoff?: {
      type: 'exponential' | 'fixed';  // Backoff strategy
      delay: number;        // Base delay in milliseconds (default: 30000)
    };
    removeOnComplete?: boolean | number;  // Auto-remove completed jobs (default: 1000)
    removeOnFail?: boolean | number;      // Auto-remove failed jobs (default: 5000)
  };
  deadLetterQueue?: {
    enabled: boolean;       // Enable dead letter queue
    suffix?: string;        // DLQ queue name suffix (default: '-dlq')
  };
}
```

**Properties:**

- **connection**: Redis connection settings
  - `host`: The hostname or IP address of the Redis server
  - `port`: The port number of the Redis server
  - `password`: Optional password for Redis authentication
  - `db`: Optional database number to use (0-15)
  - `tls`: Optional TLS/SSL configuration object

- **events**: Array of BullMQEvent objects that map queues to workflow events

- **defaultJobOptions**: Default options applied to all jobs
  - `attempts`: Number of times to retry a failed job before giving up
  - `backoff`: Retry backoff strategy
    - `type`: Either 'exponential' (delay doubles each retry) or 'fixed' (constant delay)
    - `delay`: Base delay in milliseconds between retries
  - `removeOnComplete`: If true, removes job when completed. If a number, keeps that many completed jobs
  - `removeOnFail`: If true, removes job when failed. If a number, keeps that many failed jobs

- **deadLetterQueue**: Configuration for failed job handling
  - `enabled`: Whether to move permanently failed jobs to a dead letter queue
  - `suffix`: String appended to queue name to create DLQ name (e.g., 'orders' → 'orders-dlq')

**Example:**

```typescript
const config: BullMQConfig = {
  connection: {
    host: 'localhost',
    port: 6379,
    password: 'myRedisPassword',
    db: 0,
  },
  events: [
    { queue: 'order-events', event: OrderEvent.Created },
    { queue: 'payment-events', event: OrderEvent.PaymentReceived },
  ],
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 30000, // 30 seconds
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
  deadLetterQueue: {
    enabled: true,
    suffix: '-dlq',
  },
};
```

### BullMQEvent

Defines the mapping between a BullMQ queue and a workflow event.

```typescript
interface BullMQEvent<Event> {
  queue: string;      // BullMQ queue name
  event: Event;       // Workflow event to emit
  jobName?: string;   // Optional job name filter
}
```

**Properties:**

- **queue**: The name of the BullMQ queue to consume from
- **event**: The workflow event to emit when a job is received from this queue
- **jobName**: Optional job name to filter by. If specified, only jobs with this name will trigger the event

**Example:**

```typescript
const events: BullMQEvent<OrderEvent>[] = [
  {
    queue: 'order-events',
    event: OrderEvent.Created,
  },
  {
    queue: 'order-events',
    event: OrderEvent.Cancelled,
    jobName: 'order-cancelled', // Only process jobs named 'order-cancelled'
  },
];
```

### WorkflowJobData

The data structure for jobs that trigger workflow events.

```typescript
interface WorkflowJobData<P = any> {
  urn: string;      // Entity unique resource name (required)
  payload?: P;      // Optional event payload
}
```

**Properties:**

- **urn**: The unique resource name (URN) of the entity this job relates to. This is used to load the entity and execute the workflow transition
- **payload**: Optional payload data to pass to the workflow event handler. The type `P` can be specified for type safety

**Example:**

```typescript
// Simple job with just URN
const jobData: WorkflowJobData = {
  urn: 'order:12345',
};

// Job with typed payload
interface OrderPayload {
  customerId: string;
  amount: number;
}

const jobDataWithPayload: WorkflowJobData<OrderPayload> = {
  urn: 'order:12345',
  payload: {
    customerId: 'customer:789',
    amount: 99.99,
  },
};
```

### DLQJobData

The data structure for jobs in the dead letter queue.

```typescript
interface DLQJobData<P = any> {
  originalJobId: string;          // ID of the original failed job
  originalJobName: string;        // Name of the original failed job
  originalData: WorkflowJobData<P>;  // Original job data
  error: {
    message: string;              // Error message
    stack?: string;               // Optional error stack trace
  };
  failedAt: string;               // ISO timestamp of failure
  attemptsMade: number;           // Number of attempts made
}
```

**Properties:**

- **originalJobId**: The unique ID of the job that failed
- **originalJobName**: The name of the job that failed
- **originalData**: The complete original job data including URN and payload
- **error**: Error information
  - `message`: The error message from the last failed attempt
  - `stack`: Optional stack trace for debugging
- **failedAt**: ISO 8601 timestamp when the job was moved to DLQ
- **attemptsMade**: Total number of processing attempts before failure

**Example:**

```typescript
// Example DLQ job data
const dlqJob: DLQJobData<OrderPayload> = {
  originalJobId: 'order-created-order:12345-1699876543210',
  originalJobName: 'order-created',
  originalData: {
    urn: 'order:12345',
    payload: {
      customerId: 'customer:789',
      amount: 99.99,
    },
  },
  error: {
    message: 'Payment service unavailable',
    stack: 'Error: Payment service unavailable\n    at ...',
  },
  failedAt: '2024-11-11T10:30:00.000Z',
  attemptsMade: 3,
};
```

## BullMQClient Class

The `BullMQClient` class manages BullMQ queue operations, including producing jobs, consuming jobs with retry logic, and handling dead letter queues.

### Constructor

```typescript
constructor(config: BullMQConfig)
```

Creates a new BullMQClient instance with the specified configuration.

**Parameters:**

- `config`: BullMQConfig object containing connection settings and options

**Example:**

```typescript
import { BullMQClient } from '@your-org/nestjs-workflow';

const client = new BullMQClient({
  connection: {
    host: 'localhost',
    port: 6379,
  },
  events: [],
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 30000,
    },
  },
  deadLetterQueue: {
    enabled: true,
  },
});
```

### Methods

#### produce()

Adds a job to a BullMQ queue to trigger a workflow event.

```typescript
async produce<T>(
  queueName: string,
  jobName: string,
  data: WorkflowJobData<T>
): Promise<Job<WorkflowJobData<T>>>
```

**Parameters:**

- `queueName`: The name of the queue to add the job to
- `jobName`: A descriptive name for the job (used for tracking and filtering)
- `data`: The job data containing URN and optional payload

**Returns:**

- Promise resolving to a BullMQ Job instance

**Throws:**

- Error if job cannot be added to the queue

**Example:**

```typescript
// Simple job without payload
await client.produce('order-events', 'order-created', {
  urn: 'order:12345',
});

// Job with typed payload
interface OrderCreatedPayload {
  customerId: string;
  items: string[];
  total: number;
}

const job = await client.produce<OrderCreatedPayload>(
  'order-events',
  'order-created',
  {
    urn: 'order:12345',
    payload: {
      customerId: 'customer:789',
      items: ['item:1', 'item:2'],
      total: 149.99,
    },
  }
);

console.log(`Job created with ID: ${job.id}`);
```

#### consume()

Creates a worker to process jobs from a BullMQ queue.

```typescript
async consume<T>(
  queueName: string,
  handler: (job: Job<WorkflowJobData<T>>) => Promise<void>,
  options?: WorkerOptions
): Promise<Worker<WorkflowJobData<T>>>
```

**Parameters:**

- `queueName`: The name of the queue to consume from
- `handler`: Async function to process each job. Should throw an error to trigger retry
- `options`: Optional BullMQ WorkerOptions to customize worker behavior

**Returns:**

- Promise resolving to a BullMQ Worker instance

**Example:**

```typescript
// Basic consumer
const worker = await client.consume('order-events', async (job) => {
  console.log(`Processing order: ${job.data.urn}`);
  
  // Process the job
  await processOrder(job.data);
  
  // If an error occurs, throw it to trigger retry
  if (someCondition) {
    throw new Error('Processing failed, will retry');
  }
});

// Consumer with custom options
const worker = await client.consume(
  'order-events',
  async (job) => {
    await processOrder(job.data);
  },
  {
    concurrency: 5, // Process up to 5 jobs concurrently
    limiter: {
      max: 10,      // Max 10 jobs
      duration: 1000, // per second
    },
  }
);
```

#### isHealthy()

Checks if the BullMQ client can connect to Redis.

```typescript
async isHealthy(): Promise<boolean>
```

**Returns:**

- Promise resolving to `true` if Redis is reachable, `false` otherwise

**Example:**

```typescript
const healthy = await client.isHealthy();

if (healthy) {
  console.log('BullMQ client is healthy');
} else {
  console.error('BullMQ client cannot connect to Redis');
}

// Use in health check endpoint
@Get('health')
async healthCheck() {
  const bullmqHealthy = await this.bullmqClient.isHealthy();
  
  return {
    status: bullmqHealthy ? 'ok' : 'error',
    bullmq: bullmqHealthy,
  };
}
```

#### onModuleDestroy()

Gracefully shuts down all workers and queues. This method is automatically called by NestJS when the module is destroyed.

```typescript
async onModuleDestroy(): Promise<void>
```

**Example:**

```typescript
// Automatically called by NestJS on shutdown
// Manual call if needed:
await client.onModuleDestroy();
```

## Usage Examples

### Basic Configuration

Setting up a workflow with BullMQ:

```typescript
import { Module } from '@nestjs/common';
import { WorkflowModule, BullMQClient } from '@your-org/nestjs-workflow';
import { OrderWorkflowDefinition } from './order.workflow';

@Module({
  imports: [
    WorkflowModule.register({
      name: 'OrderWorkflow',
      definition: OrderWorkflowDefinition,
      bullmq: {
        enabled: true,
        config: {
          connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
          },
          events: [
            { queue: 'order-events', event: OrderEvent.Created },
            { queue: 'payment-events', event: OrderEvent.PaymentReceived },
            { queue: 'shipping-events', event: OrderEvent.Shipped },
          ],
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 30000,
            },
            removeOnComplete: 1000,
            removeOnFail: 5000,
          },
          deadLetterQueue: {
            enabled: true,
            suffix: '-dlq',
          },
        },
      },
    }),
  ],
})
export class OrderModule {}
```

### Producing Jobs

Triggering workflow events by producing jobs:

```typescript
import { Injectable } from '@nestjs/common';
import { BullMQClient } from '@your-org/nestjs-workflow';

@Injectable()
export class OrderService {
  constructor(private readonly bullmqClient: BullMQClient) {}

  async createOrder(orderData: CreateOrderDto): Promise<Order> {
    // Create the order entity
    const order = await this.orderRepository.create(orderData);

    // Trigger the workflow by producing a job
    await this.bullmqClient.produce('order-events', 'order-created', {
      urn: `order:${order.id}`,
      payload: {
        customerId: orderData.customerId,
        items: orderData.items,
        total: orderData.total,
      },
    });

    return order;
  }

  async processPayment(orderId: string, paymentData: PaymentData): Promise<void> {
    // Process payment
    const payment = await this.paymentService.process(paymentData);

    // Trigger payment received event
    await this.bullmqClient.produce('payment-events', 'payment-received', {
      urn: `order:${orderId}`,
      payload: {
        paymentId: payment.id,
        amount: payment.amount,
        method: payment.method,
      },
    });
  }
}
```

### Consuming Jobs

The WorkflowService automatically sets up consumers based on the workflow definition. However, you can also create custom consumers:

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { BullMQClient } from '@your-org/nestjs-workflow';

@Injectable()
export class CustomJobProcessor implements OnModuleInit {
  constructor(private readonly bullmqClient: BullMQClient) {}

  async onModuleInit() {
    // Set up a custom consumer for analytics
    await this.bullmqClient.consume('analytics-events', async (job) => {
      console.log(`Processing analytics event for ${job.data.urn}`);
      
      try {
        await this.analyticsService.track(job.data);
      } catch (error) {
        console.error(`Analytics processing failed: ${error.message}`);
        // Throw to trigger retry
        throw error;
      }
    });
  }
}
```

### Health Checks

Implementing health checks for BullMQ:

```typescript
import { Controller, Get } from '@nestjs/common';
import { BullMQClient } from '@your-org/nestjs-workflow';

@Controller('health')
export class HealthController {
  constructor(private readonly bullmqClient: BullMQClient) {}

  @Get()
  async check() {
    const bullmqHealthy = await this.bullmqClient.isHealthy();

    return {
      status: bullmqHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        bullmq: {
          status: bullmqHealthy ? 'up' : 'down',
        },
      },
    };
  }

  @Get('ready')
  async readiness() {
    // Check if the service is ready to accept traffic
    const bullmqHealthy = await this.bullmqClient.isHealthy();

    if (!bullmqHealthy) {
      throw new Error('BullMQ is not ready');
    }

    return { status: 'ready' };
  }
}
```

### Dead Letter Queue

Handling failed jobs in the dead letter queue:

```typescript
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class DLQMonitorService {
  private dlqQueue: Queue;

  constructor() {
    // Connect to the DLQ
    this.dlqQueue = new Queue('order-events-dlq', {
      connection: {
        host: 'localhost',
        port: 6379,
      },
    });
  }

  async getFailedJobs(): Promise<any[]> {
    // Get all jobs in the DLQ
    const jobs = await this.dlqQueue.getJobs(['waiting', 'active']);
    
    return jobs.map(job => ({
      id: job.id,
      name: job.data.originalJobName,
      urn: job.data.originalData.urn,
      error: job.data.error.message,
      failedAt: job.data.failedAt,
      attempts: job.data.attemptsMade,
    }));
  }

  async retryFailedJob(jobId: string): Promise<void> {
    // Get the failed job from DLQ
    const job = await this.dlqQueue.getJob(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found in DLQ`);
    }

    // Extract original data
    const dlqData = job.data as DLQJobData;
    
    // Re-add to original queue
    const originalQueue = new Queue(dlqData.originalJobName.split('-')[0] + '-events', {
      connection: {
        host: 'localhost',
        port: 6379,
      },
    });

    await originalQueue.add(
      dlqData.originalJobName,
      dlqData.originalData,
      {
        attempts: 3,
      }
    );

    // Remove from DLQ
    await job.remove();
    
    await originalQueue.close();
  }

  async clearDLQ(): Promise<void> {
    // Remove all jobs from DLQ
    await this.dlqQueue.drain();
  }
}
```

## Integration with WorkflowModule

The BullMQClient integrates seamlessly with the WorkflowModule:

```typescript
// workflow.definition.ts
import { WorkflowDefinition, BullMQEvent } from '@your-org/nestjs-workflow';

export enum OrderEvent {
  Created = 'CREATED',
  PaymentReceived = 'PAYMENT_RECEIVED',
  Shipped = 'SHIPPED',
  Delivered = 'DELIVERED',
  Cancelled = 'CANCELLED',
}

export enum OrderState {
  Pending = 'PENDING',
  PaymentProcessing = 'PAYMENT_PROCESSING',
  Confirmed = 'CONFIRMED',
  Shipping = 'SHIPPING',
  Delivered = 'DELIVERED',
  Cancelled = 'CANCELLED',
  Failed = 'FAILED',
}

export const OrderWorkflowDefinition: WorkflowDefinition<
  Order,
  any,
  OrderEvent,
  OrderState
> = {
  name: 'OrderWorkflow',
  states: {
    finals: [OrderState.Delivered, OrderState.Cancelled],
    idles: [OrderState.Pending, OrderState.Confirmed],
    failed: OrderState.Failed,
  },
  transitions: [
    {
      event: OrderEvent.Created,
      from: OrderState.Pending,
      to: OrderState.PaymentProcessing,
    },
    {
      event: OrderEvent.PaymentReceived,
      from: OrderState.PaymentProcessing,
      to: OrderState.Confirmed,
    },
    {
      event: OrderEvent.Shipped,
      from: OrderState.Confirmed,
      to: OrderState.Shipping,
    },
    {
      event: OrderEvent.Delivered,
      from: OrderState.Shipping,
      to: OrderState.Delivered,
    },
  ],
  bullmq: {
    connection: {
      host: 'localhost',
      port: 6379,
    },
    events: [
      { queue: 'order-events', event: OrderEvent.Created },
      { queue: 'payment-events', event: OrderEvent.PaymentReceived },
      { queue: 'shipping-events', event: OrderEvent.Shipped },
      { queue: 'delivery-events', event: OrderEvent.Delivered },
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
    },
  },
  entity: OrderEntityService,
};
```

## Error Handling

### Retry Behavior

Jobs automatically retry on failure based on the configuration:

```typescript
// Configure retry behavior
const config: BullMQConfig = {
  // ... connection settings
  defaultJobOptions: {
    attempts: 3,              // Retry up to 3 times
    backoff: {
      type: 'exponential',    // Exponential backoff
      delay: 30000,           // Start with 30 second delay
    },
  },
  deadLetterQueue: {
    enabled: true,            // Move to DLQ after all retries fail
  },
};
```

**Retry Schedule:**
- Attempt 1: Immediate
- Attempt 2: 30 seconds delay
- Attempt 3: 60 seconds delay (exponential: 30s × 2)
- After 3 attempts: Moved to dead letter queue

### Error Handling in Handlers

```typescript
await client.consume('order-events', async (job) => {
  try {
    // Process the job
    await processOrder(job.data);
  } catch (error) {
    if (error instanceof TemporaryError) {
      // Throw to trigger retry
      throw error;
    } else if (error instanceof PermanentError) {
      // Log and don't retry
      console.error(`Permanent error: ${error.message}`);
      // Don't throw - job will be marked as completed
    } else {
      // Unknown error - retry
      throw error;
    }
  }
});
```

### Connection Errors

```typescript
// Handle Redis connection failures
try {
  await client.produce('order-events', 'order-created', {
    urn: 'order:12345',
  });
} catch (error) {
  if (error.message.includes('ECONNREFUSED')) {
    console.error('Redis connection refused');
    // Implement fallback or circuit breaker
  } else {
    console.error(`Job production failed: ${error.message}`);
  }
}
```

## Best Practices

### 1. Use Descriptive Job Names

```typescript
// Good: Descriptive job names
await client.produce('order-events', 'order-created', data);
await client.produce('order-events', 'order-cancelled', data);

// Avoid: Generic job names
await client.produce('order-events', 'event', data);
```

### 2. Include Relevant Payload Data

```typescript
// Good: Include data needed for processing
await client.produce('order-events', 'order-created', {
  urn: 'order:12345',
  payload: {
    customerId: 'customer:789',
    total: 99.99,
    items: ['item:1', 'item:2'],
  },
});

// Avoid: Minimal data requiring additional lookups
await client.produce('order-events', 'order-created', {
  urn: 'order:12345',
});
```

### 3. Configure Appropriate Retry Limits

```typescript
// For critical operations: More retries
defaultJobOptions: {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 60000, // 1 minute
  },
}

// For non-critical operations: Fewer retries
defaultJobOptions: {
  attempts: 2,
  backoff: {
    type: 'fixed',
    delay: 10000, // 10 seconds
  },
}
```

### 4. Monitor Dead Letter Queues

```typescript
// Set up monitoring for DLQ
@Cron('0 */5 * * * *') // Every 5 minutes
async monitorDLQ() {
  const dlqJobs = await this.dlqMonitor.getFailedJobs();
  
  if (dlqJobs.length > 10) {
    // Alert: Too many failed jobs
    await this.alertService.send({
      message: `${dlqJobs.length} jobs in DLQ`,
      severity: 'warning',
    });
  }
}
```

### 5. Use Health Checks

```typescript
// Implement readiness and liveness probes
@Get('health/live')
async liveness() {
  return { status: 'ok' };
}

@Get('health/ready')
async readiness() {
  const bullmqHealthy = await this.bullmqClient.isHealthy();
  
  if (!bullmqHealthy) {
    throw new ServiceUnavailableException('BullMQ not ready');
  }
  
  return { status: 'ready' };
}
```

### 6. Clean Up Completed Jobs

```typescript
// Configure automatic cleanup
defaultJobOptions: {
  removeOnComplete: 1000,  // Keep last 1000 completed jobs
  removeOnFail: 5000,      // Keep last 5000 failed jobs
}

// Or manually clean up periodically
@Cron('0 0 * * *') // Daily at midnight
async cleanupJobs() {
  const queue = new Queue('order-events', { connection });
  await queue.clean(24 * 3600 * 1000, 1000, 'completed'); // Clean completed jobs older than 24h
  await queue.close();
}
```

### 7. Use Type Safety

```typescript
// Define payload types
interface OrderCreatedPayload {
  customerId: string;
  items: string[];
  total: number;
}

// Use typed produce
await client.produce<OrderCreatedPayload>(
  'order-events',
  'order-created',
  {
    urn: 'order:12345',
    payload: {
      customerId: 'customer:789',
      items: ['item:1'],
      total: 99.99,
    },
  }
);

// TypeScript will catch errors
await client.produce<OrderCreatedPayload>(
  'order-events',
  'order-created',
  {
    urn: 'order:12345',
    payload: {
      customerId: 'customer:789',
      // Error: missing 'items' and 'total'
    },
  }
);
```

### 8. Graceful Shutdown

```typescript
// NestJS handles this automatically, but for manual shutdown:
async onApplicationShutdown(signal?: string) {
  console.log(`Received shutdown signal: ${signal}`);
  
  // BullMQClient.onModuleDestroy() is called automatically
  // Workers will complete in-flight jobs before shutting down
  
  // Wait for workers to finish (optional)
  await new Promise(resolve => setTimeout(resolve, 5000));
}
```

---

For more information, see:
- [BullMQ Documentation](https://docs.bullmq.io/)
- [NestJS Workflow Library README](../README.md)
- [Migration Guide](./MIGRATION_KAFKA_TO_BULLMQ.md)
