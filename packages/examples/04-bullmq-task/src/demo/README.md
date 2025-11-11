# BullMQ Task Workflow Demo

This demo showcases the BullMQ integration with the NestJS Workflow Library.

## What This Demo Demonstrates

- **BullMQ Integration**: How to configure and use BullMQ as a messaging backend for workflows
- **Asynchronous Event Processing**: Workflow transitions triggered by BullMQ jobs
- **Job Retry Logic**: Automatic retry with exponential backoff for failed jobs
- **Dead Letter Queue**: Failed jobs moved to DLQ after exceeding retry limit
- **Health Monitoring**: Redis connection health checks
- **Batch Operations**: Efficient processing of multiple events

## Prerequisites

1. **Redis Server**: BullMQ requires Redis to be running
   ```bash
   # Using Docker
   docker run -d -p 6379:6379 redis:alpine
   
   # Or using Homebrew (macOS)
   brew install redis
   brew services start redis
   ```

2. **Node.js Dependencies**: Install the example dependencies
   ```bash
   npm install
   # or
   yarn install
   ```

## Running the Demo

```bash
npm run demo
# or
yarn demo
```

## Demo Scenarios

### Scenario 1: Happy Path - Complete Task
- Create a new task
- Start the task (assign to Alice)
- Submit for review (assign reviewer Bob)
- Approve the task
- Task reaches COMPLETED state

### Scenario 2: Task Rejection and Rework
- Create a task
- Start and submit for review
- Reject the task with feedback
- Task returns to IN_PROGRESS state for rework

### Scenario 3: Task Cancellation
- Create a task
- Start working on it
- Cancel the task with a reason
- Task moves to CANCELLED state

### Scenario 4: Batch Operations
- Create multiple tasks
- Emit START events for all tasks in batch
- Demonstrate efficient batch processing

## Configuration

The workflow is configured in `src/task.workflow.ts`:

```typescript
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
  },
  deadLetterQueue: {
    enabled: true,
    suffix: '-dlq',
  },
}
```

## Environment Variables

- `REDIS_HOST`: Redis server host (default: localhost)
- `REDIS_PORT`: Redis server port (default: 6379)
- `REDIS_PASSWORD`: Redis password (optional)

## Understanding the Output

The demo uses colored output to visualize:
- 📋 Task details and state
- 🔄 Workflow transitions
- 📦 BullMQ job operations
- 🏥 Health check status
- ✅ Success messages
- ⚠️  Warnings
- ❌ Errors

## Key Components

### TaskProducerService
Produces jobs to BullMQ queues to trigger workflow events:
- `emitStartEvent()`: Start a task
- `emitSubmitForReviewEvent()`: Submit for review
- `emitApproveEvent()`: Approve a task
- `emitRejectEvent()`: Reject a task
- `emitCancelEvent()`: Cancel a task
- `checkHealth()`: Check BullMQ connection health

### BullMQ Workers
Automatically initialized by WorkflowService:
- Listen to configured queues
- Process jobs and trigger workflow transitions
- Handle retries with exponential backoff
- Move failed jobs to dead letter queue

## Troubleshooting

### Redis Connection Failed
```
⚠ Redis connection is not healthy
```
**Solution**: Make sure Redis is running on localhost:6379

### Jobs Not Processing
**Solution**: Check that BullMQ workers are initialized. Look for log messages:
```
[WorkflowService] Initialized BullMQ worker for queue: task-start
```

### Jobs Stuck in Queue
**Solution**: Check Redis memory and ensure workers are running. Use Redis CLI:
```bash
redis-cli
> KEYS *
> LLEN bull:task-start:wait
```

## Next Steps

- Explore the source code in `src/`
- Modify the workflow definition to add new states/transitions
- Add custom job options for specific events
- Implement error scenarios to test retry and DLQ behavior
- Monitor queues using BullMQ Board or Redis CLI
