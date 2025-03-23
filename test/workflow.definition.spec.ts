import { WorkflowDefinition } from '@this/workflow/definition'; // Adjust path if needed

export enum OrderEvent {
  Create = 'order.create',
  Submit = 'order.submit',
  Pending = 'order.pending',
  Process = 'order.process',
  Complete = 'order.complete',
  Fail = 'order.fail',
  Cancel = 'order.cancel',
  RequireAction = 'order.require-action',
  Error = 'order.error',
}

export enum OrderStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
  Canceled = 'canceled',
  Error = 'error',
  InputRequired = 'input-required',
}

export class Order {
  id: string;
  status: OrderStatus;
}

describe('Workflow Definition Tests', () => {
  it('should able to define it', async () => {
    const definition: WorkflowDefinition<Order, String, OrderEvent, OrderStatus> = {
      states: {
        finals: [OrderStatus.Completed, OrderStatus.Failed, OrderStatus.Canceled],
        idles: [
          OrderStatus.Pending,
          OrderStatus.Processing,
          OrderStatus.Completed,
          OrderStatus.Failed,
          OrderStatus.Canceled,
          OrderStatus.Error,],
        failed: OrderStatus.Failed,
      },
      transitions: [
        {
          from: OrderStatus.Pending,
          to: OrderStatus.Processing,
          event: OrderEvent.Submit,
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
        {
          from: OrderStatus.Pending,
          to: OrderStatus.Canceled,
          event: OrderEvent.Cancel,
        },
        {
          from: OrderStatus.Processing,
          to: OrderStatus.Canceled,
          event: OrderEvent.Cancel,
        },
        {
          from: OrderStatus.Pending,
          to: OrderStatus.Canceled,
          event: OrderEvent.Cancel,
        },
      ],

      entity: {
        new: () => new Order(),
        update: async (entity: Order, status: OrderStatus) => {
          entity.status = status;
          return entity;
        },
        load: async (urn: string) => {
          return new Order();
        },
        status: (entity: Order) => entity.status,
        urn: function (entity: Order): string {
          return entity.id;
        },
      },
    };


  });

  it('should able to define with actions and conditions', async () => {
    const definition: WorkflowDefinition<Order, String, OrderEvent, OrderStatus> = {
      states: {
        finals: [OrderStatus.Completed, OrderStatus.Failed, OrderStatus.Canceled],
        idles: [
          OrderStatus.Pending,
          OrderStatus.Processing,
          OrderStatus.Completed,
          OrderStatus.Failed,
          OrderStatus.Canceled,
          OrderStatus.Error,
        ],
        failed: OrderStatus.Failed,
      },
      transitions: [
        {
          from: OrderStatus.Pending,
          to: OrderStatus.Processing,
          event: OrderEvent.Submit,
          actions: [
            async (order: Order) => {
              order.status = OrderStatus.Processing;
              return order;
            },
          ],
        },
        {
          from: OrderStatus.Processing,
          to: OrderStatus.Completed,
          event: OrderEvent.Complete,
          conditions: [(order: Order) => order.status === OrderStatus.Processing],
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
          return new Order();
        },
        status: (entity: Order) => entity.status,
        urn: function (entity: Order): string {
          return entity.id;
        },
      },
    };
  });

  it('should able to define with just enums', async () => {
    const definition: WorkflowDefinition<Order, String, OrderEvent, OrderStatus> = {
      states: {
        finals: [OrderStatus.Completed, OrderStatus.Failed, OrderStatus.Canceled],
        idles: [
          OrderStatus.Pending,
          OrderStatus.Processing,
          OrderStatus.Completed,
          OrderStatus.Failed,
          OrderStatus.Canceled,
          OrderStatus.Error,
        ],
        failed: OrderStatus.Failed,
      },
      transitions: [
        {
          from: OrderStatus.Pending,
          to: OrderStatus.Processing,
          event: OrderEvent.Submit,
          actions: [
            async (order: Order) => {
              order.status = OrderStatus.Processing;
              return order;
            },
          ],
        },
        {
          from: OrderStatus.Processing,
          to: OrderStatus.Completed,
          event: OrderEvent.Complete,
          conditions: [(order: Order) => order.status === OrderStatus.Processing],
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
          return new Order();
        },
        status: (entity: Order) => entity.status,
        urn: function (entity: Order): string {
          return entity.id;
        },
      },
    };
  });
});
