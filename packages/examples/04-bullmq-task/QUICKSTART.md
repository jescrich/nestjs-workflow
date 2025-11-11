# Quick Start Guide

Get up and running with the BullMQ Task Workflow example in 5 minutes!

## 1. Start Redis

```bash
docker run -d -p 6379:6379 --name redis redis:alpine
```

Verify Redis is running:
```bash
redis-cli ping
# Should return: PONG
```

## 2. Install Dependencies

```bash
cd base/examples/04-bullmq-task
npm install
```

## 3. Run the Demo

```bash
npm run demo
```

You'll see:
- ✅ Health check confirming Redis connection
- 📋 Task creation and state transitions
- 🔄 Workflow transitions triggered by BullMQ jobs
- 📦 Job processing with automatic retry
- 📊 Summary of all tasks and their states

## 4. What Just Happened?

The demo:
1. Created tasks in TODO state
2. Emitted events to BullMQ queues (task-start, task-submit, etc.)
3. BullMQ workers processed jobs and triggered workflow transitions
4. Tasks moved through states: TODO → IN_PROGRESS → IN_REVIEW → COMPLETED
5. Demonstrated rejection, cancellation, and batch operations

## 5. Explore the Code

Key files to review:
- `src/task.workflow.ts` - Workflow definition with BullMQ configuration
- `src/task.module.ts` - Module registration with BullMQ enabled
- `src/task.producer.service.ts` - How to produce jobs to BullMQ queues
- `src/demo/demo.ts` - Complete demo scenarios

## 6. Next Steps

- Read the [full README](README.md) for detailed documentation
- Modify the workflow to add new states/transitions
- Experiment with retry behavior by introducing errors
- Monitor queues using Redis CLI: `redis-cli KEYS "bull:*"`
- Check out the [demo README](src/demo/README.md) for more scenarios

## Common Commands

```bash
# Run the demo
npm run demo

# Start the application
npm run start:dev

# Build the application
npm run build

# Check Redis queues
redis-cli KEYS "bull:*"

# View queue length
redis-cli LLEN bull:task-start:wait

# Stop Redis container
docker stop redis
docker rm redis
```

## Troubleshooting

**Redis not running?**
```bash
docker ps  # Check if Redis container is running
docker start redis  # Start existing container
```

**Port 6379 already in use?**
```bash
# Use a different port
docker run -d -p 6380:6379 --name redis redis:alpine
# Update REDIS_PORT environment variable
export REDIS_PORT=6380
```

**Jobs not processing?**
- Check application logs for worker initialization messages
- Verify BullMQ configuration in task.workflow.ts
- Ensure Redis is accessible

## Learn More

- [Full Documentation](README.md)
- [Demo Scenarios](src/demo/README.md)
- [BullMQ Docs](https://docs.bullmq.io/)
