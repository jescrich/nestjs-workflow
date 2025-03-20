import { Global, Injectable, Module } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowModule } from '@this/index';
import { WorkflowAction } from '@this/workflow/action.class.decorator';
import { OnEvent } from '@this/workflow/action.event.method.decorator';
import { OnStatusChanged } from '@this/workflow/action.status.method.decorator';
import { WorkflowDefinition } from '@this/workflow/definition'; // Adjust path if needed
import { EntityService } from '@this/workflow/entity.service';

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

let order = new Order();

@Injectable()
class OrdersRepository {
  async load(urn: string): Promise<Order> {
    if (urn === 'urn:order:nonexistent') return Promise.reject('not found');
    return Promise.resolve(order);
  }
}

@Injectable()
class OrderEntityService implements EntityService<Order, OrderStatus> {
  constructor(
    private moduleRef: ModuleRef,
    private readonly repository: OrdersRepository,
  ) {}

  new(): Promise<Order> {
    return Promise.resolve(new Order());
  }
  update(entity: Order, status: OrderStatus): Promise<Order> {
    entity.status = status;
    return Promise.resolve(entity);
  }
  load(urn: string): Promise<Order> {
    return this.repository.load(urn);
  }
  status(entity: Order): OrderStatus {
    return entity.status;
  }
  urn(entity: Order): string {
    return entity.urn;
  }
}

@Injectable()
export class OrderActions {}

const TestWorkflowDefinition = (entity: Order) => {
  const definition: WorkflowDefinition<Order, any, OrderEvent, OrderStatus> = {
    name: 'OrderWorkflow',
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
    Entity: OrderEntityService,
  };
  return definition;
};

@Global()
@Module({
  imports: [
    WorkflowModule.register({
      name: 'fooWorkflow',
      definition: TestWorkflowDefinition(order),
      providers: [
        {
          provide: EntityService<Order, OrderStatus>,
          useClass: OrderEntityService,
        },
      ],
    }),
  ],
  providers: [OrderActions, OrdersRepository],
  exports: [OrdersRepository],
})
export class CustomModel {}

describe('Entity Service dependant Order Workflow', () => {
  beforeEach(async () => {
    order = new Order();
    order.urn = 'urn:order:123';
    order.name = 'Order 123';
    order.price = 100;
    order.items = ['Item 1', 'Item 2', 'Item 3'];
    order.status = OrderStatus.Pending;
  });
  it('should initialize and resolve the entity service.', async () => {
    const definition = TestWorkflowDefinition(order);

    const module: TestingModule = await Test.createTestingModule({
      imports: [CustomModel],
    }).compile();

    const orderWorkflow = module.get('fooWorkflow');
    await orderWorkflow.onModuleInit();
    const result = await orderWorkflow.emit({ urn: order.urn, event: OrderEvent.Submit });
    expect(result.status).toBe(OrderStatus.Processing);
  });
  it('should complete the order workflow successfully', async () => {
    const definition = TestWorkflowDefinition(order);
    const module: TestingModule = await Test.createTestingModule({
      imports: [CustomModel],
    }).compile();

    const orderWorkflow = module.get('fooWorkflow');
    await orderWorkflow.onModuleInit();

    // Submit the order
    let result = await orderWorkflow.emit({ urn: order.urn, event: OrderEvent.Submit });
    expect(result.status).toBe(OrderStatus.Processing);

    // Complete the order
    result = await orderWorkflow.emit({ urn: order.urn, event: OrderEvent.Complete });
    expect(result.status).toBe(OrderStatus.Completed);
  });

  it('should fail the order workflow', async () => {
    const definition = TestWorkflowDefinition(order);
    const module: TestingModule = await Test.createTestingModule({
      imports: [CustomModel],
    }).compile();

    const orderWorkflow = module.get('fooWorkflow');
    await orderWorkflow.onModuleInit();

    // Submit the order
    let result = await orderWorkflow.emit({ urn: order.urn, event: OrderEvent.Submit });
    expect(result.status).toBe(OrderStatus.Processing);

    // Fail the order
    result = await orderWorkflow.emit({ urn: order.urn, event: OrderEvent.Fail });
    expect(result.status).toBe(OrderStatus.Failed);
  });

  it('should throw error for invalid state transition', async () => {
    const definition = TestWorkflowDefinition(order);
    const module: TestingModule = await Test.createTestingModule({
      imports: [CustomModel],
    }).compile();

    const orderWorkflow = module.get('fooWorkflow');
    await orderWorkflow.onModuleInit();

    await expect(
      orderWorkflow.emit({
        urn: order.urn,
        event: OrderEvent.Complete,
      }),
    ).rejects.toThrow();
  });

  it('should throw error for non-existent order', async () => {
    const definition = TestWorkflowDefinition(order);
    const module: TestingModule = await Test.createTestingModule({
      imports: [CustomModel],
    }).compile();

    const orderWorkflow = module.get('fooWorkflow');
    await orderWorkflow.onModuleInit();

    await expect(
      orderWorkflow.emit({
        urn: 'urn:order:nonexistent',
        event: OrderEvent.Submit,
      }),
    ).rejects.toThrow();
  });

  it('should maintain order data through state transitions', async () => {
    const definition = TestWorkflowDefinition(order);
    const module: TestingModule = await Test.createTestingModule({
      imports: [CustomModel],
    }).compile();

    const orderWorkflow = module.get('fooWorkflow');
    await orderWorkflow.onModuleInit();

    let result = await orderWorkflow.emit({ urn: order.urn, event: OrderEvent.Submit });
    expect(result.name).toBe('Order 123');
    expect(result.price).toBe(100);
    expect(result.items).toEqual(['Item 1', 'Item 2', 'Item 3']);

    result = await orderWorkflow.emit({ urn: order.urn, event: OrderEvent.Complete });
    expect(result.name).toBe('Order 123');
    expect(result.price).toBe(100);
    expect(result.items).toEqual(['Item 1', 'Item 2', 'Item 3']);
  });
});
