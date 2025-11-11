import { WorkflowService } from '@this/workflow/service';
import { WorkflowDefinition } from '@this/workflow/definition';
import { BullMQClient } from '@this/workflow/bullmq/client';
import { RedisTestEnvironment, createTestJobData, waitForCondition } from './utils/redis-test-utils';

enum TaskEvent {
  Create = 'task.create',
  Start = 'task.start',
  Complete = 'task.complete',
  Fail = 'task.fail',
  Cancel = 'task.cancel',
}

enum TaskStatus {
  Pending = 'pending',
  InProgress = 'in-progress',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

class Task {
  urn: string;
  name: string;
  status: TaskStatus;
  metadata?: any;
}

enum OrderEvent {
  Create = 'order.create',
  Process = 'order.process',
  Ship = 'order.ship',
  Deliver = 'order.deliver',
}

enum OrderStatus {
  Pending = 'pending',
  Processing = 'processing',
  Shipped = 'shipped',
  Delivered = 'delivered',
}

class Order {
  urn: string;
  orderId: string;
  status: OrderStatus;
}

describe('BullMQ End-to-End Workflow Tests', () => {
  let redisEnv: RedisTestEnvironment;
  let connection: { host: string; port: number };

  beforeAll(async () => {
    redisEnv = new RedisTestEnvironment();
    connection = await redisEnv.start();
  });

  afterAll(async () => {
    await redisEnv.stop();
  });

  describe('Complete workflow execution triggered by BullMQ jobs', () => {
    it('should execute complete workflow from pending to completed', async () => {
      const taskStore = new Map<string, Task>();
      const mockTask: Task = {
        urn: 'urn:task:e2e-1',
        name: 'E2E Test Task',
        status: TaskStatus.Pending,
      };
      taskStore.set(mockTask.urn, mockTask);

      const definition: WorkflowDefinition<Task, any, TaskEvent, TaskStatus> = {
        name: 'TaskWorkflow',
        states: {
          finals: [TaskStatus.Completed, TaskStatus.Failed, TaskStatus.Cancelled],
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
            { queue: 'task-start-queue', event: TaskEvent.Start },
            { queue: 'task-complete-queue', event: TaskEvent.Complete },
          ],
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
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

      // Produce job to start task
      await bullmqClient.produce('task-start-queue', 'start-task', createTestJobData(mockTask.urn));

      // Wait for task to transition to InProgress
      await waitForCondition(() => taskStore.get(mockTask.urn)!.status === TaskStatus.InProgress, 3000);
      expect(taskStore.get(mockTask.urn)!.status).toBe(TaskStatus.InProgress);

      // Produce job to complete task
      await bullmqClient.produce('task-complete-queue', 'complete-task', createTestJobData(mockTask.urn));

      // Wait for task to transition to Completed
      await waitForCondition(() => taskStore.get(mockTask.urn)!.status === TaskStatus.Completed, 3000);
      expect(taskStore.get(mockTask.urn)!.status).toBe(TaskStatus.Completed);
    });

    it('should handle workflow with payload data', async () => {
      const taskStore = new Map<string, Task>();
      const mockTask: Task = {
        urn: 'urn:task:e2e-2',
        name: 'Task with Payload',
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
            actions: [async (entity: Task, payload: any) => {
              entity.metadata = payload;
              return entity;
            }],
          },
        ],
        bullmq: {
          connection,
          events: [{ queue: 'task-payload-queue', event: TaskEvent.Start }],
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

      const payload = { priority: 'high', assignee: 'user-123' };
      await bullmqClient.produce('task-payload-queue', 'start-with-payload', createTestJobData(mockTask.urn, payload));

      await waitForCondition(() => taskStore.get(mockTask.urn)!.status === TaskStatus.InProgress, 3000);
      
      const updatedTask = taskStore.get(mockTask.urn)!;
      expect(updatedTask.status).toBe(TaskStatus.InProgress);
      expect(updatedTask.metadata).toEqual(payload);
    });
  });

  describe('Multiple workflows sharing same Redis instance', () => {
    it('should handle two different workflows independently', async () => {
      const taskStore = new Map<string, Task>();
      const orderStore = new Map<string, Order>();

      const task: Task = {
        urn: 'urn:task:multi-1',
        name: 'Multi Workflow Task',
        status: TaskStatus.Pending,
      };
      taskStore.set(task.urn, task);

      const order: Order = {
        urn: 'urn:order:multi-1',
        orderId: 'ORDER-123',
        status: OrderStatus.Pending,
      };
      orderStore.set(order.urn, order);

      const taskDefinition: WorkflowDefinition<Task, any, TaskEvent, TaskStatus> = {
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
        ],
        bullmq: {
          connection,
          events: [{ queue: 'multi-task-queue', event: TaskEvent.Start }],
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

      const orderDefinition: WorkflowDefinition<Order, any, OrderEvent, OrderStatus> = {
        name: 'OrderWorkflow',
        states: {
          finals: [OrderStatus.Delivered],
          idles: [OrderStatus.Pending, OrderStatus.Processing, OrderStatus.Shipped],
          failed: OrderStatus.Pending,
        },
        transitions: [
          {
            from: OrderStatus.Pending,
            to: OrderStatus.Processing,
            event: OrderEvent.Process,
          },
        ],
        bullmq: {
          connection,
          events: [{ queue: 'multi-order-queue', event: OrderEvent.Process }],
        },
        entity: {
          new: () => new Order(),
          update: async (entity: Order, status: OrderStatus) => {
            entity.status = status;
            orderStore.set(entity.urn, entity);
            return entity;
          },
          load: async (urn: string) => orderStore.get(urn)!,
          status: (entity: Order) => entity.status,
          urn: (entity: Order) => entity.urn,
        },
      };

      const taskClient = redisEnv.createBullMQClient(taskDefinition.bullmq!, connection);
      const orderClient = redisEnv.createBullMQClient(orderDefinition.bullmq!, connection);

      const taskService = new WorkflowService<Task, any, TaskEvent, TaskStatus>(taskDefinition);
      (taskService as any).bullmqClient = taskClient;

      const orderService = new WorkflowService<Order, any, OrderEvent, OrderStatus>(orderDefinition);
      (orderService as any).bullmqClient = orderClient;

      await taskService.onModuleInit();
      await orderService.onModuleInit();

      // Trigger both workflows
      await taskClient.produce('multi-task-queue', 'start-task', createTestJobData(task.urn));
      await orderClient.produce('multi-order-queue', 'process-order', createTestJobData(order.urn));

      // Wait for both to complete
      await waitForCondition(() => taskStore.get(task.urn)!.status === TaskStatus.InProgress, 3000);
      await waitForCondition(() => orderStore.get(order.urn)!.status === OrderStatus.Processing, 3000);

      expect(taskStore.get(task.urn)!.status).toBe(TaskStatus.InProgress);
      expect(orderStore.get(order.urn)!.status).toBe(OrderStatus.Processing);
    });
  });

  describe('Concurrent job processing', () => {
    it('should process multiple jobs concurrently', async () => {
      const taskStore = new Map<string, Task>();
      const tasks: Task[] = [];

      // Create 5 tasks
      for (let i = 0; i < 5; i++) {
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
          failed: TaskStatus.Failed,
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
          events: [{ queue: 'concurrent-task-queue', event: TaskEvent.Start }],
          defaultJobOptions: {
            attempts: 3,
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

      // Produce all jobs at once
      await Promise.all(
        tasks.map((task) =>
          bullmqClient.produce('concurrent-task-queue', 'start-task', createTestJobData(task.urn)),
        ),
      );

      // Wait for all tasks to complete
      await waitForCondition(
        () => tasks.every((task) => taskStore.get(task.urn)!.status === TaskStatus.InProgress),
        5000,
      );

      // Verify all tasks were processed
      tasks.forEach((task) => {
        expect(taskStore.get(task.urn)!.status).toBe(TaskStatus.InProgress);
      });
    });
  });

  describe('Workflow with multiple BullMQ queues', () => {
    it('should handle workflow with multiple event queues', async () => {
      const taskStore = new Map<string, Task>();
      const mockTask: Task = {
        urn: 'urn:task:multi-queue-1',
        name: 'Multi Queue Task',
        status: TaskStatus.Pending,
      };
      taskStore.set(mockTask.urn, mockTask);

      const definition: WorkflowDefinition<Task, any, TaskEvent, TaskStatus> = {
        name: 'TaskWorkflow',
        states: {
          finals: [TaskStatus.Completed, TaskStatus.Failed, TaskStatus.Cancelled],
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
          {
            from: TaskStatus.InProgress,
            to: TaskStatus.Failed,
            event: TaskEvent.Fail,
          },
          {
            from: TaskStatus.Pending,
            to: TaskStatus.Cancelled,
            event: TaskEvent.Cancel,
          },
        ],
        bullmq: {
          connection,
          events: [
            { queue: 'mq-start-queue', event: TaskEvent.Start },
            { queue: 'mq-complete-queue', event: TaskEvent.Complete },
            { queue: 'mq-fail-queue', event: TaskEvent.Fail },
            { queue: 'mq-cancel-queue', event: TaskEvent.Cancel },
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

      // Start task
      await bullmqClient.produce('mq-start-queue', 'start', createTestJobData(mockTask.urn));
      await waitForCondition(() => taskStore.get(mockTask.urn)!.status === TaskStatus.InProgress, 3000);
      expect(taskStore.get(mockTask.urn)!.status).toBe(TaskStatus.InProgress);

      // Complete task
      await bullmqClient.produce('mq-complete-queue', 'complete', createTestJobData(mockTask.urn));
      await waitForCondition(() => taskStore.get(mockTask.urn)!.status === TaskStatus.Completed, 3000);
      expect(taskStore.get(mockTask.urn)!.status).toBe(TaskStatus.Completed);
    });

    it('should handle different transitions from different queues', async () => {
      const taskStore = new Map<string, Task>();
      
      // Task that will be cancelled
      const cancelTask: Task = {
        urn: 'urn:task:cancel-1',
        name: 'Task to Cancel',
        status: TaskStatus.Pending,
      };
      taskStore.set(cancelTask.urn, cancelTask);

      // Task that will fail
      const failTask: Task = {
        urn: 'urn:task:fail-1',
        name: 'Task to Fail',
        status: TaskStatus.Pending,
      };
      taskStore.set(failTask.urn, failTask);

      const definition: WorkflowDefinition<Task, any, TaskEvent, TaskStatus> = {
        name: 'TaskWorkflow',
        states: {
          finals: [TaskStatus.Completed, TaskStatus.Failed, TaskStatus.Cancelled],
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
            to: TaskStatus.Failed,
            event: TaskEvent.Fail,
          },
          {
            from: TaskStatus.Pending,
            to: TaskStatus.Cancelled,
            event: TaskEvent.Cancel,
          },
        ],
        bullmq: {
          connection,
          events: [
            { queue: 'diff-start-queue', event: TaskEvent.Start },
            { queue: 'diff-fail-queue', event: TaskEvent.Fail },
            { queue: 'diff-cancel-queue', event: TaskEvent.Cancel },
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

      // Cancel first task directly from pending
      await bullmqClient.produce('diff-cancel-queue', 'cancel', createTestJobData(cancelTask.urn));
      await waitForCondition(() => taskStore.get(cancelTask.urn)!.status === TaskStatus.Cancelled, 3000);
      expect(taskStore.get(cancelTask.urn)!.status).toBe(TaskStatus.Cancelled);

      // Start second task then fail it
      await bullmqClient.produce('diff-start-queue', 'start', createTestJobData(failTask.urn));
      await waitForCondition(() => taskStore.get(failTask.urn)!.status === TaskStatus.InProgress, 3000);
      
      await bullmqClient.produce('diff-fail-queue', 'fail', createTestJobData(failTask.urn));
      await waitForCondition(() => taskStore.get(failTask.urn)!.status === TaskStatus.Failed, 3000);
      expect(taskStore.get(failTask.urn)!.status).toBe(TaskStatus.Failed);
    });
  });
});
