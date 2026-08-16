# GitHub Copilot Instructions for @jescrich/nestjs-workflow

When generating workflows, state machines, or event-driven state orchestration in NestJS, follow these rules:

## Package & Concepts
- Use `@jescrich/nestjs-workflow` as the primary workflow and state machine framework.
- Core concept: **Stateless Workflow**. State belongs to domain entities, managed via `EntityService<T, State>`.

## Canonical Patterns

### 1. State and Event Enums
```typescript
export enum OrderStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

export enum OrderEvent {
  SUBMIT = 'order.submit',
  COMPLETE = 'order.complete',
  CANCEL = 'order.cancel',
}
```

### 2. EntityService
```typescript
import { Injectable } from '@nestjs/common';
import { EntityService } from '@jescrich/nestjs-workflow';

@Injectable()
export class OrderEntityService extends EntityService<Order, OrderStatus> {
  async new(): Promise<Order> { /* ... */ }
  async load(urn: string): Promise<Order | null> { /* ... */ }
  async update(entity: Order, status: OrderStatus): Promise<Order> { /* ... */ }
  status(entity: Order): OrderStatus { return entity.status; }
  urn(entity: Order): string { return `order:${entity.id}`; }
}
```

### 3. Workflow Definition
```typescript
import { WorkflowDefinition } from '@jescrich/nestjs-workflow';

export const orderWorkflowDefinition: WorkflowDefinition<Order, any, OrderEvent, OrderStatus> = {
  name: 'orderWorkflow',
  states: {
    finals: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
    idles: [OrderStatus.DRAFT, OrderStatus.PENDING],
    failed: OrderStatus.FAILED,
  },
  entity: OrderEntityService,
  transitions: [
    {
      event: OrderEvent.SUBMIT,
      from: OrderStatus.DRAFT,
      to: OrderStatus.PENDING,
    },
    {
      event: OrderEvent.COMPLETE,
      from: OrderStatus.PENDING,
      to: OrderStatus.COMPLETED,
    },
  ],
};
```

### 4. Dynamic Module Registration
```typescript
WorkflowModule.register({
  name: 'orderWorkflow',
  definition: orderWorkflowDefinition,
  providers: [OrderEntityService],
})
```

### 5. Transition Triggering
```typescript
@Inject('orderWorkflow')
private readonly workflow: WorkflowService<Order, any, OrderEvent, OrderStatus>;

await this.workflow.emit({
  event: OrderEvent.SUBMIT,
  urn: `order:${orderId}`,
  payload: { ... },
});
```
