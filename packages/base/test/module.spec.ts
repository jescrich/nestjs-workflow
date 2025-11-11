import { Inject, Injectable, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowDefinition, BullMQConfig } from '@this/workflow/definition';
import { WorkflowModule } from '@this/workflow/module';
import { Workflow, WorkflowService } from '@this/workflow/service';
import { BullMQClient } from '@this/workflow/bullmq/client';
import { KafkaClient } from '@this/workflow/kafka/client';

export enum OrderEvent {
  Create = 'order.create',
  Submit = 'order.submit',
  Pending = 'order.pending',
  Complete = 'order.complete',
  Fail = 'order.fail',
  Update = 'order.update',
  Cancel = 'order.cancel',
}

export enum OrderStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
}

export class Order {
  urn: string;
  name: string;
  price: number;
  items: string[];
  status: OrderStatus;
}

const simpleDefinition = (entity: Order) => {
  const definition: WorkflowDefinition<Order, any, OrderEvent, OrderStatus> = {
    states: {
      finals: [OrderStatus.Completed, OrderStatus.Failed],
      idles: [OrderStatus.Pending, OrderStatus.Processing, OrderStatus.Completed, OrderStatus.Failed],
      failed: OrderStatus.Failed,
    },
    transitions: [
      {
        from: OrderStatus.Pending,
        to: OrderStatus.Processing,
        event: OrderEvent.Submit,
        conditions: [(entity: Order, payload: any) => entity.price > 10],
      },
      {
        from: OrderStatus.Pending,
        to: OrderStatus.Pending,
        event: OrderEvent.Update,
        actions: [
          (entity: Order, payload: any) => {
            entity.price = payload.price;
            entity.items = payload.items;
            return Promise.resolve(entity);
          },
        ],
      },
      {
        from: OrderStatus.Processing,
        to: OrderStatus.Completed,
        event: OrderEvent.Complete,
      },
      {
        from: OrderStatus.Processing,
        to: OrderStatus.Failed,
        event: OrderEvent.Fail,
      },
    ],
    entity: {
      new: () => new Order(),
      update: async (entity: Order, status: OrderStatus) => {
        entity.status = status;
        return entity;
      },
      load: async (urn: string) => {
        return entity;
      },
      status: (entity: Order) => entity.status,
      urn: function (entity: Order): string {
        return entity.urn;
      },
    },
  };
  return definition;
};

