import { WorkflowService } from '@this/workflow/service';
import { WorkflowDefinition } from '@this/workflow/definition';
import { BullMQClient } from '@this/workflow/bullmq/client';
import { Queue, Worker, Job } from 'bullmq';

// Mock BullMQ modules
jest.mock('bullmq', () => {
  return {
    Queue: jest.fn().mockImplementation((name) => ({
      add: jest.fn().mockResolvedValue({ id: 'job-123', name: 'test-job' }),
      close: jest.fn().mockResolvedValue(undefined),
      client: Promise.resolve({
        ping: jest.fn().mockResolvedValue('PONG'),
      }),
      name,
    })),
    Worker: jest.fn().mockImplementation((name) => ({
      close: jest.fn().mockResolvedValue(undefined),
      name,
    })),
  };
});

enum TaskEvent {
  Create = 'task.create',
  Start = 'task.start',
  Complete = 'task.complete',
  Fail = 'task.fail',
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
}

describe('WorkflowService with BullMQ Integration', () => {
  let workflowService: WorkflowService<Task, any, TaskEvent, TaskStatus>;
  let bullmqClient: BullMQClient;
  let mockTask: Task;
  let workerProcessor: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockTask = {
      urn: 'urn:task:123',
      name: 'Test Task',
      status: TaskStatus.Pending,
    };

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
      ],
      bullmq: {
        connection: {
          host: 'localhost',
          port: 6379,
        },
        events: [
          {
            queue: 'task-events',
            event: TaskEvent.Start,
          },
          {
            queue: 'task-completion',
            event: TaskEvent.Complete,
          },
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
          suffix: '-dlq',
        },
      },
      entity: {
        new: () => new Task(),
        update: async (entity: Task, status: TaskStatus) => {
          entity.status = status;
          return entity;
        },
        load: async (urn: string) => {
          return mockTask;
        },
        status: (entity: Task) => entity.status,
        urn: (entity: Task) => entity.urn,
      },
    };

    bullmqClient = new BullMQClient(definition.bullmq!);
    workflowService = new WorkflowService<Task, any, TaskEvent, TaskStatus>(definition);
    (workflowService as any).bullmqClient = bullmqClient;

    // Capture the worker processor function
    (Worker as jest.MockedClass<typeof Worker>).mockImplementation((name, processor) => {
      workerProcessor = processor;
      return {
        close: jest.fn(),
        name,
      } as any;
    });
  });

  afterEach(async () => {
    await bullmqClient.onModuleDestroy();
  });

  describe('BullMQ Worker Initialization', () => {
    it('should initialize BullMQ workers with workflow definition', async () => {
      await workflowService.onModuleInit();

      expect(Worker).toHaveBeenCalledTimes(2);
      expect(Worker).toHaveBeenCalledWith(
        'task-events',
        expect.any(Function),
        expect.objectContaining({
          connection: {
            host: 'localhost',
            port: 6379,
          },
        }),
      );
      expect(Worker).toHaveBeenCalledWith(
        'task-completion',
        expect.any(Function),
        expect.objectContaining({
          connection: {
            host: 'localhost',
            port: 6379,
          },
        }),
      );
    });

    it('should not initialize workers when bullmq config is missing', async () => {
      const definitionWithoutBullMQ: WorkflowDefinition<Task, any, TaskEvent, TaskStatus> = {
        name: 'TaskWorkflow',
        states: {
          finals: [TaskStatus.Completed, TaskStatus.Failed],
          idles: [TaskStatus.Pending, TaskStatus.InProgress],
          failed: TaskStatus.Failed,
        },
        transitions: [],
        entity: {
          new: () => new Task(),
          update: async (entity: Task, status: TaskStatus) => {
            entity.status = status;
            return entity;
          },
          load: async (urn: string) => mockTask,
          status: (entity: Task) => entity.status,
          urn: (entity: Task) => entity.urn,
        },
      };

      const serviceWithoutBullMQ = new WorkflowService<Task, any, TaskEvent, TaskStatus>(
        definitionWithoutBullMQ,
      );

      await serviceWithoutBullMQ.onModuleInit();

      expect(Worker).not.toHaveBeenCalled();
    });

    it('should not initialize workers when bullmqClient is not available', async () => {
      const definition: WorkflowDefinition<Task, any, TaskEvent, TaskStatus> = {
        name: 'TaskWorkflow',
        states: {
          finals: [TaskStatus.Completed, TaskStatus.Failed],
          idles: [TaskStatus.Pending, TaskStatus.InProgress],
          failed: TaskStatus.Failed,
        },
        transitions: [],
        bullmq: {
          connection: {
            host: 'localhost',
            port: 6379,
          },
          events: [
            {
              queue: 'task-events',
              event: TaskEvent.Start,
            },
          ],
        },
        entity: {
          new: () => new Task(),
          update: async (entity: Task, status: TaskStatus) => {
            entity.status = status;
            return entity;
          },
          load: async (urn: string) => mockTask,
          status: (entity: Task) => entity.status,
          urn: (entity: Task) => entity.urn,
        },
      };

      const serviceWithoutClient = new WorkflowService<Task, any, TaskEvent, TaskStatus>(definition);
      // Don't set bullmqClient

      await serviceWithoutClient.onModuleInit();

      expect(Worker).not.toHaveBeenCalled();
    });
  });

  describe('Job Processing Triggers Workflow Transitions', () => {
    it('should trigger workflow transition when job is received', async () => {
      let taskEventsProcessor: any;
      
      (Worker as jest.MockedClass<typeof Worker>).mockImplementation((name, processor) => {
        if (name === 'task-events') {
          taskEventsProcessor = processor;
        }
        return {
          close: jest.fn(),
          name,
        } as any;
      });

      await workflowService.onModuleInit();

      const jobData = {
        urn: 'urn:task:123',
        payload: { test: 'data' },
      };

      const mockJob = {
        id: 'job-123',
        name: 'task-start',
        data: jobData,
        attemptsMade: 0,
        opts: { attempts: 3 },
        queueName: 'task-events',
      } as Job;

      await taskEventsProcessor(mockJob);

      expect(mockTask.status).toBe(TaskStatus.InProgress);
    });

    it('should process job with payload and update entity', async () => {
      let taskEventsProcessor: any;
      
      (Worker as jest.MockedClass<typeof Worker>).mockImplementation((name, processor) => {
        if (name === 'task-events') {
          taskEventsProcessor = processor;
        }
        return {
          close: jest.fn(),
          name,
        } as any;
      });

      await workflowService.onModuleInit();

      const jobData = {
        urn: 'urn:task:123',
        payload: { additionalInfo: 'test' },
      };

      const mockJob = {
        id: 'job-456',
        name: 'task-start',
        data: jobData,
        attemptsMade: 0,
        opts: { attempts: 3 },
        queueName: 'task-events',
      } as Job;

      await taskEventsProcessor(mockJob);

      expect(mockTask.status).toBe(TaskStatus.InProgress);
    });

    it('should complete workflow successfully with BullMQ events', async () => {
      let taskEventsProcessor: any;
      let taskCompletionProcessor: any;
      
      (Worker as jest.MockedClass<typeof Worker>).mockImplementation((name, processor) => {
        if (name === 'task-events') {
          taskEventsProcessor = processor;
        } else if (name === 'task-completion') {
          taskCompletionProcessor = processor;
        }
        return {
          close: jest.fn(),
          name,
        } as any;
      });

      await workflowService.onModuleInit();

      // First job: Start task
      const startJobData = {
        urn: 'urn:task:123',
      };

      const startJob = {
        id: 'job-start',
        name: 'task-start',
        data: startJobData,
        attemptsMade: 0,
        opts: { attempts: 3 },
        queueName: 'task-events',
      } as Job;

      await taskEventsProcessor(startJob);
      expect(mockTask.status).toBe(TaskStatus.InProgress);

      // Second job: Complete task
      const completeJobData = {
        urn: 'urn:task:123',
      };

      const completeJob = {
        id: 'job-complete',
        name: 'task-complete',
        data: completeJobData,
        attemptsMade: 0,
        opts: { attempts: 3 },
        queueName: 'task-completion',
      } as Job;

      await taskCompletionProcessor(completeJob);
      expect(mockTask.status).toBe(TaskStatus.Completed);
    });
  });

  describe('Error Handling and Retry Behavior', () => {
    it('should handle workflow transition errors gracefully', async () => {
      // Create a task that doesn't have a valid transition
      const invalidTask = {
        urn: 'urn:task:invalid',
        name: 'Invalid Task',
        status: TaskStatus.Completed, // Already in final state
      };

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
          },
        ],
        bullmq: {
          connection: {
            host: 'localhost',
            port: 6379,
          },
          events: [
            {
              queue: 'task-events',
              event: TaskEvent.Start,
            },
          ],
          defaultJobOptions: {
            attempts: 3,
          },
          deadLetterQueue: {
            enabled: true,
          },
        },
        entity: {
          new: () => new Task(),
          update: async (entity: Task, status: TaskStatus) => {
            entity.status = status;
            return entity;
          },
          load: async (urn: string) => invalidTask,
          status: (entity: Task) => entity.status,
          urn: (entity: Task) => entity.urn,
        },
      };

      let taskEventsProcessor: any;
      
      (Worker as jest.MockedClass<typeof Worker>).mockImplementation((name, processor) => {
        if (name === 'task-events') {
          taskEventsProcessor = processor;
        }
        return {
          close: jest.fn(),
          name,
        } as any;
      });

      const testBullmqClient = new BullMQClient(definition.bullmq!);
      const testService = new WorkflowService<Task, any, TaskEvent, TaskStatus>(definition);
      (testService as any).bullmqClient = testBullmqClient;

      await testService.onModuleInit();

      const jobData = {
        urn: 'urn:task:invalid',
      };

      const mockJob = {
        id: 'job-fail',
        name: 'task-start',
        data: jobData,
        attemptsMade: 1,
        opts: { attempts: 3 },
        queueName: 'task-events',
      } as Job;

      // Should throw error because transition is not valid from Completed state
      await expect(taskEventsProcessor(mockJob)).rejects.toThrow();

      await testBullmqClient.onModuleDestroy();
    });

    it('should trigger DLQ when job exceeds retry limit', async () => {
      // Create a task that will fail transition
      const failingTask = {
        urn: 'urn:task:failing',
        name: 'Failing Task',
        status: TaskStatus.Completed, // Invalid state for Start event
      };

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
          },
        ],
        bullmq: {
          connection: {
            host: 'localhost',
            port: 6379,
          },
          events: [
            {
              queue: 'task-events',
              event: TaskEvent.Start,
            },
          ],
          defaultJobOptions: {
            attempts: 3,
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
            return entity;
          },
          load: async (urn: string) => failingTask,
          status: (entity: Task) => entity.status,
          urn: (entity: Task) => entity.urn,
        },
      };

      let taskEventsProcessor: any;
      
      (Worker as jest.MockedClass<typeof Worker>).mockImplementation((name, processor) => {
        if (name === 'task-events') {
          taskEventsProcessor = processor;
        }
        return {
          close: jest.fn(),
          name,
        } as any;
      });

      const testBullmqClient = new BullMQClient(definition.bullmq!);
      const testService = new WorkflowService<Task, any, TaskEvent, TaskStatus>(definition);
      (testService as any).bullmqClient = testBullmqClient;

      await testService.onModuleInit();

      const jobData = {
        urn: 'urn:task:failing',
      };

      const mockJob = {
        id: 'job-fail-final',
        name: 'task-start',
        data: jobData,
        attemptsMade: 3,
        opts: { attempts: 3 },
        queueName: 'task-events',
      } as Job;

      // Should throw error and trigger DLQ
      await expect(taskEventsProcessor(mockJob)).rejects.toThrow();

      // Verify DLQ queue was created
      expect(Queue).toHaveBeenCalledWith('task-events-dlq', expect.any(Object));

      await testBullmqClient.onModuleDestroy();
    });
  });
});
