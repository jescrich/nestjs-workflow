# BullMQ Troubleshooting Guide

This guide helps you diagnose and resolve common issues when using the BullMQ integration with the NestJS Workflow Library.

## Table of Contents

- [Redis Connection Issues](#redis-connection-issues)
- [Job Processing Failures](#job-processing-failures)
- [Retry and Dead Letter Queue Behavior](#retry-and-dead-letter-queue-behavior)
- [Health Check Monitoring](#health-check-monitoring)
- [Performance Issues](#performance-issues)
- [Common Error Messages](#common-error-messages)
- [Debugging Tips](#debugging-tips)

## Redis Connection Issues

### Problem: Cannot Connect to Redis

**Symptoms:**
- Application fails to start with connection errors
- Health checks return `false`
- Error messages like `ECONNREFUSED` or `Connection timeout`

**Common Causes:**

1. **Redis is not running**
   ```bash
   # Check if Redis is running
   redis-cli ping
   # Should return: PONG
   ```

2. **Incorrect host or port**
   ```typescript
   // Verify your configuration
   bullmq: {
     connection: {
       host: 'localhost',  // Check this matches your Redis host
       port: 6379,         // Check this matches your Redis port
     }
   }
   ```

3. **Firewall blocking connection**
   ```bash
   # Test connectivity
   telnet localhost 6379
   # Or
   nc -zv localhost 6379
   ```

**Solutions:**


**Start Redis:**
```bash
# macOS (Homebrew)
brew services start redis

# Linux (systemd)
sudo systemctl start redis

# Docker
docker run -d -p 6379:6379 redis:latest

# Docker Compose
docker-compose up -d redis
```

**Verify Configuration:**
```typescript
// Add logging to verify connection settings
const config: BullMQConfig = {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  // ... rest of config
};

console.log('BullMQ connecting to:', config.connection);
```

**Test Connection Manually:**
```typescript
import { Queue } from 'bullmq';

async function testConnection() {
  const testQueue = new Queue('test', {
    connection: {
      host: 'localhost',
      port: 6379,
    },
  });

  try {
    await testQueue.client.ping();
    console.log('✓ Redis connection successful');
  } catch (error) {
    console.error('✗ Redis connection failed:', error.message);
  } finally {
    await testQueue.close();
  }
}
```

### Problem: Authentication Failed

**Symptoms:**
- Error: `NOAUTH Authentication required`
- Error: `ERR invalid password`

**Solution:**
```typescript
bullmq: {
  connection: {
    host: 'localhost',
    port: 6379,
    password: process.env.REDIS_PASSWORD, // Add password
  }
}
```

**Verify Redis Password:**
```bash
# Test authentication
redis-cli -h localhost -p 6379 -a your-password ping
```

### Problem: TLS/SSL Connection Issues

**Symptoms:**
- Error: `SSL routines:ssl3_get_record:wrong version number`
- Connection works locally but fails in production

**Solution:**
```typescript
bullmq: {
  connection: {
    host: 'your-redis-host.com',
    port: 6380,
    password: process.env.REDIS_PASSWORD,
    tls: {
      rejectUnauthorized: true, // Set to false for self-signed certs (not recommended for production)
    },
  }
}
```

### Problem: Connection Pool Exhausted

**Symptoms:**
- Error: `ReplyError: ERR max number of clients reached`
- Application becomes unresponsive

**Solution:**
```bash
# Check current connections
redis-cli CLIENT LIST | wc -l

# Increase max clients in redis.conf
maxclients 10000
```

**Optimize Connection Usage:**
```typescript
// Ensure proper cleanup
async onModuleDestroy() {
  await this.bullmqClient.onModuleDestroy();
}

// Reuse queue instances (BullMQClient does this automatically)
```

### Problem: Redis Memory Issues

**Symptoms:**
- Error: `OOM command not allowed when used memory > 'maxmemory'`
- Jobs not being added to queues

**Solution:**
```bash
# Check Redis memory usage
redis-cli INFO memory

# Configure maxmemory policy in redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
```

**Configure Job Cleanup:**
```typescript
bullmq: {
  defaultJobOptions: {
    removeOnComplete: 1000,  // Keep only last 1000 completed jobs
    removeOnFail: 5000,      // Keep only last 5000 failed jobs
  }
}
```

## Job Processing Failures

### Problem: Jobs Stuck in Active State

**Symptoms:**
- Jobs show as "active" but never complete
- Workers appear to be processing but no progress

**Diagnosis:**
```typescript
import { Queue } from 'bullmq';

async function checkStuckJobs() {
  const queue = new Queue('your-queue-name', { connection });
  
  const activeJobs = await queue.getActive();
  console.log(`Active jobs: ${activeJobs.length}`);
  
  for (const job of activeJobs) {
    console.log(`Job ${job.id}:`, {
      name: job.name,
      data: job.data,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    });
  }
  
  await queue.close();
}
```

**Solutions:**

1. **Worker crashed without cleanup:**
   ```bash
   # Clean stalled jobs
   redis-cli KEYS "bull:your-queue-name:*:lock" | xargs redis-cli DEL
   ```

2. **Increase stalled job check interval:**
   ```typescript
   await client.consume(
     'your-queue',
     handler,
     {
       stalledInterval: 30000, // Check for stalled jobs every 30s
       maxStalledCount: 2,     // Move to failed after 2 stalled checks
     }
   );
   ```

3. **Add timeout to job processing:**
   ```typescript
   await client.consume('your-queue', async (job) => {
     // Add timeout
     const timeoutPromise = new Promise((_, reject) =>
       setTimeout(() => reject(new Error('Job timeout')), 60000)
     );
     
     await Promise.race([
       processJob(job.data),
       timeoutPromise,
     ]);
   });
   ```

### Problem: Jobs Failing Immediately

**Symptoms:**
- All jobs fail on first attempt
- No retry attempts

**Diagnosis:**
```typescript
// Add detailed error logging
await client.consume('your-queue', async (job) => {
  try {
    console.log(`Processing job ${job.id}:`, job.data);
    await processJob(job.data);
    console.log(`Job ${job.id} completed successfully`);
  } catch (error) {
    console.error(`Job ${job.id} failed:`, {
      message: error.message,
      stack: error.stack,
      jobData: job.data,
    });
    throw error; // Re-throw to trigger retry
  }
});
```

**Common Causes:**

1. **Entity not found:**
   ```typescript
   // Add validation
   entity: {
     load: async (urn: string) => {
       const entity = await repository.findOne(urn);
       if (!entity) {
         throw new Error(`Entity not found: ${urn}`);
       }
       return entity;
     }
   }
   ```

2. **Invalid job data:**
   ```typescript
   // Validate job data
   await client.consume('your-queue', async (job) => {
     if (!job.data.urn) {
       throw new Error('Missing required field: urn');
     }
     
     // Process job
   });
   ```

3. **Synchronous errors in async handlers:**
   ```typescript
   // Bad: Synchronous error
   await client.consume('your-queue', async (job) => {
     throw new Error('This fails immediately');
   });
   
   // Good: Proper async error handling
   await client.consume('your-queue', async (job) => {
     try {
       await processJob(job.data);
     } catch (error) {
       // Log and re-throw
       console.error('Processing failed:', error);
       throw error;
     }
   });
   ```

### Problem: Workflow Transitions Not Triggering

**Symptoms:**
- Jobs are processed successfully
- No workflow state changes occur

**Diagnosis:**
```typescript
// Add logging to workflow service
await this.workflowService.emit({
  event: OrderEvent.Created,
  urn: 'order:123',
  payload: data,
});

// Check if event is defined in workflow
console.log('Workflow transitions:', this.definition.transitions);
```

**Solutions:**

1. **Verify event mapping:**
   ```typescript
   bullmq: {
     events: [
       { 
         queue: 'order-events', 
         event: OrderEvent.Created  // Must match workflow transition event
       }
     ]
   }
   ```

2. **Check transition conditions:**
   ```typescript
   transitions: [
     {
       from: OrderStatus.Pending,
       to: OrderStatus.Processing,
       event: OrderEvent.Created,
       conditions: [
         (entity, payload) => {
           console.log('Checking condition:', { entity, payload });
           return entity.price > 10; // Ensure condition is met
         }
       ],
     }
   ]
   ```

3. **Verify entity state:**
   ```typescript
   // Ensure entity is in correct state for transition
   const entity = await entityService.load(urn);
   console.log('Current entity state:', entity.status);
   console.log('Expected state:', OrderStatus.Pending);
   ```

## Retry and Dead Letter Queue Behavior

### Understanding Retry Behavior

**Default Retry Configuration:**
```typescript
defaultJobOptions: {
  attempts: 3,              // Total attempts (1 initial + 2 retries)
  backoff: {
    type: 'exponential',    // Delay doubles each retry
    delay: 30000,           // 30 seconds base delay
  }
}
```

**Retry Schedule:**
- **Attempt 1**: Immediate (initial attempt)
- **Attempt 2**: 30 seconds delay (30000ms)
- **Attempt 3**: 60 seconds delay (30000ms × 2)
- **After 3 attempts**: Moved to Dead Letter Queue

### Problem: Jobs Not Retrying

**Symptoms:**
- Jobs fail once and move to DLQ immediately
- No retry attempts logged

**Diagnosis:**
```typescript
// Check job options
const queue = new Queue('your-queue', { connection });
const job = await queue.getJob('job-id');
console.log('Job options:', job.opts);
```

**Solutions:**

1. **Verify retry configuration:**
   ```typescript
   bullmq: {
     defaultJobOptions: {
       attempts: 3,  // Ensure this is set
       backoff: {
         type: 'exponential',
         delay: 30000,
       }
     }
   }
   ```

2. **Check if error is being thrown:**
   ```typescript
   // Bad: Error not thrown
   await client.consume('your-queue', async (job) => {
     try {
       await processJob(job.data);
     } catch (error) {
       console.error(error);
       // Missing: throw error;
     }
   });
   
   // Good: Error thrown to trigger retry
   await client.consume('your-queue', async (job) => {
     try {
       await processJob(job.data);
     } catch (error) {
       console.error(error);
       throw error; // This triggers retry
     }
   });
   ```

### Problem: Too Many Retries

**Symptoms:**
- Jobs retry excessively
- System overloaded with retry attempts

**Solution:**
```typescript
// Reduce retry attempts for non-critical jobs
bullmq: {
  defaultJobOptions: {
    attempts: 2,  // Only 1 retry
    backoff: {
      type: 'fixed',
      delay: 10000, // 10 seconds
    }
  }
}

// Or configure per-queue
await client.consume(
  'non-critical-queue',
  handler,
  {
    settings: {
      maxRetries: 1,
    }
  }
);
```

### Problem: Dead Letter Queue Not Working

**Symptoms:**
- Failed jobs disappear instead of moving to DLQ
- DLQ is empty despite job failures

**Diagnosis:**
```typescript
// Check DLQ configuration
console.log('DLQ config:', config.deadLetterQueue);

// Check if DLQ queue exists
const dlqQueue = new Queue('your-queue-dlq', { connection });
const dlqJobs = await dlqQueue.getJobs(['waiting', 'active', 'completed', 'failed']);
console.log(`DLQ jobs: ${dlqJobs.length}`);
```

**Solutions:**

1. **Enable DLQ:**
   ```typescript
   bullmq: {
     deadLetterQueue: {
       enabled: true,  // Must be true
       suffix: '-dlq',
     }
   }
   ```

2. **Verify DLQ logic in consumer:**
   ```typescript
   // BullMQClient automatically handles DLQ
   // Ensure you're using the client's consume method
   await this.bullmqClient.consume('your-queue', handler);
   
   // Not: Creating workers manually
   ```

### Monitoring Dead Letter Queue

**Check DLQ Size:**
```typescript
import { Queue } from 'bullmq';

async function monitorDLQ() {
  const dlqQueue = new Queue('order-events-dlq', { connection });
  
  const waiting = await dlqQueue.getWaitingCount();
  const failed = await dlqQueue.getFailedCount();
  
  console.log(`DLQ Status:`, {
    waiting,
    failed,
    total: waiting + failed,
  });
  
  if (waiting + failed > 100) {
    console.warn('⚠️  DLQ has too many jobs!');
  }
  
  await dlqQueue.close();
}

// Run periodically
setInterval(monitorDLQ, 60000); // Every minute
```

**Inspect Failed Jobs:**
```typescript
async function inspectDLQJobs() {
  const dlqQueue = new Queue('order-events-dlq', { connection });
  const jobs = await dlqQueue.getJobs(['waiting', 'failed'], 0, 10);
  
  for (const job of jobs) {
    const dlqData = job.data as DLQJobData;
    console.log(`Failed Job ${job.id}:`, {
      originalJobId: dlqData.originalJobId,
      urn: dlqData.originalData.urn,
      error: dlqData.error.message,
      failedAt: dlqData.failedAt,
      attempts: dlqData.attemptsMade,
    });
  }
  
  await dlqQueue.close();
}
```

**Retry Failed Jobs:**
```typescript
async function retryDLQJob(jobId: string) {
  const dlqQueue = new Queue('order-events-dlq', { connection });
  const job = await dlqQueue.getJob(jobId);
  
  if (!job) {
    throw new Error(`Job ${jobId} not found in DLQ`);
  }
  
  const dlqData = job.data as DLQJobData;
  
  // Re-add to original queue
  await this.bullmqClient.produce(
    'order-events',
    dlqData.originalJobName,
    dlqData.originalData
  );
  
  // Remove from DLQ
  await job.remove();
  await dlqQueue.close();
  
  console.log(`✓ Job ${jobId} retried`);
}
```

## Health Check Monitoring

### Implementing Health Checks

**Basic Health Check:**
```typescript
import { Controller, Get } from '@nestjs/common';
import { BullMQClient } from '@jescrich/nestjs-workflow';

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
}
```

**Detailed Health Check:**
```typescript
import { Queue } from 'bullmq';

@Get('health/detailed')
async detailedCheck() {
  const bullmqHealthy = await this.bullmqClient.isHealthy();
  
  // Check queue depths
  const queueStats = await this.getQueueStats();
  
  return {
    status: bullmqHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    bullmq: {
      connected: bullmqHealthy,
      queues: queueStats,
    },
  };
}

private async getQueueStats() {
  const queues = ['order-events', 'payment-events', 'shipping-events'];
  const stats = {};
  
  for (const queueName of queues) {
    const queue = new Queue(queueName, { connection: this.connection });
    
    try {
      stats[queueName] = {
        waiting: await queue.getWaitingCount(),
        active: await queue.getActiveCount(),
        completed: await queue.getCompletedCount(),
        failed: await queue.getFailedCount(),
      };
    } catch (error) {
      stats[queueName] = { error: error.message };
    } finally {
      await queue.close();
    }
  }
  
  return stats;
}
```

### Problem: Health Check Always Returns False

**Diagnosis:**
```typescript
async checkHealth() {
  try {
    const healthy = await this.bullmqClient.isHealthy();
    console.log('Health check result:', healthy);
    
    // Manual Redis ping
    const testQueue = new Queue('health-test', { connection });
    await testQueue.client.ping();
    console.log('✓ Manual Redis ping successful');
    await testQueue.close();
  } catch (error) {
    console.error('Health check failed:', error);
  }
}
```

**Solutions:**

1. **Check Redis connectivity:**
   ```bash
   redis-cli -h localhost -p 6379 ping
   ```

2. **Verify connection configuration:**
   ```typescript
   // Ensure connection config matches Redis server
   const config = {
     connection: {
       host: process.env.REDIS_HOST || 'localhost',
       port: parseInt(process.env.REDIS_PORT || '6379'),
     }
   };
   ```

3. **Check for connection pool issues:**
   ```typescript
   // Ensure proper cleanup
   async onModuleDestroy() {
     await this.bullmqClient.onModuleDestroy();
   }
   ```

### Monitoring Queue Depth

**Alert on High Queue Depth:**
```typescript
import { Cron } from '@nestjs/schedule';

@Injectable()
export class QueueMonitorService {
  @Cron('*/5 * * * *') // Every 5 minutes
  async monitorQueues() {
    const queue = new Queue('order-events', { connection });
    
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    
    if (waiting > 1000) {
      console.warn(`⚠️  High queue depth: ${waiting} jobs waiting`);
      // Send alert
      await this.alertService.send({
        message: `order-events queue has ${waiting} waiting jobs`,
        severity: 'warning',
      });
    }
    
    if (active > 100) {
      console.warn(`⚠️  Many active jobs: ${active} jobs processing`);
    }
    
    await queue.close();
  }
}
```

### Monitoring Worker Health

**Track Worker Status:**
```typescript
@Get('health/workers')
async workerHealth() {
  // BullMQ workers emit events
  const workerStats = {
    'order-events': {
      status: 'running',
      processed: 0,
      failed: 0,
    },
  };
  
  // Track in worker event handlers
  worker.on('completed', (job) => {
    workerStats['order-events'].processed++;
  });
  
  worker.on('failed', (job, err) => {
    workerStats['order-events'].failed++;
  });
  
  return workerStats;
}
```

## Performance Issues

### Problem: Slow Job Processing

**Diagnosis:**
```typescript
// Add timing logs
await client.consume('your-queue', async (job) => {
  const startTime = Date.now();
  
  try {
    await processJob(job.data);
    const duration = Date.now() - startTime;
    console.log(`Job ${job.id} processed in ${duration}ms`);
    
    if (duration > 5000) {
      console.warn(`⚠️  Slow job: ${duration}ms`);
    }
  } catch (error) {
    throw error;
  }
});
```

**Solutions:**

1. **Increase worker concurrency:**
   ```typescript
   await client.consume(
     'your-queue',
     handler,
     {
       concurrency: 10, // Process 10 jobs concurrently
     }
   );
   ```

2. **Optimize job processing:**
   ```typescript
   // Bad: Sequential processing
   for (const item of items) {
     await processItem(item);
   }
   
   // Good: Parallel processing
   await Promise.all(items.map(item => processItem(item)));
   ```

3. **Add rate limiting:**
   ```typescript
   await client.consume(
     'your-queue',
     handler,
     {
       limiter: {
         max: 100,      // Max 100 jobs
         duration: 1000, // per second
       }
     }
   );
   ```

### Problem: High Memory Usage

**Diagnosis:**
```bash
# Monitor Node.js memory
node --max-old-space-size=4096 dist/main.js

# Check Redis memory
redis-cli INFO memory
```

**Solutions:**

1. **Configure job cleanup:**
   ```typescript
   bullmq: {
     defaultJobOptions: {
       removeOnComplete: 100,  // Keep fewer completed jobs
       removeOnFail: 500,
     }
   }
   ```

2. **Reduce payload size:**
   ```typescript
   // Bad: Large payload
   await client.produce('queue', 'job', {
     urn: 'order:123',
     payload: {
       fullOrderData: largeObject, // Avoid large objects
     }
   });
   
   // Good: Minimal payload
   await client.produce('queue', 'job', {
     urn: 'order:123',
     payload: {
       orderId: '123', // Load full data in handler
     }
   });
   ```

3. **Clean up old jobs:**
   ```typescript
   import { Cron } from '@nestjs/schedule';
   
   @Cron('0 0 * * *') // Daily at midnight
   async cleanupJobs() {
     const queue = new Queue('order-events', { connection });
     
     // Remove completed jobs older than 24 hours
     await queue.clean(24 * 3600 * 1000, 1000, 'completed');
     
     // Remove failed jobs older than 7 days
     await queue.clean(7 * 24 * 3600 * 1000, 1000, 'failed');
     
     await queue.close();
   }
   ```

## Common Error Messages

### `ECONNREFUSED`

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Cause:** Redis server is not running or not accessible

**Solution:**
```bash
# Start Redis
brew services start redis  # macOS
sudo systemctl start redis # Linux
docker run -d -p 6379:6379 redis:latest # Docker
```

### `NOAUTH Authentication required`

**Error:**
```
ReplyError: NOAUTH Authentication required
```

**Cause:** Redis requires authentication but no password provided

**Solution:**
```typescript
bullmq: {
  connection: {
    host: 'localhost',
    port: 6379,
    password: process.env.REDIS_PASSWORD, // Add password
  }
}
```

### `ERR max number of clients reached`

**Error:**
```
ReplyError: ERR max number of clients reached
```

**Cause:** Too many Redis connections

**Solution:**
```bash
# Increase max clients in redis.conf
maxclients 10000

# Or restart Redis
redis-cli CONFIG SET maxclients 10000
```

### `OOM command not allowed`

**Error:**
```
ReplyError: OOM command not allowed when used memory > 'maxmemory'
```

**Cause:** Redis out of memory

**Solution:**
```bash
# Check memory usage
redis-cli INFO memory

# Increase maxmemory
redis-cli CONFIG SET maxmemory 2gb

# Configure eviction policy
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### `Job stalled more than allowable limit`

**Error:**
```
Error: Job stalled more than allowable limit
```

**Cause:** Worker crashed or job processing took too long

**Solution:**
```typescript
await client.consume(
  'your-queue',
  handler,
  {
    stalledInterval: 60000,  // Increase stalled check interval
    maxStalledCount: 3,      // Allow more stalled checks
  }
);
```

## Debugging Tips

### Enable Detailed Logging

**BullMQ Debug Logs:**
```bash
# Enable BullMQ debug logs
DEBUG=bull:* npm start
```

**Application Logging:**
```typescript
import { Logger } from '@nestjs/common';

const logger = new Logger('BullMQ');

// Log all job events
await client.consume('your-queue', async (job) => {
  logger.log(`Processing job ${job.id}`, job.data);
  
  try {
    await processJob(job.data);
    logger.log(`Job ${job.id} completed`);
  } catch (error) {
    logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
    throw error;
  }
});
```

### Inspect Redis Data

**View Queue Contents:**
```bash
# List all BullMQ keys
redis-cli KEYS "bull:*"

# View queue jobs
redis-cli LRANGE "bull:order-events:wait" 0 -1

# View job data
redis-cli HGETALL "bull:order-events:job-id"
```

### Monitor Job Flow

**Track Job Lifecycle:**
```typescript
const worker = await client.consume('your-queue', handler);

worker.on('active', (job) => {
  console.log(`Job ${job.id} started`);
});

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});

worker.on('stalled', (jobId) => {
  console.warn(`Job ${jobId} stalled`);
});
```

### Test Job Processing Locally

**Manual Job Testing:**
```typescript
// Create a test script
async function testJobProcessing() {
  const client = new BullMQClient(config);
  
  // Produce test job
  const job = await client.produce('test-queue', 'test-job', {
    urn: 'test:123',
    payload: { test: true },
  });
  
  console.log(`Created job ${job.id}`);
  
  // Wait for completion
  await job.waitUntilFinished(new QueueEvents('test-queue', { connection }));
  
  console.log('Job completed successfully');
}
```

### Use BullMQ Board for Visualization

**Install BullMQ Board:**
```bash
npm install @bull-board/api @bull-board/nestjs
```

**Setup Dashboard:**
```typescript
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

@Module({
  imports: [
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'order-events',
      adapter: BullMQAdapter,
    }),
  ],
})
export class AppModule {}
```

Access dashboard at: `http://localhost:3000/admin/queues`

### Debugging Workflow Transitions

**Add Transition Logging:**
```typescript
transitions: [
  {
    from: OrderStatus.Pending,
    to: OrderStatus.Processing,
    event: OrderEvent.Created,
    actions: [
      async (entity, payload) => {
        console.log('Transition executing:', {
          from: OrderStatus.Pending,
          to: OrderStatus.Processing,
          entity,
          payload,
        });
        return entity;
      }
    ],
  }
]
```

### Performance Profiling

**Profile Job Processing:**
```typescript
await client.consume('your-queue', async (job) => {
  const startTime = process.hrtime.bigint();
  
  await processJob(job.data);
  
  const endTime = process.hrtime.bigint();
  const duration = Number(endTime - startTime) / 1_000_000; // Convert to ms
  
  console.log(`Job ${job.id} took ${duration.toFixed(2)}ms`);
});
```

## Getting Help

If you're still experiencing issues:

1. **Check the logs:** Enable detailed logging and review error messages
2. **Verify configuration:** Double-check all connection settings and options
3. **Test components individually:** Isolate Redis, BullMQ, and workflow components
4. **Review documentation:** See [BullMQ API Documentation](./BULLMQ_API.md)
5. **Check BullMQ docs:** Visit [BullMQ Documentation](https://docs.bullmq.io/)
6. **Open an issue:** Report bugs on the GitHub repository

---

For more information:
- [BullMQ API Documentation](./BULLMQ_API.md)
- [NestJS Workflow Library README](../README.md)
- [BullMQ Official Documentation](https://docs.bullmq.io/)
