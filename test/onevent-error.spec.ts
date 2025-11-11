import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowModule } from '@this/index';
import { WorkflowAction } from '@this/workflow/action.class.decorator';
import { OnEvent } from '@this/workflow/action.event.method.decorator';
import { OnStatusChanged } from '@this/workflow/action.status.method.decorator';
import { WorkflowDefinition } from '@this/workflow/definition';

export enum OrderEvent {
  Create = 'order.create',
  Submit = 'order.submit',
  Process = 'order.process',
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
  status: OrderStatus;
}

@Injectable()
@WorkflowAction()
export class FailingOnEventAction {
  @OnEvent({ event: OrderEvent.Submit })
  execute(params: { entity: Order; payload: any }) {
    throw new Error('OnEvent action failed');
  }
}

@Injectable()
@WorkflowAction()
export class OnStatusChangedAction {
  @OnStatusChanged({ from: OrderStatus.Pending, to: OrderStatus.Processing })
  onStatusChanged(params: { entity: Order; payload: any }) {
    const { entity, payload } = params;
    entity.name = 'Status changed to processing';
    return Promise.resolve(entity);
  }
}

const testDefinition = (entity: Order) => {
  const definition: WorkflowDefinition<Order, any, OrderEvent, OrderStatus> = {
    actions: [FailingOnEventAction, OnStatusChangedAction],
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

describe('OnEvent Error Handling Bug', () => {
  it('should transition to failed state when OnEvent action throws error', async () => {
    const order = new Order();
    order.urn = 'urn:order:123';
    order.name = 'Order 123';
    order.status = OrderStatus.Pending;

    const definition = testDefinition(order);

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        WorkflowModule.register({
          name: 'testworkflow',
          definition,
        }),
      ],
      providers: [FailingOnEventAction, OnStatusChangedAction],
      exports: [ModuleRef],
    }).compile();

    const orderWorkflow = await module.resolve('testworkflow');
    await orderWorkflow.onModuleInit();
    const result = await orderWorkflow.emit({ urn: order.urn, event: OrderEvent.Submit });

    // The entity should be in Failed state, not Processing
    expect(result.status).toBe(OrderStatus.Failed);
    // OnStatusChanged action should NOT have been executed
    expect(result.name).toBe('Order 123');
  });
});
