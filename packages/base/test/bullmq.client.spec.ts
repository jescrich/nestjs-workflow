import { BullMQClient } from '@this/workflow/bullmq/client';
import { BullMQConfig, WorkflowJobData } from '@this/workflow/definition';
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

describe('BullMQClient', () => {
  let bullmqClient: BullMQClient;
  let config: BullMQConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    config = {
      connection: {
        host: 'localhost',
        port: 6379,
      },
      events: [],
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 30000,
        },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
      deadLetterQueue: {
        enabled: true,
        suffix: '-dlq',
      },
    };

    bullmqClient = new BullMQClient(config);
  });

  afterEach(async () => {
    await bullmqClient.onModuleDestroy();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(bullmqClient).toBeDefined();
      expect((bullmqClient as any).connection.host).toBe('localhost');
      expect((bullmqClient as any).connection.port).toBe(6379);
      expect((bullmqClient as any).defaultJobOptions.attempts).toBe(3);
      expect((bullmqClient as any).dlqConfig.enabled).toBe(true);
      expect((bullmqClient as any).dlqConfig.suffix).toBe('-dlq');
    });

    it('should use default values when optional config is not provided', () => {
      const minimalConfig: BullMQConfig = {
        connection: {
          host: 'localhost',
          port: 6379,
        },
        events: [],
      };

      const client = new BullMQClient(minimalConfig);
      expect((client as any).defaultJobOptions.attempts).toBe(3);
      expect((client as any).defaultJobOptions.backoff.type).toBe('exponential');
      expect((client as any).defaultJobOptions.backoff.delay).toBe(30000);
      expect((client as any).dlqConfig.enabled).toBe(false);
      expect((client as any).dlqConfig.suffix).toBe('-dlq');
    });
  });

  describe('Queue Producer Functionality', () => {
    it('should produce a job with correct data structure', async () => {
      const queueName = 'test-queue';
      const jobName = 'test-job';
      const data: WorkflowJobData<any> = {
        urn: 'urn:test:123',
        payload: { test: 'data' },
      };

      const result = await bullmqClient.produce(queueName, jobName, data);

      expect(Queue).toHaveBeenCalledWith(queueName, {
        connection: config.connection,
      });
      expect(result).toBeDefined();
      expect(result.id).toBe('job-123');
    });

    it('should throw error when job addition fails', async () => {
      const queueName = 'error-queue';
      const jobName = 'test-job';
      const data: WorkflowJobData<any> = {
        urn: 'urn:test:123',
      };

      // Mock Queue to throw error for this specific queue
      (Queue as jest.MockedClass<typeof Queue>).mockImplementationOnce((name) => ({
        add: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
        close: jest.fn().mockResolvedValue(undefined),
        client: Promise.resolve({
          ping: jest.fn().mockResolvedValue('PONG'),
        }),
        name,
      } as any));

      await expect(bullmqClient.produce(queueName, jobName, data)).rejects.toThrow(
        'Failed to add job to queue',
      );
    });

    it('should reuse queue instances', async () => {
      const queueName = 'reuse-queue';
      const jobName1 = 'test-job-1';
      const jobName2 = 'test-job-2';
      const data: WorkflowJobData<any> = {
        urn: 'urn:test:123',
      };

      const initialCallCount = (Queue as jest.MockedClass<typeof Queue>).mock.calls.length;

      await bullmqClient.produce(queueName, jobName1, data);
      await bullmqClient.produce(queueName, jobName2, data);

      // Queue constructor should only be called once for the same queue name
      const queueCalls = (Queue as jest.MockedClass<typeof Queue>).mock.calls.filter(
        (call) => call[0] === queueName,
      );
      expect(queueCalls.length).toBe(1);
    });
  });

  describe('Queue Consumer with Retry Logic', () => {
    it('should create worker and process jobs successfully', async () => {
      const queueName = 'test-queue';
      const handler = jest.fn().mockResolvedValue(undefined);

      await bullmqClient.consume(queueName, handler);

      expect(Worker).toHaveBeenCalledWith(
        queueName,
        expect.any(Function),
        expect.objectContaining({
          connection: config.connection,
        }),
      );
    });

    it('should call handler with job data', async () => {
      const queueName = 'test-queue';
      const handler = jest.fn().mockResolvedValue(undefined);
      const jobData: WorkflowJobData<any> = {
        urn: 'urn:test:123',
        payload: { test: 'data' },
      };

      let workerProcessor: any;
      (Worker as jest.MockedClass<typeof Worker>).mockImplementation((name, processor) => {
        workerProcessor = processor;
        return {
          close: jest.fn(),
          name,
        } as any;
      });

      await bullmqClient.consume(queueName, handler);

      const mockJob = {
        id: 'job-123',
        name: 'test-job',
        data: jobData,
        attemptsMade: 0,
        opts: { attempts: 3 },
        queueName,
      } as Job<WorkflowJobData<any>>;

      await workerProcessor(mockJob);

      expect(handler).toHaveBeenCalledWith(mockJob);
    });

    it('should re-throw error to trigger BullMQ retry', async () => {
      const queueName = 'test-queue';
      const error = new Error('Processing failed');
      const handler = jest.fn().mockRejectedValue(error);
      const jobData: WorkflowJobData<any> = {
        urn: 'urn:test:123',
      };

      let workerProcessor: any;
      (Worker as jest.MockedClass<typeof Worker>).mockImplementation((name, processor) => {
        workerProcessor = processor;
        return {
          close: jest.fn(),
          name,
        } as any;
      });

      await bullmqClient.consume(queueName, handler);

      const mockJob = {
        id: 'job-123',
        name: 'test-job',
        data: jobData,
        attemptsMade: 1,
        opts: { attempts: 3 },
        queueName,
      } as Job<WorkflowJobData<any>>;

      await expect(workerProcessor(mockJob)).rejects.toThrow('Processing failed');
    });
  });

  describe('Dead Letter Queue Functionality', () => {
    it('should send job to DLQ after exceeding retry limit', async () => {
      const queueName = 'test-queue';
      const error = new Error('Processing failed');
      const handler = jest.fn().mockRejectedValue(error);
      const jobData: WorkflowJobData<any> = {
        urn: 'urn:test:123',
        payload: { test: 'data' },
      };

      let workerProcessor: any;
      (Worker as jest.MockedClass<typeof Worker>).mockImplementation((name, processor) => {
        workerProcessor = processor;
        return {
          close: jest.fn(),
          name,
        } as any;
      });

      await bullmqClient.consume(queueName, handler);

      const mockJob = {
        id: 'job-123',
        name: 'test-job',
        data: jobData,
        attemptsMade: 3,
        opts: { attempts: 3 },
        queueName,
      } as Job<WorkflowJobData<any>>;

      const mockDLQQueue = (Queue as jest.MockedClass<typeof Queue>).mock.results[1]?.value;
      if (mockDLQQueue) {
        (mockDLQQueue.add as jest.Mock).mockResolvedValue({ id: 'dlq-job-123' });
      }

      await expect(workerProcessor(mockJob)).rejects.toThrow('Processing failed');

      // Verify DLQ queue was created
      expect(Queue).toHaveBeenCalledWith(`${queueName}-dlq`, {
        connection: config.connection,
      });
    });

    it('should not send to DLQ when disabled', async () => {
      const configWithoutDLQ: BullMQConfig = {
        ...config,
        deadLetterQueue: {
          enabled: false,
        },
      };

      const clientWithoutDLQ = new BullMQClient(configWithoutDLQ);
      const queueName = 'test-queue';
      const error = new Error('Processing failed');
      const handler = jest.fn().mockRejectedValue(error);
      const jobData: WorkflowJobData<any> = {
        urn: 'urn:test:123',
      };

      let workerProcessor: any;
      (Worker as jest.MockedClass<typeof Worker>).mockImplementation((name, processor) => {
        workerProcessor = processor;
        return {
          close: jest.fn(),
          name,
        } as any;
      });

      await clientWithoutDLQ.consume(queueName, handler);

      const mockJob = {
        id: 'job-123',
        name: 'test-job',
        data: jobData,
        attemptsMade: 3,
        opts: { attempts: 3 },
        queueName,
      } as Job<WorkflowJobData<any>>;

      await expect(workerProcessor(mockJob)).rejects.toThrow('Processing failed');

      // Verify DLQ queue was not created
      const dlqQueueCalls = (Queue as jest.MockedClass<typeof Queue>).mock.calls.filter(
        (call) => call[0] === `${queueName}-dlq`,
      );
      expect(dlqQueueCalls.length).toBe(0);
    });
  });

  describe('Health Check', () => {
    it('should return true when Redis is healthy', async () => {
      const result = await bullmqClient.isHealthy();
      expect(result).toBe(true);
    });

    it('should return false when Redis connection fails', async () => {
      // Mock Queue to throw error for health check
      (Queue as jest.MockedClass<typeof Queue>).mockImplementationOnce((name) => ({
        add: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined),
        client: Promise.resolve({
          ping: jest.fn().mockRejectedValue(new Error('Connection failed')),
        }),
        name,
      } as any));

      const result = await bullmqClient.isHealthy();
      expect(result).toBe(false);
    });
  });

  describe('Graceful Shutdown', () => {
    it('should close all workers and queues', async () => {
      const queueName = 'shutdown-queue';
      const handler = jest.fn().mockResolvedValue(undefined);
      const jobData: WorkflowJobData<any> = {
        urn: 'urn:test:123',
      };

      const mockQueueClose = jest.fn().mockResolvedValue(undefined);
      const mockWorkerClose = jest.fn().mockResolvedValue(undefined);

      // Track the mocks
      (Queue as jest.MockedClass<typeof Queue>).mockImplementationOnce((name) => ({
        add: jest.fn().mockResolvedValue({ id: 'job-123', name: 'test-job' }),
        close: mockQueueClose,
        client: Promise.resolve({
          ping: jest.fn().mockResolvedValue('PONG'),
        }),
        name,
      } as any));

      (Worker as jest.MockedClass<typeof Worker>).mockImplementationOnce((name) => ({
        close: mockWorkerClose,
        name,
      } as any));

      await bullmqClient.produce(queueName, 'test-job', jobData);
      await bullmqClient.consume(queueName, handler);

      await bullmqClient.onModuleDestroy();

      expect(mockWorkerClose).toHaveBeenCalled();
      expect(mockQueueClose).toHaveBeenCalled();
    });

    it('should handle errors during shutdown gracefully', async () => {
      const queueName = 'test-queue';
      const handler = jest.fn().mockResolvedValue(undefined);

      const mockWorker = (Worker as jest.MockedClass<typeof Worker>).mock.results[0]?.value;
      if (mockWorker) {
        (mockWorker.close as jest.Mock).mockRejectedValue(new Error('Close failed'));
      }

      await bullmqClient.consume(queueName, handler);

      // Should not throw error
      await expect(bullmqClient.onModuleDestroy()).resolves.not.toThrow();
    });
  });
});
