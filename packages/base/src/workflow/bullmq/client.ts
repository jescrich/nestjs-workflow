import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, Job, ConnectionOptions, JobsOptions, WorkerOptions } from 'bullmq';
import { BullMQConfig, WorkflowJobData, DLQJobData } from '../definition';

@Injectable()
export class BullMQClient implements OnModuleDestroy {
  private readonly logger = new Logger(BullMQClient.name);
  private readonly queues: Map<string, Queue> = new Map();
  private readonly workers: Map<string, Worker> = new Map();
  private readonly connection: ConnectionOptions;
  private readonly defaultJobOptions: JobsOptions;
  private readonly dlqConfig: { enabled: boolean; suffix: string };

  constructor(config: BullMQConfig) {
    // Initialize connection options from config
    this.connection = {
      host: config.connection.host,
      port: config.connection.port,
      password: config.connection.password,
      db: config.connection.db,
      tls: config.connection.tls,
    };

    // Initialize default job options with retry and backoff settings
    this.defaultJobOptions = {
      attempts: config.defaultJobOptions?.attempts ?? 3,
      backoff: config.defaultJobOptions?.backoff ?? {
        type: 'exponential',
        delay: 30000, // 30 seconds base delay
      },
      removeOnComplete: config.defaultJobOptions?.removeOnComplete ?? 1000,
      removeOnFail: config.defaultJobOptions?.removeOnFail ?? 5000,
    };

    // Initialize dead letter queue configuration
    this.dlqConfig = {
      enabled: config.deadLetterQueue?.enabled ?? false,
      suffix: config.deadLetterQueue?.suffix ?? '-dlq',
    };

    this.logger.log(
      `BullMQ client initialized with connection ${this.connection.host}:${this.connection.port}`,
    );
  }

  /**
   * Produce a job to a BullMQ queue
   */
  async produce<T>(
    queueName: string,
    jobName: string,
    data: WorkflowJobData<T>,
  ): Promise<Job<WorkflowJobData<T>>> {
    try {
      const queue = this.getOrCreateQueue<WorkflowJobData<T>>(queueName);

      const job = await queue.add(jobName, data, {
        ...this.defaultJobOptions,
        jobId: `${jobName}-${data.urn}-${Date.now()}`, // Unique job ID
      });

      this.logger.log(`Job added to queue`, queueName, job.id, data.urn);
      return job;
    } catch (error) {
      this.logger.error(`Error adding job to queue: ${error.message}`, queueName, data.urn);
      throw new Error(`Failed to add job to queue ${queueName}: ${error.message}`);
    }
  }

  /**
   * Consume jobs from a BullMQ queue
   */
  async consume<T>(
    queueName: string,
    handler: (job: Job<WorkflowJobData<T>>) => Promise<void>,
    options?: WorkerOptions,
  ): Promise<Worker<WorkflowJobData<T>>> {
    const worker = new Worker<WorkflowJobData<T>>(
      queueName,
      async (job: Job<WorkflowJobData<T>>) => {
        const urn = job.data.urn;
        this.logger.log(`Processing job`, job.id, queueName, urn);

        try {
          await handler(job);
          this.logger.log(`Job processed successfully`, job.id, queueName, urn);
        } catch (error) {
          const maxAttempts = job.opts.attempts || this.defaultJobOptions.attempts || 3;
          const currentAttempt = job.attemptsMade + 1; // attemptsMade is 0-indexed, so add 1 for display
          
          this.logger.error(
            `Job processing failed (attempt ${currentAttempt}/${maxAttempts}): ${error.message}`,
            job.id,
            queueName,
            urn,
          );

          // Check if this is the last attempt
          if (job.attemptsMade >= maxAttempts) {
            this.logger.warn(`Job exceeded retry limit`, job.id, queueName, urn);

            if (this.dlqConfig.enabled) {
              await this.sendToDeadLetterQueue(job, error);
            }
          } else {
            this.logger.log(`Retrying job (attempt ${currentAttempt + 1}/${maxAttempts})`, job.id, queueName, urn);
          }

          throw error; // Re-throw to let BullMQ handle retry
        }
      },
      {
        connection: this.connection,
        ...options,
      },
    );

    this.workers.set(queueName, worker);
    this.logger.log(`Worker initialized`, queueName);

    return worker;
  }

  /**
   * Check if the BullMQ client is healthy by pinging Redis
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Create a temporary queue to test Redis connection
      const testQueue = new Queue('health-check', {
        connection: this.connection,
      });

      const client = await testQueue.client;
      await client.ping();
      await testQueue.close();

      return true;
    } catch (error) {
      this.logger.error(`BullMQ health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Gracefully shutdown all workers and queues
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down BullMQ client...');

    // Close all workers
    const workerPromises = Array.from(this.workers.values()).map((worker) =>
      this.closeWorker(worker),
    );
    await Promise.all(workerPromises);

    // Close all queues
    const queuePromises = Array.from(this.queues.values()).map((queue) =>
      this.closeQueue(queue),
    );
    await Promise.all(queuePromises);

    this.logger.log('BullMQ client shutdown complete');
  }

  /**
   * Get or create a queue instance
   */
  private getOrCreateQueue<T>(queueName: string): Queue<T> {
    if (!this.queues.has(queueName)) {
      const queue = new Queue<T>(queueName, {
        connection: this.connection,
      });
      this.queues.set(queueName, queue as Queue);
    }
    return this.queues.get(queueName) as Queue<T>;
  }

  /**
   * Send a failed job to the dead letter queue
   */
  private async sendToDeadLetterQueue<T>(job: Job<WorkflowJobData<T>>, error: Error): Promise<void> {
    try {
      const dlqName = `${job.queueName}${this.dlqConfig.suffix}`;
      const dlqQueue = this.getOrCreateQueue<DLQJobData<T>>(dlqName);

      const dlqData: DLQJobData<T> = {
        originalJobId: job.id!,
        originalJobName: job.name,
        originalData: job.data,
        error: {
          message: error.message,
          stack: error.stack,
        },
        failedAt: new Date().toISOString(),
        attemptsMade: job.attemptsMade,
      };

      await dlqQueue.add(`${job.name}-failed`, dlqData, {
        removeOnComplete: false, // Keep DLQ jobs for investigation
        removeOnFail: false,
      });

      this.logger.warn(`Job sent to DLQ`, job.id, dlqName);
    } catch (dlqError) {
      this.logger.error(`Failed to send job to DLQ: ${dlqError.message}`, job.id);
    }
  }

  /**
   * Gracefully close a worker
   */
  private async closeWorker(worker: Worker): Promise<void> {
    try {
      this.logger.log(`Closing worker`, worker.name);
      await worker.close();
      this.logger.log(`Worker closed`, worker.name);
    } catch (error) {
      this.logger.error(`Error closing worker: ${error.message}`, worker.name);
    }
  }

  /**
   * Close a queue connection
   */
  private async closeQueue(queue: Queue): Promise<void> {
    try {
      this.logger.log(`Closing queue`, queue.name);
      await queue.close();
      this.logger.log(`Queue closed`, queue.name);
    } catch (error) {
      this.logger.error(`Error closing queue: ${error.message}`, queue.name);
    }
  }
}
