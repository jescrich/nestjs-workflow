import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowModule } from '@this/index';
import { WorkflowAction } from '@this/workflow/action.class.decorator';
import { OnEvent } from '@this/workflow/action.event.method.decorator';
import { OnStatusChanged } from '@this/workflow/action.status.method.decorator';
import { WorkflowDefinition } from '@this/workflow/definition'; // Adjust path if needed

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
  execute(params: { entity: Order; payload: any }) {
    const { entity, payload } = params;
    entity.price = entity.price * 100;
    entity.items = entity.items;
    return Promise.resolve(entity);
  }

  @OnStatusChanged({ from: OrderStatus.Pending, to: OrderStatus.Processing })
  onStatusChanged(params: { entity: Order; payload: any }) {
    const { entity, payload } = params;
    return Promise.resolve(entity);
  }
}

@Injectable()
@WorkflowAction()
export class MultipleHandlersOrderActions {
  @OnEvent({ event: OrderEvent.Submit, order: 1 })
  execute(params: { entity: Order; payload: any }) {
    const { entity, payload } = params;
    entity.price = entity.price * 100;
    entity.items = entity.items;
    entity.name += '2';
    return Promise.resolve(entity);
  }

  @OnEvent({ event: OrderEvent.Submit, order: 2 })
  execute2(params: { entity: Order; payload: any }) {
    const { entity, payload } = params;
    entity.price = entity.price * 100;
    entity.items = entity.items;
    entity.name += '3';
    return Promise.resolve(entity);
  }
}

@Injectable()
@WorkflowAction()
export class StatusOrderActions {
  @OnStatusChanged({ from: OrderStatus.Pending, to: OrderStatus.Processing })
  onStatusChanged(params: { entity: Order; payload: any }) {
    const { entity, payload } = params;
    entity.name = 'new name after status changed to processing';
    return Promise.resolve(entity);
  }
}

@Injectable()
@WorkflowAction()
export class FailingStatusOrderActions {
  @OnStatusChanged({ from: OrderStatus.Pending, to: OrderStatus.Processing })
  onStatusChanged(params: { entity: Order; payload: any }) {
    const { entity, payload } = params;
    throw new Error("must be fail")
    return Promise.resolve(entity);
  }
}

@Injectable()
@WorkflowAction()
export class FailingButNotStatusOrderActions {
  @OnStatusChanged({ from: OrderStatus.Pending, to: OrderStatus.Processing, failOnError: false })
  onStatusChanged(params: { entity: Order; payload: any }) {
    const { entity, payload } = params;
    throw new Error("must be fail")
    return Promise.resolve(entity);
  }
}

