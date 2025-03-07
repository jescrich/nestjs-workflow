import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowModule } from '@this/index';
import { WorkflowAction } from '@this/workflow/action.class.decorator';
import { OnEvent } from '@this/workflow/action.event.method.decorator';
import { OnStatusChanged } from '@this/workflow/action.status.method.decorator';
import { WorkflowDefinition } from '@this/workflow/definition'; // Adjust path if needed
import WorkflowService from '@this/workflow/service';

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

@Injectable()
@WorkflowAction()
export class OrderActions {
  @OnEvent({ event: OrderEvent.Submit })
  execute(entity: Order, payload: any) {
    entity.price = payload.price * 100;
    entity.items = payload.items;
    return Promise.resolve(entity);
  }

  @OnStatusChanged({ from: OrderStatus.Pending, to: OrderStatus.Processing })
  onStatusChanged(entity: Order, payload: any) {
    entity.status = payload.status;
    return Promise.resolve(entity);
  }
}

const simpleDefinition = (entity: Order) => {
  const definition: WorkflowDefinition<Order, any, OrderEvent, OrderStatus> = {
    Actions: [OrderActions],
    FinalStates: [OrderStatus.Completed, OrderStatus.Failed],
    IdleStates: [OrderStatus.Pending, OrderStatus.Processing, OrderStatus.Completed, OrderStatus.Failed],
    Transitions: [
      {
        from: OrderStatus.Pending,
        to: OrderStatus.Processing,
        event: OrderEvent.Submit,
      },
    ],
    FailedState: OrderStatus.Failed,
    Entity: {
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

describe('Simple Order Workflow', () => {
  
  it('should move from Submit to Processing', async () => {
    const order = new Order();
    order.urn = 'urn:order:123';
    order.name = 'Order 123';
    order.price = 100;
    order.items = ['Item 1', 'Item 2', 'Item 3'];
    order.status = OrderStatus.Pending;

    const definition = simpleDefinition(order);

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        WorkflowModule.register({
          name: 'simpleworkflow',
          definition,
        }),
      ],
      providers: [OrderActions],
    }).compile();

    const orderWorkflow = module.get("simpleworkflow");
    const result = await orderWorkflow.emit({ urn: order.urn, event: OrderEvent.Submit });
    expect(result.status).toBe(OrderStatus.Processing);
  });

  it('should move from Submit to Processing and increase price * 10', async () => {
    const order = new Order();
    order.urn = 'urn:order:123';
    order.name = 'Order 123';
    order.price = 100;
    order.items = ['Item 1', 'Item 2', 'Item 3'];
    order.status = OrderStatus.Pending;

    const definition = simpleDefinition(order);

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        WorkflowModule.register({
          name: 'simpleworkflow',
          definition,
        }),
      ],
      providers: [OrderActions],
      exports: [ModuleRef],
    }).compile();

    const moduleRef = module.get(ModuleRef);

    expect(moduleRef).toBeDefined();

    const orderWorkflow = module.get("simpleworkflow");
    orderWorkflow.onModuleInit();
    const result = await orderWorkflow.emit({ urn: order.urn, event: OrderEvent.Submit });
    expect(result.status).toBe(OrderStatus.Processing);
    expect(result.price).toBe(10000);
  });
});
