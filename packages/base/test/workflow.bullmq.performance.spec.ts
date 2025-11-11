import { WorkflowService } from '@this/workflow/service';
import { WorkflowDefinition } from '@this/workflow/definition';
import { BullMQClient } from '@this/workflow/bullmq/client';
import { RedisTestEnvironment, createTestJobData, waitForCondition } from './utils/redis-test-utils';

enum TaskEvent {
  Start = 'task.start',
  Complete = 'task.complete',
}

enum TaskStatus {
  Pending = 'pending',
  InProgress = 'in-progress',
  Completed = 'completed',
}

class Task {
  urn: string;
  name: string;
  status: TaskStatus;
  data?: any;
}

describe('BullMQ Performance Tests', () => {
  let redisEnv: RedisTestEnvironment;
  let connection: { host: string; port: number };

  beforeAll(async () => {
    redisEnv = new RedisTestEnvironment();
    connection = await redisEnv.start();
  });

  afterAll(async () => {
    await redisEnv.stop();
  });

  describe('Job throughput with high volume', () => {
    it('should process 100 jobs efficiently', async () => {
      const taskStore = new Map<string, Task>();
      const tasks: Task[] = [];
      const jobCount = 100;

      // Create tasks
      for (let i = 0; i < jobCount; i++) {
        const task: Task = {
          urn: `urn:task:throughput-${i}`,
          name: `Throughput Task ${i}`,
          status: TaskStatus.Pending,
        };
        tasks.push(task);
        taskStore.set(task.urn, task);
      }

      const definition: WorkflowDefinition<Task, any, TaskEvent, TaskStatus> = {
        name: 'TaskWorkflow',
        states: {
          finals: [TaskStatus.Completed],
          idles: [TaskStatus.Pending, TaskStatus.InProgress],
          failed: TaskStatus.Pending,
        },
        transitions: [
          {
            from: TaskStatus.Pending,
            to: TaskStatus.InProgress,
            event: TaskEvent.Start,
          },
        ],
        bullmq: {
          connection,
          events: [{ queue: 'throughput-queue', event: TaskEvent.Start }],
          defaultJobOptions: {
            attempts: 1,
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

      const startTime = Date.now();

      // Produce all jobs
      await Promise.all(
        tasks.map((task) =>
          bullmqClient.produce('throughput-queue', 'start', createTestJobData(task.urn)),
        ),
      );

      // Wait for all jobs to complete
      await waitForCondition(
        () => tasks.every((task) => taskStore.get(task.urn)!.status === TaskStatus.InProgress),
        15000,
      );

      const endTime = Date.now();
      const duration = endTime - startTime;
      const throughput = (jobCount / duration) * 1000; // jobs per second

      console.log(`Processed ${jobCount} jobs in ${duration}ms (${throughput.toFixed(2)} jobs/sec)`);

      // Verify all tasks were processed
      tasks.forEach((task) => {
        expect(taskStore.get(task.urn)!.status).toBe(TaskStatus.InProgress);
      });

      // Performance assertion - should process at least 10 jobs per second
      expect(throughput).toBeGreaterThan(10);
    });

    it('should handle burst of jobs without dropping any', async () => {
      const taskStore = new Map<string, Task>();
      const tasks: Task[] = [];
      const jobCount = 50;

      for (let i = 0; i < jobCount; i++) {
        const task: Task = {
          urn: `urn:task:burst-${i}`,
          name: `Burst Task ${i}`,
          status: TaskStatus.Pending,
        };
        tasks.push(task);
        taskStore.set(task.urn, task);
      }

      const definition: WorkflowDefinition<Task, any, TaskEvent, TaskStatus> = {
        name: 'TaskWorkflow',
        states: {
          finals: [TaskStatus.Completed],
          idles: [TaskStatus.Pending, TaskStatus.InProgress],
          failed: TaskStatus.Pending,
        },
        transitions: [
          {
            from: TaskStatus.Pending,
            to: TaskStatus.InProgress,
            event: TaskEvent.Start,
          },
        ],
        bullmq: {
          connection,
          events: [{ queue: 'burst-queue', event: TaskEvent.Start }],
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

      // Produce all jobs in a burst (no await between them)
      const producePromises = tasks.map((task) =>
        bullmqClient.produce('burst-queue', 'start', createTestJobData(task.urn)),
      );

      await Promise.all(producePromises);

      // Wait for all to complete
      await waitForCondition(
        () => tasks.every((task) => taskStore.get(task.urn)!.status === TaskStatus.InProgress),
        10000,
      );

      // Verify no jobs were dropped
      const processedCount = tasks.filter(
        (task) => taskStore.get(task.urn)!.status === TaskStatus.InProgress,
      ).length;
      expect(processedCount).toBe(jobCount);
    });
  });

  describe('Worker concurrency', () => {
    it('should process jobs concurrently with multiple workers', async () => {
      const taskStore = new Map<string, Task>();
      const tasks: Task[] = [];
      const jobCount = 20;
      const processingTimes: number[] = [];

      for (let i = 0; i < jobCount; i++) {
        const task: Task = {
          urn: `urn:task:concurrent-${i}`,
          name: `Concurrent Task ${i}`,
          status: TaskStatus.Pending,
        };
        tasks.push(task);
        taskStore.set(task.urn, task);
      }

      const definition: WorkflowDefinition<Task, any, TaskEvent, TaskStatus> = {
        name: 'TaskWorkflow',
        states: {
          finals: [TaskStatus.Completed],
          idles: [TaskStatus.Pending, TaskStatus.InProgress],
          failed: TaskStatus.Pending,
        },
        transitions: [
          {
            from: TaskStatus.Pending,
            to: TaskStatus.InProgress,
            event: TaskEvent.Start,
            actions: [async (entity: Task) => {
              const startTime = Date.now();
              // Simulate some work
              await new Promise((resolve) => setTimeout(resolve, 100));
              processingTimes.push(Date.now() - startTime);
              return entity;
            }],
          },
        ],
        bullmq: {
          connection,
          events: [{ queue: 'concurrent-worker-queue', event: TaskEvent.Start }],
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

      const startTime = Date.now();

      // Produce all jobs
      await Promise.all(
        tasks.map((task) =>
          bullmqClient.produce('concurrent-worker-queue', 'start', createTestJobData(task.urn)),
        ),
      );

      // Wait for all to complete
      await waitForCondition(
        () => tasks.every((task) => taskStore.get(task.urn)!.status === TaskStatus.InProgress),
        10000,
      );

      const totalTime = Date.now() - startTime;

      console.log(`Processed ${jobCount} jobs with 100ms work each in ${totalTime}ms`);
      console.log(`Average processing time: ${(processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length).toFixed(2)}ms`);

      // If jobs were processed sequentially, it would take at least jobCount * 100ms
      // With concurrency, it should be much faster
      const sequentialTime = jobCount * 100;
      expect(totalTime).toBeLessThan(sequentialTime);

      // All jobs should be processed
      expect(processingTimes.length).toBe(jobCount);
    });

    it('should handle concurrent jobs from different queues', async () => {
      const taskStore = new Map<string, Task>();
      const queue1Tasks: Task[] = [];
      const queue2Tasks: Task[] = [];

      for (let i = 0; i < 10; i++) {
        const task1: Task = {
          urn: `urn:task:q1-${i}`,
          name: `Queue 1 Task ${i}`,
          status: TaskStatus.Pending,
        };
        queue1Tasks.push(task1);
        taskStore.set(task1.urn, task1);

        const task2: Task = {
          urn: `urn:task:q2-${i}`,
          name: `Queue 2 Task ${i}`,
          status: TaskStatus.InProgress,
        };
        queue2Tasks.push(task2);
        taskStore.set(task2.urn, task2);
      }

      const definition: WorkflowDefinition<Task, any, TaskEvent, TaskStatus> = {
        name: 'TaskWorkflow',
        states: {
          finals: [TaskStatus.Completed],
          idles: [TaskStatus.Pending, TaskStatus.InProgress],
          failed: TaskStatus.Pending,
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
            { queue: 'multi-queue-1', event: TaskEvent.Start },
            { queue: 'multi-queue-2', event: TaskEvent.Complete },
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

      // Produce jobs to both queues simultaneously
      await Promise.all([
        ...queue1Tasks.map((task) =>
          bullmqClient.produce('multi-queue-1', 'start', createTestJobData(task.urn)),
        ),
        ...queue2Tasks.map((task) =>
          bullmqClient.produce('multi-queue-2', 'complete', createTestJobData(task.urn)),
        ),
      ]);

      // Wait for all to complete
      await waitForCondition(
        () =>
          queue1Tasks.every((task) => taskStore.get(task.urn)!.status === TaskStatus.InProgress) &&
          queue2Tasks.every((task) => taskStore.get(task.urn)!.status === TaskStatus.Completed),
        8000,
      );

      // Verify all jobs from both queues were processed
      queue1Tasks.forEach((task) => {
        expect(taskStore.get(task.urn)!.status).toBe(TaskStatus.InProgress);
      });
      queue2Tasks.forEach((task) => {
        expect(taskStore.get(task.urn)!.status).toBe(TaskStatus.Completed);
      });
    });
  });

  describe('Queue depth monitoring', () => {
    it('should track queue metrics accurately', async () => {
      const taskStore = new Map<string, Task>();
      const tasks: Task[] = [];

      for (let i = 0; i < 10; i++) {
        const task: Task = {
          urn: `urn:task:metrics-${i}`,
          name: `Metrics Task ${i}`,
          status: TaskStatus.Pending,
        };
        tasks.push(task);
        taskStore.set(task.urn, task);
      }

      const definition: WorkflowDefinition<Task, any, TaskEvent, TaskStatus> = {
        name: 'TaskWorkflow',
        states: {
          finals: [TaskStatus.Completed],
          idles: [TaskStatus.Pending, TaskStatus.InProgress],
          failed: TaskStatus.Pending,
        },
        transitions: [
          {
            from: TaskStatus.Pending,
            to: TaskStatus.InProgress,
            event: TaskEvent.Start,
          },
        ],
        bullmq: {
          connection,
          events: [{ queue: 'metrics-queue', event: TaskEvent.Start }],
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

      const queue = redisEnv.createQueue('metrics-queue', connection);

      await workflowService.onModuleInit();

      // Produce jobs
      await Promise.all(
        tasks.map((task) =>
          bullmqClient.produce('metrics-queue', 'start', createTestJobData(task.urn)),
        ),
      );

      // Wait for processing to complete
      await waitForCondition(
        () => tasks.every((task) => taskStore.get(task.urn)!.status === TaskStatus.InProgress),
        8000,
      );

      // Check metrics
      const metrics = await redisEnv.getQueueMetrics(queue);

      console.log('Queue metrics:', metrics);

      expect(metrics.completed).toBeGreaterThan(0);
      expect(metrics.waiting).toBe(0); // All should be processed
    });
  });

  describe('Memory usage with large payloads', () => {
    it('should handle jobs with large payloads', async () => {
      const taskStore = new Map<string, Task>();
      const task: Task = {
        urn: 'urn:task:large-payload-1',
        name: 'Large Payload Task',
        status: TaskStatus.Pending,
      };
      taskStore.set(task.urn, task);

      // Create a large payload (1MB)
      const largePayload = {
        data: 'x'.repeat(1024 * 1024),
        metadata: {
          size: '1MB',
          timestamp: Date.now(),
        },
      };

      const definition: WorkflowDefinition<Task, any, TaskEvent, TaskStatus> = {
        name: 'TaskWorkflow',
        states: {
          finals: [TaskStatus.Completed],
          idles: [TaskStatus.Pending, TaskStatus.InProgress],
          failed: TaskStatus.Pending,
        },
        transitions: [
          {
            from: TaskStatus.Pending,
            to: TaskStatus.InProgress,
            event: TaskEvent.Start,
            actions: [async (entity: Task, payload: any) => {
              entity.data = payload;
              return entity;
            }],
          },
        ],
        bullmq: {
          connection,
          events: [{ queue: 'large-payload-queue', event: TaskEvent.Start }],
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

      // Produce job with large payload
      await bullmqClient.produce('large-payload-queue', 'start', createTestJobData(task.urn, largePayload));

      // Wait for processing
      await waitForCondition(() => taskStore.get(task.urn)!.status === TaskStatus.InProgress, 5000);

      const updatedTask = taskStore.get(task.urn)!;
      expect(updatedTask.status).toBe(TaskStatus.InProgress);
      expect(updatedTask.data).toBeDefined();
      expect(updatedTask.data.metadata.size).toBe('1MB');
    });

    it('should handle multiple jobs with moderate payloads', async () => {
      const taskStore = new Map<string, Task>();
      const tasks: Task[] = [];
      const jobCount = 20;

      for (let i = 0; i < jobCount; i++) {
        const task: Task = {
          urn: `urn:task:moderate-payload-${i}`,
          name: `Moderate Payload Task ${i}`,
          status: TaskStatus.Pending,
        };
        tasks.push(task);
        taskStore.set(task.urn, task);
      }

      // Create moderate payload (100KB)
      const moderatePayload = {
        data: 'x'.repeat(100 * 1024),
        index: 0,
      };

      const definition: WorkflowDefinition<Task, any, TaskEvent, TaskStatus> = {
        name: 'TaskWorkflow',
        states: {
          finals: [TaskStatus.Completed],
          idles: [TaskStatus.Pending, TaskStatus.InProgress],
          failed: TaskStatus.Pending,
        },
        transitions: [
          {
            from: TaskStatus.Pending,
            to: TaskStatus.InProgress,
            event: TaskEvent.Start,
          },
        ],
        bullmq: {
          connection,
          events: [{ queue: 'moderate-payload-queue', event: TaskEvent.Start }],
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

      // Produce all jobs with moderate payloads
      await Promise.all(
        tasks.map((task, index) =>
          bullmqClient.produce('moderate-payload-queue', 'start', createTestJobData(task.urn, {
            ...moderatePayload,
            index,
          })),
        ),
      );

      // Wait for all to complete
      await waitForCondition(
        () => tasks.every((task) => taskStore.get(task.urn)!.status === TaskStatus.InProgress),
        10000,
      );

      // Verify all were processed
      const processedCount = tasks.filter(
        (task) => taskStore.get(task.urn)!.status === TaskStatus.InProgress,
      ).length;
      expect(processedCount).toBe(jobCount);
    });
  });
});
