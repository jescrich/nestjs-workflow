import { ModuleRef } from '@nestjs/core';
import { WorkflowDefinition } from '@this/workflow/definition'; // Adjust path if needed
import WorkflowService from '@this/workflow/service';
import { DeepMocked, createMock } from '@golevelup/ts-jest';

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
    FinalStates: [OrderStatus.Completed, OrderStatus.Failed],
    IdleStates: [OrderStatus.Pending, OrderStatus.Processing, OrderStatus.Completed, OrderStatus.Failed],
    Transitions: [
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
    const moduleRef = createMock<ModuleRef>();
    const workflow = new WorkflowService<Order, String, OrderEvent, OrderStatus>(simpleDefinition(order), moduleRef);
    const result = await workflow.emit({ urn: order.urn, event: OrderEvent.Submit });
    expect(result.status).toBe(OrderStatus.Processing);
  });

  it('should NOT move from Submit to Processing, since not meet conditions', async () => {
    const order = new Order();
    order.urn = 'urn:order:123';
    order.name = 'Order 123';
    order.price = 1;
    order.items = ['Item 1', 'Item 2', 'Item 3'];
    order.status = OrderStatus.Pending;

    const moduleRef = createMock<ModuleRef>();
    const workflow = new WorkflowService<Order, String, OrderEvent, OrderStatus>(simpleDefinition(order), moduleRef);
    const result = await workflow.emit({ urn: order.urn, event: OrderEvent.Submit });
    expect(result.status).toBe(OrderStatus.Pending);
  });

  it('should able to update an order in Pending State', async () => {
    const order = new Order();
    order.urn = 'urn:order:123';
    order.name = 'Order 123';
    order.price = 100;
    order.items = ['Item 1', 'Item 2', 'Item 3'];
    order.status = OrderStatus.Pending;
    const moduleRef = createMock<ModuleRef>();
    const workflow = new WorkflowService<Order, String, OrderEvent, OrderStatus>(simpleDefinition(order), moduleRef);
    const result = await workflow.emit({
      urn: order.urn,
      event: OrderEvent.Update,
      payload: {
        price: 1000,
        items: [...order.items, 'Item 4'],
      },
    });

    expect(result.price).toBe(1000);
    expect(result.items).toEqual(['Item 1', 'Item 2', 'Item 3', 'Item 4']);
  });
});