@Injectable()
@WorkflowAction()
export class InvalidOrderActions {
  @OnEvent({ event: OrderEvent.Submit })
  execute(foo: number) {
    return Promise.resolve(foo);
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

    const orderWorkflow = module.get('simpleworkflow');
    const result = await orderWorkflow.emit({ urn: order.urn, event: OrderEvent.Submit });
    expect(result.status).toBe(OrderStatus.Processing);
  });

  it('should move from Submit to Processing and increase price * 10 using defined action', async () => {
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

    const orderWorkflow = await module.resolve('simpleworkflow');
    await orderWorkflow.onModuleInit();
    const result = await orderWorkflow.emit({ urn: order.urn, event: OrderEvent.Submit });
    expect(result.status).toBe(OrderStatus.Processing);
    expect(result.price).toBe(10000);
  });

  it('should NOT move from Submit to Processing since action is invalid', async () => {
    const order = new Order();
    order.urn = 'urn:order:123';
    order.name = 'Order 123';
    order.price = 100;
    order.items = ['Item 1', 'Item 2', 'Item 3'];
    order.status = OrderStatus.Pending;

    const definition = simpleDefinition(order);

    definition.Actions = [InvalidOrderActions];

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        WorkflowModule.register({
          name: 'simpleworkflow',
          definition,
        }),
      ],
      providers: [InvalidOrderActions],
      exports: [ModuleRef],
    }).compile();

    const orderWorkflow = await module.resolve('simpleworkflow');
    try {
      await orderWorkflow.onModuleInit();
    } catch (error) {
      expect(error.message).toBe('Action method execute must have signature (params: { entity: T, payload?: P | T | object | string })');
    }
  });

  it('must call all the actions defined in the workflow and return the result of the last action', async () => {
    const order = new Order();
    order.urn = 'urn:order:123';
    order.name = 'Order 123';
    order.price = 100;
    order.items = ['Item 1', 'Item 2', 'Item 3'];
    order.status = OrderStatus.Pending;

    const definition = simpleDefinition(order);

    definition.Actions = [MultipleHandlersOrderActions];

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        WorkflowModule.register({
          name: 'simpleworkflow',
          definition,
        }),
      ],
      providers: [MultipleHandlersOrderActions],
      exports: [ModuleRef],
    }).compile();

    const orderWorkflow = await module.resolve('simpleworkflow');
    await orderWorkflow.onModuleInit();
    const result = await orderWorkflow.emit({ urn: order.urn, event: OrderEvent.Submit });
    expect(result.status).toBe(OrderStatus.Processing);
    expect(result.price).toBe(1000000);
    expect(result.name).toBe('Order 12323');
  });

  it('must call all the actions defined in the workflow and all the status change handlers', async () => {
    const order = new Order();
    order.urn = 'urn:order:123';
    order.name = 'Order 123';
    order.price = 100;
    order.items = ['Item 1', 'Item 2', 'Item 3'];
    order.status = OrderStatus.Pending;

    const definition = simpleDefinition(order);

    definition.Actions = [StatusOrderActions];

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        WorkflowModule.register({
          name: 'simpleworkflow',
          definition,
        }),
      ],
      providers: [StatusOrderActions],
      exports: [ModuleRef],
    }).compile();

    const orderWorkflow = await module.resolve('simpleworkflow');
    await orderWorkflow.onModuleInit();
    const result = await orderWorkflow.emit({ urn: order.urn, event: OrderEvent.Submit });
    expect(result.status).toBe(OrderStatus.Processing);
    expect(result.name).toBe('new name after status changed to processing');
  });

  it('must be failed when on status change action fails', async () => {
    const order = new Order();
    order.urn = 'urn:order:123';
    order.name = 'Order 123';
    order.price = 100;
    order.items = ['Item 1', 'Item 2', 'Item 3'];
    order.status = OrderStatus.Pending;

    const definition = simpleDefinition(order);

    definition.Actions = [FailingStatusOrderActions];

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        WorkflowModule.register({
          name: 'simpleworkflow',
          definition,
        }),
      ],
      providers: [FailingStatusOrderActions],
      exports: [ModuleRef],
    }).compile();

    const orderWorkflow = await module.resolve('simpleworkflow');
    await orderWorkflow.onModuleInit();
    const result = await orderWorkflow.emit({ urn: order.urn, event: OrderEvent.Submit });
    expect(result.status).toBe(OrderStatus.Failed);
  });

  it('must NOT be failed when on status change action fails but failOnError is false', async () => {
    const order = new Order();
    order.urn = 'urn:order:123';
    order.name = 'Order 123';
    order.price = 100;
    order.items = ['Item 1', 'Item 2', 'Item 3'];
    order.status = OrderStatus.Pending;

    const definition = simpleDefinition(order);

    definition.Actions = [FailingButNotStatusOrderActions];

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        WorkflowModule.register({
          name: 'simpleworkflow',
          definition,
        }),
      ],
      providers: [FailingButNotStatusOrderActions],
      exports: [ModuleRef],
    }).compile();

    const orderWorkflow = await module.resolve('simpleworkflow');
    await orderWorkflow.onModuleInit();
    const result = await orderWorkflow.emit({ urn: order.urn, event: OrderEvent.Submit });
    expect(result.status).toBe(OrderStatus.Processing);
  });
});