describe('WorkflowModule', () => {
  
  beforeEach(async () => {});

  it('must be able to register a workflow then resolve it', async () => {
    const order = new Order();
    const definition = simpleDefinition(order);
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        WorkflowModule.register({
          name: 'simpleworkflow',
          definition,
        }),
      ],
    }).compile();

    const orderWorkflow = module.get(WorkflowService<Order, any, OrderEvent, OrderStatus>);
    expect(orderWorkflow).toBeDefined();
  });

  it('must be able to register a workflow then use it', async () => {
    const order = new Order();
    order.urn = 'urn:order:123';
    order.status = OrderStatus.Pending;
    order.price = 100;

    const definition = simpleDefinition(order);
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        WorkflowModule.register({
          name: 'simpleworkflow',
          definition,
        }),
      ],
    }).compile();

    const orderWorkflow = module.get("simpleworkflow");

    const result = await orderWorkflow.emit({ urn: 'urn:order:123', event: OrderEvent.Submit });
    expect(result).toBeDefined();
    expect(result.status).toBe(OrderStatus.Processing);
    
  });

  it('must be able to register and injected in a service', async () => {

    @Injectable()
    class FooService {
        constructor(
            @Inject('simpleworkflow')
            private readonly orderWorkflow: Workflow<Order, OrderEvent>) {}

        async submitOrder(urn: string) {
            return await this.orderWorkflow.emit({ urn, event: OrderEvent.Submit });
        }
    }

    const order = new Order();
    order.urn = 'urn:order:123';
    order.status = OrderStatus.Pending;
    order.price = 100;

    const definition = simpleDefinition(order);
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        WorkflowModule.register({
          name: 'simpleworkflow',
          definition,
        }),
      ],
      providers: [
        FooService,
      ]
    }).compile();

    const foo = module.get<FooService>(FooService);

    expect(foo).toBeDefined();

    const result = await foo.submitOrder('urn:order:123');
    expect(result).toBeDefined();
    expect(result.status).toBe(OrderStatus.Processing);
  });

  describe('BullMQ Integration', () => {
    const bullmqConfig: BullMQConfig = {
      connection: {
        host: 'localhost',
        port: 6379,
      },
      events: [
        { queue: 'order-events', event: OrderEvent.Submit },
      ],
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30000 },
      },
      deadLetterQueue: {
        enabled: true,
        suffix: '-dlq',
      },
    };

    it('should register module with BullMQ configuration', async () => {
      const order = new Order();
      order.urn = 'urn:order:123';
      order.status = OrderStatus.Pending;
      order.price = 100;

      const definition = simpleDefinition(order);
      definition.bullmq = bullmqConfig;

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          WorkflowModule.register({
            name: 'bullmq-workflow',
            definition,
            bullmq: {
              enabled: true,
              config: bullmqConfig,
            },
          }),
        ],
      }).compile();

      const workflow = module.get('bullmq-workflow');
      expect(workflow).toBeDefined();
    });

    it('should create BullMQClient provider when BullMQ is enabled', async () => {
      const order = new Order();
      const definition = simpleDefinition(order);
      definition.bullmq = bullmqConfig;

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          WorkflowModule.register({
            name: 'bullmq-workflow',
            definition,
            bullmq: {
              enabled: true,
              config: bullmqConfig,
            },
          }),
        ],
      }).compile();

      const bullmqClient = module.get(BullMQClient);
      expect(bullmqClient).toBeDefined();
      expect(bullmqClient).toBeInstanceOf(BullMQClient);

      // Cleanup
      await module.close();
    });

    it('should throw error when both Kafka and BullMQ are enabled', async () => {
      const order = new Order();
      const definition = simpleDefinition(order);
      definition.bullmq = bullmqConfig;
      definition.kafka = {
        brokers: 'localhost:9092',
        events: [{ topic: 'order-events', event: OrderEvent.Submit }],
      };

      expect(() => {
        WorkflowModule.register({
          name: 'invalid-workflow',
          definition,
          kafka: {
            enabled: true,
            clientId: 'test-client',
            brokers: 'localhost:9092',
          },
          bullmq: {
            enabled: true,
            config: bullmqConfig,
          },
        });
      }).toThrow('Cannot enable both Kafka and BullMQ simultaneously');
    });

    it('should inject BullMQClient into WorkflowService', async () => {
      const order = new Order();
      const definition = simpleDefinition(order);
      definition.bullmq = bullmqConfig;

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          WorkflowModule.register({
            name: 'bullmq-workflow',
            definition,
            bullmq: {
              enabled: true,
              config: bullmqConfig,
            },
          }),
        ],
      }).compile();

      await module.init();

      // Get the BullMQClient directly to verify it exists
      const bullmqClientDirect = module.get(BullMQClient);
      expect(bullmqClientDirect).toBeDefined();
      expect(bullmqClientDirect).toBeInstanceOf(BullMQClient);

      const workflow = module.get<WorkflowService<Order, any, OrderEvent, OrderStatus>>('bullmq-workflow');
      expect(workflow).toBeDefined();
      
      // Access the private bullmqClient property
      const bullmqClient = (workflow as any).bullmqClient;
      expect(bullmqClient).toBeDefined();
      expect(bullmqClient).toBeInstanceOf(BullMQClient);

      // Cleanup
      await module.close();
    });

    it('should export BullMQClient when enabled', async () => {
      const order = new Order();
      const definition = simpleDefinition(order);
      definition.bullmq = bullmqConfig;

      @Module({
        imports: [
          WorkflowModule.register({
            name: 'bullmq-workflow',
            definition,
            bullmq: {
              enabled: true,
              config: bullmqConfig,
            },
          }),
        ],
      })
      class TestModule {}

      const module: TestingModule = await Test.createTestingModule({
        imports: [TestModule],
      }).compile();

      const bullmqClient = module.get(BullMQClient);
      expect(bullmqClient).toBeDefined();

      // Cleanup
      await module.close();
    });

    it('should maintain backward compatibility with Kafka-only configuration', async () => {
      const order = new Order();
      order.urn = 'urn:order:123';
      order.status = OrderStatus.Pending;
      order.price = 100;

      const definition = simpleDefinition(order);
      definition.kafka = {
        brokers: 'localhost:9092',
        events: [{ topic: 'order-events', event: OrderEvent.Submit }],
      };

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          WorkflowModule.register({
            name: 'kafka-workflow',
            definition,
            kafka: {
              enabled: true,
              clientId: 'test-client',
              brokers: 'localhost:9092',
            },
          }),
        ],
      }).compile();

      const workflow = module.get('kafka-workflow');
      expect(workflow).toBeDefined();

      const kafkaClient = module.get(KafkaClient);
      expect(kafkaClient).toBeDefined();

      // BullMQClient should not be available
      expect(() => module.get(BullMQClient)).toThrow();

      // Cleanup
      await module.close();
    });

    it('should work without any messaging backend', async () => {
      const order = new Order();
      order.urn = 'urn:order:123';
      order.status = OrderStatus.Pending;
      order.price = 100;

      const definition = simpleDefinition(order);

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          WorkflowModule.register({
            name: 'no-messaging-workflow',
            definition,
          }),
        ],
      }).compile();

      const workflow = module.get('no-messaging-workflow');
      expect(workflow).toBeDefined();

      // Neither client should be available
      expect(() => module.get(KafkaClient)).toThrow();
      expect(() => module.get(BullMQClient)).toThrow();

      // Workflow should still work
      const result = await workflow.emit({ urn: 'urn:order:123', event: OrderEvent.Submit });
      expect(result).toBeDefined();
      expect(result.status).toBe(OrderStatus.Processing);
    });
  });
});
