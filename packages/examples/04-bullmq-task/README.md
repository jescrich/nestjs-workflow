# BullMQ Task Workflow Example

This example demonstrates how to use **BullMQ** as a messaging backend for the NestJS Workflow Library. BullMQ is a Redis-based queue system that provides reliable message processing with features like job retries, priorities, and delayed jobs.

## Overview

This example shows a task management workflow where state transitions are triggered by BullMQ jobs. It demonstrates:

- Configuring BullMQ as an alternative to Kafka
- Producing jobs to BullMQ queues
- Consuming jobs with automatic retry logic
- Dead letter queue for failed jobs
- Health monitoring and graceful shutdown

## Prerequisites

### 1. Redis Server

BullMQ requires Redis to be running. You can start Redis using Docker or install it locally.

#### Using Docker (Recommended)
```bash
docker run -d -p 6379:6379 --name redis redis:alpine
```

#### Using Homebrew (macOS)
```bash
brew install redis
brew services start redis
```

#### Using apt (Ubuntu/Debian)
```bash
sudo apt-get install redis-server
sudo systemctl start redis-server
```

### 2. Verify Redis is Running
```bash
redis-cli ping
# Should return: PONG
```

## Installation

```bash
# Install dependencies
npm install
# or
yarn install
```

## Running the Example

### Interactive Demo
```bash
npm run demo
# or
yarn demo
```

The demo will:
1. Check Redis connection health
2. Create tasks and trigger workflow transitions via BullMQ
3. Demonstrate happy path, rejection, and cancellation scenarios
4. Show batch event processing
5. Display workflow state transitions with colored output

### Start the Application
```bash
npm run start:dev
# or
yarn start:dev
```

The application will start on `http://localhost:3000` with BullMQ workers listening to configured queues.

## Project Structure

```
04-bullmq-task/
├── src/
│   ├── demo/
│   │   ├── demo.ts              # Interactive demo script
│   │   ├── demo.visualizer.ts   # Visualization utilities
│   │   └── README.md            # Demo documentation
│   ├── task.entity.ts           # Task entity and enums
│   ├── task.entity.service.ts   # In-memory task repository
│   ├── task.workflow.ts         # Workflow definition with BullMQ config
│   ├── task.module.ts           # NestJS module with BullMQ enabled
│   ├── task.service.ts          # Task business logic
│   ├── task.producer.service.ts # BullMQ job producer
│   ├── app.module.ts            # Root application module
│   └── main.ts                  # Application entry point
├── package.json
├── tsconfig.json
└── README.md
```

## Configuration

### BullMQ Configuration

The workflow is configured in `src/task.workflow.ts`:

```typescript
export const taskWorkflowDefinition: WorkflowDefinition<...> = {
  name: 'TaskWorkflow',
  entity: TaskEntityService,
  
  // ... states and transitions ...
  
  // BullMQ configuration
  bullmq: {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    },
    events: [
      { queue: 'task-start', event: TaskEvent.START },
      { queue: 'task-submit', event: TaskEvent.SUBMIT_FOR_REVIEW },
      { queue: 'task-approve', event: TaskEvent.APPROVE },
      { queue: 'task-reject', event: TaskEvent.REJECT },
      { queue: 'task-cancel', event: TaskEvent.CANCEL },
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
  },
};
```

### Module Registration

In `src/task.module.ts`, enable BullMQ:

```typescript
@Module({
  imports: [
    WorkflowModule.register({
      name: 'TaskWorkflow',
      definition: taskWorkflowDefinition,
      bullmq: {
        enabled: true,
        config: taskWorkflowDefinition.bullmq!,
      },
    }),
  ],
  // ...
})
export class TaskModule {}
```

### Environment Variables

Create a `.env` file (optional):

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
PORT=3000
```

## Workflow States and Transitions

```
TODO
  │
  │ START (assign to worker)
  ↓
IN_PROGRESS
  │
  │ SUBMIT_FOR_REVIEW (assign reviewer)
  ↓
IN_REVIEW ─REJECT→ back to IN_PROGRESS
  │
  │ APPROVE
  ↓
COMPLETED

Any state ─CANCEL→ CANCELLED
```

## Code Walkthrough

### 1. Producing Jobs to BullMQ

The `TaskProducerService` demonstrates how to emit workflow events via BullMQ:

```typescript
@Injectable()
export class TaskProducerService {
  constructor(private readonly bullmqClient: BullMQClient) {}

