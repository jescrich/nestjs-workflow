import { WorkflowService } from '@this/workflow/service';
import { WorkflowDefinition } from '@this/workflow/definition';
import { BullMQClient } from '@this/workflow/bullmq/client';
import { RedisTestEnvironment, createTestJobData, waitForCondition } from './utils/redis-test-utils';
import { Queue } from 'bullmq';

enum TaskEvent {
  Start = 'task.start',
  Complete = 'task.complete',
}

enum TaskStatus {
  Pending = 'pending',
  InProgress = 'in-progress',
  Completed = 'completed',
  Failed = 'failed',
}

class Task {
  urn: string;
  name: string;
  status: TaskStatus;
  processCount?: number;
}

describe('BullMQ Error Scenario Tests', () => {
  let redisEnv: RedisTestEnvironment;
  let connection: { host: string; port: number };

  beforeAll(async () => {
    redisEnv = new RedisTestEnvironment();
    connection = await redisEnv.start();
  });

  afterAll(async () => {
    await redisEnv.stop();
  });

  describe('Retry behavior with transient failures', () => {
    it('should retry failed jobs with exponential backoff', async () => {
      const taskStore = new Map<string, Task>();
      const mockTask: Task = {
        urn: 'urn:task:retry-1',
        name: 'Retry Test Task',
        status: TaskStatus.Pending,
        processCount: 0,
      };
      taskStore.set(mockTask.urn, mockTask);

      let attemptCount = 0;

      const definition: WorkflowDefinition<Task, any, TaskEvent, TaskStatus> = {
        name: 'TaskWorkflow',
        states: {
          finals: [TaskStatus.Completed, TaskStatus.Failed],
          idles: [TaskStatus.Pending, TaskStatus.InProgress],
          failed: TaskStatus.Failed,
        },
        transitions: [
          {
            from: TaskStatus.Pending,
            to: TaskStatus.InProgress,
            event: TaskEvent.Start,
            actions: [async (entity: Task) => {
              attemptCount++;
              entity.processCount = attemptCount;
              
              // Fail first 2 attempts, succeed on 3rd
              if (attemptCount < 3) {
                throw new Error(`Transient failure on attempt ${attemptCount}`);
              }
              
              return entity;
            }],
          },
        ],
        bullmq: {
          connection,
          events: [{ queue: 'retry-test-queue', event: TaskEvent.Start }],
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 500, // Short delay for testing
            },
          },
          deadLetterQueue: { enabled: true },
        },
        entity: {
          new: () => new Task(),
          update: async (entity: Task, status: TaskStatus) => {
            entity.status = status;
            taskStore.set(entity.urn, entity);
            return entity;
          },
          load: async (urn: string) => taskStore.get(urn)!,
          status: (entity: Task) => entity.status,
          urn: (entity: Task) => entity.urn,
        },
      };

      const bullmqClient = redisEnv.createBullMQClient(definition.bullmq!, connection);
      const workflowService = new WorkflowService<Task, any, TaskEvent, TaskStatus>(definition);
      (workflowService as any).bullmqClient = bullmqClient;

      await workflowService.onModuleInit();

      await bullmqClient.produce('retry-test-queue', 'start-task', createTestJobData(mockTask.urn));

      // Wait for task to eventually succeed after retries
      await waitForCondition(() => taskStore.get(mockTask.urn)!.status === TaskStatus.InProgress, 5000);

      const updatedTask = taskStore.get(mockTask.urn)!;
      expect(updatedTask.status).toBe(TaskStatus.InProgress);
      expect(attemptCount).toBe(3); // Should have tried 3 times
    });

    it('should handle intermittent failures and eventually succeed', async () => {
      const taskStore = new Map<string, Task>();
      const mockTask: Task = {
        urn: 'urn:task:intermittent-1',
        name: 'Intermittent Failure Task',
        status: TaskStatus.Pending,
      };
      taskStore.set(mockTask.urn, mockTask);

      let callCount = 0;

      const definition: WorkflowDefinition<Task, any, TaskEvent, TaskStatus> = {
        name: 'TaskWorkflow',
        states: {
          finals: [TaskStatus.Completed],
          idles: [TaskStatus.Pending, TaskStatus.InProgress],
          failed: TaskStatus.Failed,
        },
        transitions: [
          {
            from: TaskStatus.Pending,
            to: TaskStatus.InProgress,
            event: TaskEvent.Start,
            actions: [async (entity: Task) => {
              callCount++;
              // Fail on first attempt only
              if (callCount === 1) {
                throw new Error('Intermittent network error');
              }
              return entity;
            }],
          },
        ],
        bullmq: {
          connection,
          events: [{ queue: 'intermittent-queue', event: TaskEvent.Start }],
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'fixed', delay: 500 },
          },
        },
        entity: {
          new: () => new Task(),
          update: async (entity: Task, status: TaskStatus) => {
            entity.status = status;
            taskStore.set(entity.urn, entity);
            return entity;
          },
          load: async (urn: string) => taskStore.get(urn)!,
          status: (entity: Task) => entity.status,
          urn: (entity: Task) => entity.urn,
        },
      };

      const bullmqClient = redisEnv.createBullMQClient(definition.bullmq!, connection);
      const workflowService = new WorkflowService<Task, any, TaskEvent, TaskStatus>(definition);
      (workflowService as any).bullmqClient = bullmqClient;

      await workflowService.onModuleInit();

      await bullmqClient.produce('intermittent-queue', 'start', createTestJobData(mockTask.urn));

      await waitForCondition(() => taskStore.get(mockTask.urn)!.status === TaskStatus.InProgress, 3000);

      expect(taskStore.get(mockTask.urn)!.status).toBe(TaskStatus.InProgress);
      expect(callCount).toBe(2); // Failed once, succeeded on retry
    });
  });

  describe('DLQ for permanent failures', () => {
    it('should move job to DLQ after exceeding retry limit', async () => {
      const taskStore = new Map<string, Task>();
      const mockTask: Task = {
        urn: 'urn:task:dlq-1',
        name: 'DLQ Test Task',
        status: TaskStatus.Pending,
      };
      taskStore.set(mockTask.urn, mockTask);

      const definition: WorkflowDefinition<Task, any, TaskEvent, TaskStatus> = {
        name: 'TaskWorkflow',
        states: {
          finals: [TaskStatus.Completed, TaskStatus.Failed],
          idles: [TaskStatus.Pending, TaskStatus.InProgress],
          failed: TaskStatus.Failed,
        },
        transitions: [
          {
            from: TaskStatus.Pending,
            to: TaskStatus.InProgress,
            event: TaskEvent.Start,
            actions: [async () => {
              throw new Error('Permanent failure - invalid data');
            }],
          },
        ],
        bullmq: {
          connection,
          events: [{ queue: 'dlq-test-queue', event: TaskEvent.Start }],
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 500 },
          },
          deadLetterQueue: {
            enabled: true,
            suffix: '-dlq',
          },
        },
        entity: {
          new: () => new Task(),
          update: async (entity: Task, status: TaskStatus) => {
            entity.status = status;
            taskStore.set(entity.urn, entity);
            return entity;
          },
          load: async (urn: string) => taskStore.get(urn)!,
          status: (entity: Task) => entity.status,
          urn: (entity: Task) => entity.urn,
        },
      };

      const bullmqClient = redisEnv.createBullMQClient(definition.bullmq!, connection);
      const workflowService = new WorkflowService<Task, any, TaskEvent, TaskStatus>(definition);
      (workflowService as any).bullmqClient = bullmqClient;

      await workflowService.onModuleInit();

      const dlqQueue = redisEnv.createQueue('dlq-test-queue-dlq', connection);

      await bullmqClient.produce('dlq-test-queue', 'start-task', createTestJobData(mockTask.urn));

      // Wait for job to be moved to DLQ
      await waitForCondition(async () => {
        const dlqCount = await dlqQueue.getCompletedCount();
        return dlqCount > 0;
      }, 5000);

      const dlqJobs = await dlqQueue.getCompleted();
      expect(dlqJobs.length).toBeGreaterThan(0);

      const dlqJob = dlqJobs[0];
      expect(dlqJob.data.originalData.urn).toBe(mockTask.urn);
      expect(dlqJob.data.error.message).toContain('Permanent failure');
      expect(dlqJob.data.attemptsMade).toBe(3);
    });

    it('should include error details in DLQ job', async () => {
      const taskStore = new Map<string, Task>();
      const mockTask: Task = {
        urn: 'urn:task:dlq-details-1',
        name: 'DLQ Details Task',
        status: TaskStatus.Pending,
      };
      taskStore.set(mockTask.urn, mockTask);

      const errorMessage = 'Validation failed: missing required field';

      const definition: WorkflowDefinition<Task, any, TaskEvent, TaskStatus> = {
        name: 'TaskWorkflow',
        states: {
          finals: [TaskStatus.Completed],
          idles: [TaskStatus.Pending, TaskStatus.InProgress],
          failed: TaskStatus.Failed,
        },
        transitions: [
          {
            from: TaskStatus.Pending,
            to: TaskStatus.InProgress,
            event: TaskEvent.Start,
            actions: [async () => {
              throw new Error(errorMessage);
            }],
          },
        ],
        bullmq: {
          connection,
          events: [{ queue: 'dlq-details-queue', event: TaskEvent.Start }],
          defaultJobOptions: {
            attempts: 2,
            backoff: { type: 'fixed', delay: 300 },
          },
          deadLetterQueue: { enabled: true },
        },
        entity: {
          new: () => new Task(),
          update: async (entity: Task, status: TaskStatus) => {
            entity.status = status;
            taskStore.set(entity.urn, entity);
            return entity;
          },
          load: async (urn: string) => taskStore.get(urn)!,
          status: (entity: Task) => entity.status,
          urn: (entity: Task) => entity.urn,
        },
      };

      const bullmqClient = redisEnv.createBullMQClient(definition.bullmq!, connection);
      const workflowService = new WorkflowService<Task, any, TaskEvent, TaskStatus>(definition);
      (workflowService as any).bullmqClient = bullmqClient;

      await workflowService.onModuleInit();

      const dlqQueue = redisEnv.createQueue('dlq-details-queue-dlq', connection);

      await bullmqClient.produce('dlq-details-queue', 'start', createTestJobData(mockTask.urn));

      await waitForCondition(async () => {
        const count = await dlqQueue.getCompletedCount();
        return count > 0;
      }, 4000);

      const dlqJobs = await dlqQueue.getCompleted();
      const dlqJob = dlqJobs[0];

      expect(dlqJob.data.error.message).toBe(errorMessage);
      expect(dlqJob.data.originalJobName).toBe('start');
      expect(dlqJob.data.failedAt).toBeDefined();
      expect(dlqJob.data.originalData.urn).toBe(mockTask.urn);
    });

    it('should not send to DLQ when disabled', async () => {
      const taskStore = new Map<string, Task>();
      const mockTask: Task = {
        urn: 'urn:task:no-dlq-1',
        name: 'No DLQ Task',
        status: TaskStatus.Pending,
      };
      taskStore.set(mockTask.urn, mockTask);

      const definition: WorkflowDefinition<Task, any, TaskEvent, TaskStatus> = {
        name: 'TaskWorkflow',
        states: {
          finals: [TaskStatus.Completed],
          idles: [TaskStatus.Pending, TaskStatus.InProgress],
          failed: TaskStatus.Failed,
        },
        transitions: [
          {
            from: TaskStatus.Pending,
            to: TaskStatus.InProgress,
            event: TaskEvent.Start,
            actions: [async () => {
              throw new Error('Always fails');
            }],
          },
        ],
        bullmq: {
          connection,
          events: [{ queue: 'no-dlq-queue', event: TaskEvent.Start }],
          defaultJobOptions: {
            attempts: 2,
            backoff: { type: 'fixed', delay: 300 },
          },
          deadLetterQueue: { enabled: false },
        },
        entity: {
          new: () => new Task(),
          update: async (entity: Task, status: TaskStatus) => {
            entity.status = status;
            taskStore.set(entity.urn, entity);
            return entity;
          },
          load: async (urn: string) => taskStore.get(urn)!,
          status: (entity: Task) => entity.status,
          urn: (entity: Task) => entity.urn,
        },
      };

      const bullmqClient = redisEnv.createBullMQClient(definition.bullmq!, connection);
      const workflowService = new WorkflowService<Task, any, TaskEvent, TaskStatus>(definition);
      (workflowService as any).bullmqClient = bullmqClient;

      await workflowService.onModuleInit();

      const mainQueue = redisEnv.createQueue('no-dlq-queue', connection);

      await bullmqClient.produce('no-dlq-queue', 'start', createTestJobData(mockTask.urn));

      // Wait for job to fail
      await waitForCondition(async () => {
        const failedCount = await mainQueue.getFailedCount();
        return failedCount > 0;
      }, 3000);

      const failedJobs = await mainQueue.getFailed();
      expect(failedJobs.length).toBeGreaterThan(0);

      // Verify no DLQ was created
      const dlqQueue = redisEnv.createQueue('no-dlq-queue-dlq', connection);
      const dlqCount = await dlqQueue.getCompletedCount();
      expect(dlqCount).toBe(0);
    });
  });

  describe('Redis connection failures', () => {
    it('should report unhealthy when Redis is unavailable', async () => {
      const invalidConnection = {
        host: 'invalid-host',
        port: 9999,
      };

      const config = {
        connection: invalidConnection,
        events: [],
        defaultJobOptions: {
          attempts: 3,
        },
      };

      const bullmqClient = new BullMQClient(config);

      const isHealthy = await bullmqClient.isHealthy();
      expect(isHealthy).toBe(false);

      await bullmqClient.onModuleDestroy();
    });

    it('should handle connection errors during job production', async () => {
      const invalidConnection = {
        host: 'invalid-host',
        port: 9999,
      };

      const config = {
        connection: invalidConnection,
        events: [],
        defaultJobOptions: {
          attempts: 3,
        },
      };

      const bullmqClient = new BullMQClient(config);

      await expect(
        bullmqClient.produce('test-queue', 'test-job', createTestJobData('urn:test:1')),
      ).rejects.toThrow();

      await bullmqClient.onModuleDestroy();
    });
  });

  describe('Graceful shutdown with in-flight jobs', () => {
    it('should wait for in-flight jobs to complete before shutdown', async () => {
      const taskStore = new Map<string, Task>();
      const mockTask: Task = {
        urn: 'urn:task:shutdown-1',
        name: 'Shutdown Test Task',
        status: TaskStatus.Pending,
      };
      taskStore.set(mockTask.urn, mockTask);

      let jobStarted = false;
      let jobCompleted = false;

      const definition: WorkflowDefinition<Task, any, TaskEvent, TaskStatus> = {
        name: 'TaskWorkflow',
        states: {
          finals: [TaskStatus.Completed],
          idles: [TaskStatus.Pending, TaskStatus.InProgress],
          failed: TaskStatus.Failed,
        },
        transitions: [
          {
            from: TaskStatus.Pending,
            to: TaskStatus.InProgress,
            event: TaskEvent.Start,
            actions: [async (entity: Task) => {
              jobStarted = true;
              // Simulate long-running job
              await new Promise((resolve) => setTimeout(resolve, 1000));
              jobCompleted = true;
              return entity;
            }],
          },
        ],
        bullmq: {
          connection,
          events: [{ queue: 'shutdown-test-queue', event: TaskEvent.Start }],
        },
        entity: {
          new: () => new Task(),
          update: async (entity: Task, status: TaskStatus) => {
            entity.status = status;
            taskStore.set(entity.urn, entity);
            return entity;
          },
          load: async (urn: string) => taskStore.get(urn)!,
          status: (entity: Task) => entity.status,
          urn: (entity: Task) => entity.urn,
        },
      };

      const bullmqClient = redisEnv.createBullMQClient(definition.bullmq!, connection);
      const workflowService = new WorkflowService<Task, any, TaskEvent, TaskStatus>(definition);
      (workflowService as any).bullmqClient = bullmqClient;

      await workflowService.onModuleInit();

      // Start a job
      await bullmqClient.produce('shutdown-test-queue', 'start', createTestJobData(mockTask.urn));

      // Wait for job to start processing
      await waitForCondition(() => jobStarted, 2000);
      expect(jobStarted).toBe(true);

      // Initiate shutdown while job is in progress
      const shutdownPromise = bullmqClient.onModuleDestroy();

      // Wait for shutdown to complete
      await shutdownPromise;

      // Job should have completed before shutdown
      expect(jobCompleted).toBe(true);
      expect(taskStore.get(mockTask.urn)!.status).toBe(TaskStatus.InProgress);
    });

    it('should handle shutdown with multiple queues and workers', async () => {
      const taskStore = new Map<string, Task>();
      
      const tasks = [
        { urn: 'urn:task:multi-shutdown-1', name: 'Task 1', status: TaskStatus.Pending },
        { urn: 'urn:task:multi-shutdown-2', name: 'Task 2', status: TaskStatus.Pending },
      ];

      tasks.forEach((task) => taskStore.set(task.urn, task as Task));

      const definition: WorkflowDefinition<Task, any, TaskEvent, TaskStatus> = {
        name: 'TaskWorkflow',
        states: {
          finals: [TaskStatus.Completed],
          idles: [TaskStatus.Pending, TaskStatus.InProgress],
          failed: TaskStatus.Failed,
        },
        transitions: [
          {
            from: TaskStatus.Pending,
            to: TaskStatus.InProgress,
            event: TaskEvent.Start,
          },
          {
            from: TaskStatus.InProgress,
            to: TaskStatus.Completed,
            event: TaskEvent.Complete,
          },
        ],
        bullmq: {
          connection,
          events: [
            { queue: 'multi-shutdown-queue-1', event: TaskEvent.Start },
            { queue: 'multi-shutdown-queue-2', event: TaskEvent.Complete },
          ],
        },
        entity: {
          new: () => new Task(),
          update: async (entity: Task, status: TaskStatus) => {
            entity.status = status;
            taskStore.set(entity.urn, entity);
            return entity;
          },
          load: async (urn: string) => taskStore.get(urn)!,
          status: (entity: Task) => entity.status,
          urn: (entity: Task) => entity.urn,
        },
      };

      const bullmqClient = redisEnv.createBullMQClient(definition.bullmq!, connection);
      const workflowService = new WorkflowService<Task, any, TaskEvent, TaskStatus>(definition);
      (workflowService as any).bullmqClient = bullmqClient;

      await workflowService.onModuleInit();

      // Produce jobs to both queues
      await bullmqClient.produce('multi-shutdown-queue-1', 'start', createTestJobData(tasks[0].urn));
      await bullmqClient.produce('multi-shutdown-queue-2', 'complete', createTestJobData(tasks[1].urn));

      // Wait a bit for jobs to be picked up
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Shutdown should close all workers and queues gracefully
      await expect(bullmqClient.onModuleDestroy()).resolves.not.toThrow();
    });

    it('should handle shutdown errors gracefully', async () => {
      const definition: WorkflowDefinition<Task, any, TaskEvent, TaskStatus> = {
        name: 'TaskWorkflow',
        states: {
          finals: [TaskStatus.Completed],
          idles: [TaskStatus.Pending, TaskStatus.InProgress],
          failed: TaskStatus.Failed,
        },
        transitions: [],
        bullmq: {
          connection,
          events: [{ queue: 'error-shutdown-queue', event: TaskEvent.Start }],
        },
        entity: {
          new: () => new Task(),
          update: async (entity: Task, status: TaskStatus) => entity,
          load: async (urn: string) => ({ urn, name: 'Test', status: TaskStatus.Pending }),
          status: (entity: Task) => entity.status,
          urn: (entity: Task) => entity.urn,
        },
      };

      const bullmqClient = redisEnv.createBullMQClient(definition.bullmq!, connection);
      const workflowService = new WorkflowService<Task, any, TaskEvent, TaskStatus>(definition);
      (workflowService as any).bullmqClient = bullmqClient;

      await workflowService.onModuleInit();

      // Shutdown should not throw even if there are errors
      await expect(bullmqClient.onModuleDestroy()).resolves.not.toThrow();
    });
  });
});
