import { RedisMemoryServer } from 'redis-memory-server';
import { BullMQClient } from '@this/workflow/bullmq/client';
import { BullMQConfig, WorkflowJobData } from '@this/workflow/definition';
import { Queue, Worker, Job } from 'bullmq';

/**
 * Redis test environment manager
 */
export class RedisTestEnvironment {
  private redisServer: RedisMemoryServer | null = null;
  private bullmqClients: BullMQClient[] = [];
  private queues: Queue[] = [];
  private workers: Worker[] = [];

  /**
   * Start Redis memory server and return connection config
   */
  async start(): Promise<{ host: string; port: number }> {
    this.redisServer = new RedisMemoryServer();
    const host = await this.redisServer.getHost();
    const port = await this.redisServer.getPort();
    return { host, port };
  }

  /**
   * Stop Redis memory server and cleanup all resources
   */
  async stop(): Promise<void> {
    // Close all workers
    await Promise.all(this.workers.map((worker) => worker.close().catch(() => {})));
    this.workers = [];

    // Close all queues
    await Promise.all(this.queues.map((queue) => queue.close().catch(() => {})));
    this.queues = [];

    // Destroy all BullMQ clients
    await Promise.all(this.bullmqClients.map((client) => client.onModuleDestroy().catch(() => {})));
    this.bullmqClients = [];

    // Stop Redis server
    if (this.redisServer) {
      await this.redisServer.stop();
      this.redisServer = null;
    }
  }

  /**
   * Create a BullMQ client with test configuration
   */
  createBullMQClient(config: Partial<BullMQConfig>, connection: { host: string; port: number }): BullMQClient {
    const fullConfig: BullMQConfig = {
      connection,
      events: config.events || [],
      defaultJobOptions: config.defaultJobOptions || {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000, // Shorter delay for tests
        },
      },
      deadLetterQueue: config.deadLetterQueue || {
        enabled: true,
        suffix: '-dlq',
      },
    };

    const client = new BullMQClient(fullConfig);
    this.bullmqClients.push(client);
    return client;
  }

  /**
   * Create a queue for testing
   */
  createQueue<T = any>(name: string, connection: { host: string; port: number }): Queue<T> {
    const queue = new Queue<T>(name, { connection });
    this.queues.push(queue);
    return queue;
  }

  /**
   * Create a worker for testing
   */
  createWorker<T = any>(
    name: string,
    processor: (job: Job<T>) => Promise<void>,
    connection: { host: string; port: number },
  ): Worker<T> {
    const worker = new Worker<T>(name, processor, { connection });
    this.workers.push(worker);
    return worker;
  }

  /**
   * Wait for a job to be processed
   */
  async waitForJobCompletion(queue: Queue, jobId: string, timeoutMs: number = 5000): Promise<Job> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const job = await queue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        if (state === 'completed' || state === 'failed') {
          return job;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Job ${jobId} did not complete within ${timeoutMs}ms`);
  }

  /**
   * Wait for a specific number of jobs to be completed
   */
  async waitForJobCount(queue: Queue, count: number, timeoutMs: number = 5000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const completedCount = await queue.getCompletedCount();
      if (completedCount >= count) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Expected ${count} jobs to complete within ${timeoutMs}ms`);
  }

  /**
   * Get all jobs in a queue by state
   */
  async getJobsByState(queue: Queue, state: 'completed' | 'failed' | 'active' | 'waiting' | 'delayed'): Promise<Job[]> {
    switch (state) {
      case 'completed':
        return queue.getCompleted();
      case 'failed':
        return queue.getFailed();
      case 'active':
        return queue.getActive();
      case 'waiting':
        return queue.getWaiting();
      case 'delayed':
        return queue.getDelayed();
      default:
        return [];
    }
  }

  /**
   * Clear all jobs from a queue
   */
  async clearQueue(queue: Queue): Promise<void> {
    await queue.drain();
    await queue.clean(0, 1000, 'completed');
    await queue.clean(0, 1000, 'failed');
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics(queue: Queue): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }
}

/**
 * Helper function to create test job data
 */
export function createTestJobData<T = any>(urn: string, payload?: T): WorkflowJobData<T> {
  return {
    urn,
    payload,
  };
}

/**
 * Helper function to wait for a condition with timeout
 */
export async function waitForCondition(
  condition: () => Promise<boolean> | boolean,
  timeoutMs: number = 5000,
  checkIntervalMs: number = 100,
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
  }
  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

/**
 * Helper function to create a mock entity for testing
 */
export function createMockEntity<T>(urn: string, status: any, additionalProps?: Partial<T>): T {
  return {
    urn,
    status,
    ...additionalProps,
  } as T;
}