  async emitStartEvent(taskId: string, assignee: string): Promise<void> {
    const job = await this.bullmqClient.produce(
      'task-start',           // Queue name
      'task-start-job',       // Job name
      {
        urn: taskId,          // Entity identifier
        payload: { assignee } // Event payload
      }
    );
    console.log(`Job added: ${job.id}`);
  }
}
```

### 2. Consuming Jobs (Automatic)

BullMQ workers are automatically initialized by the `WorkflowService` based on the workflow definition. When a job is received:

1. Worker extracts the URN and payload from job data
2. Worker calls `workflowService.emit()` with the mapped event
3. Workflow engine processes the transition
4. If successful, job is marked as completed
5. If failed, BullMQ retries with exponential backoff
6. After max retries, job moves to dead letter queue

### 3. Retry Logic

Jobs automatically retry on failure:
- **Attempt 1**: Immediate
- **Attempt 2**: 30 seconds delay
- **Attempt 3**: 60 seconds delay (exponential backoff)
- **After 3 attempts**: Move to dead letter queue

### 4. Dead Letter Queue

Failed jobs are moved to a DLQ for investigation:
- DLQ queue name: `{original-queue}-dlq` (e.g., `task-start-dlq`)
- DLQ jobs include original data, error details, and metadata
- DLQ jobs are never removed automatically

### 5. Health Monitoring

Check BullMQ connection health:

```typescript
const isHealthy = await producerService.checkHealth();
if (!isHealthy) {
  console.error('Redis connection is unhealthy');
}
```

## Comparison with Kafka Example

| Feature | Kafka | BullMQ |
|---------|-------|--------|
| **Infrastructure** | Kafka + Zookeeper | Redis |
| **Setup Complexity** | High | Low |
| **Message Ordering** | Partition-level | Queue-level |
| **Retry Logic** | Manual | Built-in |
| **Dead Letter Queue** | Manual | Built-in |
| **Job Priorities** | No | Yes |
| **Delayed Jobs** | No | Yes |
| **Job Tracking** | Manual | Built-in (job IDs) |
| **Throughput** | Very high | High |
| **Latency** | Low | Very low |
| **Best For** | High-volume, distributed systems | Simpler setups, job queues |

## Migration from Kafka to BullMQ

### Step 1: Update Workflow Definition

**Before (Kafka):**
```typescript
kafka: {
  brokers: 'localhost:9092',
  events: [
    { topic: 'task-events', event: TaskEvent.START }
  ]
}
```

**After (BullMQ):**
```typescript
bullmq: {
  connection: {
    host: 'localhost',
    port: 6379
  },
  events: [
    { queue: 'task-start', event: TaskEvent.START }
  ],
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30000 }
  },
  deadLetterQueue: { enabled: true }
}
```

### Step 2: Update Module Registration

**Before (Kafka):**
```typescript
WorkflowModule.register({
  name: 'TaskWorkflow',
  definition: taskWorkflowDefinition,
  kafka: {
    enabled: true,
    clientId: 'task-service',
    brokers: 'localhost:9092'
  }
})
```

**After (BullMQ):**
```typescript
WorkflowModule.register({
  name: 'TaskWorkflow',
  definition: taskWorkflowDefinition,
  bullmq: {
    enabled: true,
    config: taskWorkflowDefinition.bullmq!
  }
})
```

### Step 3: Update Event Producers

**Before (Kafka):**
```typescript
await kafkaClient.produce('task-events', taskId, eventData);
```

**After (BullMQ):**
```typescript
await bullmqClient.produce('task-start', 'task-start-job', {
  urn: taskId,
  payload: eventData
});
```

### Step 4: Install Dependencies

```bash
# Remove Kafka dependencies
npm uninstall kafkajs

# Add BullMQ dependencies
npm install bullmq ioredis
```

### Step 5: Update Infrastructure

- **Remove**: Kafka and Zookeeper
- **Add**: Redis server

## Troubleshooting

### Redis Connection Failed

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution:**
- Ensure Redis is running: `redis-cli ping`
- Check Redis host/port configuration
- Verify firewall settings

### Jobs Not Processing

**Symptoms:**
- Jobs added to queue but not processed
- No worker log messages

**Solution:**
- Check that BullMQ is enabled in module registration
- Verify workflow definition includes `bullmq` configuration
- Look for worker initialization logs:
  ```
  [WorkflowService] Initialized BullMQ worker for queue: task-start
  ```

### Jobs Failing Repeatedly

**Symptoms:**
- Jobs moving to dead letter queue
- Retry attempts exhausted

**Solution:**
- Check application logs for error details
- Verify entity exists before emitting events
- Ensure workflow conditions are met
- Inspect DLQ jobs for debugging:
  ```bash
  redis-cli
  > LRANGE bull:task-start-dlq:wait 0 -1
  ```

### High Memory Usage

**Symptoms:**
- Redis memory growing continuously

**Solution:**
- Configure job removal policies:
  ```typescript
  defaultJobOptions: {
    removeOnComplete: 1000,  // Keep last 1000 completed
    removeOnFail: 5000,      // Keep last 5000 failed
  }
  ```
- Monitor Redis memory: `redis-cli INFO memory`
- Set Redis maxmemory policy: `redis-cli CONFIG SET maxmemory-policy allkeys-lru`

## Monitoring

### Using Redis CLI

```bash
# List all keys
redis-cli KEYS "*"

# Check queue length
redis-cli LLEN bull:task-start:wait

# View waiting jobs
redis-cli LRANGE bull:task-start:wait 0 -1

# Check failed jobs
redis-cli LLEN bull:task-start:failed

# Monitor commands in real-time
redis-cli MONITOR
```

### Using BullMQ Board (Optional)

Install BullMQ Board for a web UI:

```bash
npm install -g @bull-board/cli
bull-board
```

Then open `http://localhost:3000/admin/queues` to view queue status.

## Best Practices

1. **Job Idempotency**: Ensure job handlers can be safely retried
2. **Error Handling**: Catch and log errors appropriately
3. **Job Timeouts**: Set reasonable timeouts for long-running jobs
4. **Queue Naming**: Use descriptive, consistent queue names
5. **Monitoring**: Monitor queue depth and job failure rates
6. **DLQ Management**: Regularly review and process DLQ jobs
7. **Resource Cleanup**: Configure job removal policies
8. **Health Checks**: Implement health check endpoints

## Next Steps

- Explore the [demo](src/demo/README.md) for detailed scenarios
- Review the [design document](../../.kiro/specs/bullmq-messaging-adapter/design.md)
- Check out other examples in the `examples/` directory
- Read the [main library documentation](../../README.md)

## Resources

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Redis Documentation](https://redis.io/documentation)
- [NestJS Workflow Library](https://github.com/jescrich/nestjs-workflow)

## License

MIT
