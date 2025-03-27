import { Inject, Injectable, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowDefinition } from '@this/workflow/definition';
import { WorkflowModule } from '@this/workflow/module';
import { Workflow, WorkflowService } from '@this/workflow/service';

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
});
