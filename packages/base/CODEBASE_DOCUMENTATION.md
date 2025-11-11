# NestJS Workflow Library - Complete Documentation

## Overview

**@jescrich/nestjs-workflow** is a flexible workflow engine built on top of the NestJS framework, enabling developers to create, manage, and execute complex state machines and workflows in Node.js applications. The library follows a stateless architecture pattern and provides both declarative and decorator-based approaches for defining workflows.

### Key Features

- **Stateless Architecture**: No additional storage requirements - state is maintained within domain entities
- **Event-Driven**: Built on NestJS's event system for flexible workflow triggers
- **Dual Configuration Approach**: Inline functions or decorator-based action/condition definitions
- **Kafka Integration**: Built-in support for event-driven workflows via Kafka
- **TypeScript Support**: Full TypeScript support with strong typing and generics
- **Flexible Transitions**: Support for multiple from/to states and events in transitions
- **Error Handling**: Configurable error handling with failed states and fallback mechanisms
- **NestJS Integration**: Seamless integration with existing NestJS applications

## Architecture

### Core Components

#### 1. WorkflowService
The main service class that orchestrates workflow execution.

```typescript
export class WorkflowService<T, P, E, S> implements Workflow<T, E>, OnModuleInit
```

**Generic Parameters:**
- `T`: Entity type
- `P`: Payload type
- `E`: Event type (enum)
- `S`: State type (enum)

**Key Methods:**
- `emit(params: { event: E; urn: string; payload?: T | P | object | string })`: Triggers workflow transitions
- `onModuleInit()`: Initializes actions, conditions, and Kafka consumers

#### 2. WorkflowDefinition
Interface defining the complete workflow structure.

```typescript
export interface WorkflowDefinition<T, P, Event, State> {
  name?: string;
  states: {
    finals: State[];
    idles: State[];
    failed: State;
  };
  transitions: TransitionEvent<T, P, Event, State>[];
  actions?: Type<any>[];
  conditions?: Type<any>[];
  kafka?: {
    brokers: string;
    events: KafkaEvent<Event>[];
  };
  entity: EntityDefinition<T, State>;
  fallback?: (entity: T, event: Event, payload?: P | T | object | string) => Promise<T>;
}
```

#### 3. TransitionEvent
Defines individual state transitions.

```typescript
export interface TransitionEvent<T, P, Event, States> {
  event: Event | Event[];
  from: States | States[];
  to: States;
  actions?: ((entity: T, payload?: P | T | object | string) => Promise<T>)[];
  conditions?: ((entity: T, payload?: P | T | object | string) => boolean)[];
}
```

#### 4. EntityService
Abstract service for entity management operations.

```typescript
export abstract class EntityService<T, State> {
  abstract new(): Promise<T>;
  abstract update(entity: T, status: State): Promise<T>;
  abstract load(urn: string): Promise<T | null>;
  abstract status(entity: T): State;
  abstract urn(entity: T): string;
}
```

#### 5. WorkflowModule
Dynamic NestJS module for registering workflows.

```typescript
export class WorkflowModule {
  static register<T, P, Event, State>(params: {
    name: string;
    definition: WorkflowDefinition<T, P, Event, State>;
    imports?: Array<Type<any> | DynamicModule | Promise<DynamicModule> | ForwardReference>;
    providers?: Provider[];
    kafka?: {
      enabled: boolean;
      clientId: string;
      brokers: string;
    };
  }): DynamicModule
}
```

## Configuration Approaches

### 1. Inline Functions (Simple Workflows)

```typescript
const definition: WorkflowDefinition<Order, any, OrderEvent, OrderStatus> = {
  states: {
    finals: [OrderStatus.Completed, OrderStatus.Failed],
    idles: [OrderStatus.Pending, OrderStatus.Processing],
    failed: OrderStatus.Failed,
  },
  transitions: [
    {
      from: OrderStatus.Pending,
      to: OrderStatus.Processing,
      event: OrderEvent.Submit,
      conditions: [(entity: Order, payload: any) => entity.price > 10],
      actions: [
        async (entity: Order, payload: any) => {
          entity.price = payload.price;
          return entity;
        },
      ],
    },
  ],
  entity: {
    new: () => new Order(),
    update: async (entity: Order, status: OrderStatus) => {
      entity.status = status;
      return entity;
    },
    load: async (urn: string) => {
      // Load from database
      return loadOrderFromDb(urn);
    },
    status: (entity: Order) => entity.status,
    urn: (entity: Order) => entity.id,
  },
};
```

### 2. Decorator-Based Approach (Complex Workflows)

```typescript
@Injectable()
@WorkflowAction()
export class OrderActions {
  @OnEvent({ event: OrderEvent.Submit, order: 1 })
  async processSubmission(params: { entity: Order; payload: any }): Promise<Order> {
    const { entity, payload } = params;
    entity.price = entity.price * 1.1; // Add tax
    return entity;
  }

  @OnStatusChanged({ from: OrderStatus.Pending, to: OrderStatus.Processing })
  async onProcessingStarted(params: { entity: Order; payload: any }): Promise<Order> {
    const { entity, payload } = params;
    entity.processedAt = new Date();
    return entity;
  }

  @OnStatusChanged({ 
    from: OrderStatus.Processing, 
    to: OrderStatus.Failed, 
    failOnError: false 
  })
  async onProcessingFailed(params: { entity: Order; payload: any }): Promise<Order> {
    // This won't fail the workflow even if it throws
    await notifyAdmin(params.entity);
    return params.entity;
  }
}
```

## Decorators

### @WorkflowAction()
Marks a class as containing workflow actions.

```typescript
@WorkflowAction()
export class MyWorkflowActions {
  // Action methods here
}
```

### @OnEvent()
Defines event-triggered actions.

```typescript
@OnEvent({ event: MyEvent.Submit, order?: number })
async handleSubmit(params: { entity: MyEntity; payload: any }): Promise<MyEntity> {
  // Handle event
  return params.entity;
}
```

### @OnStatusChanged()
Defines status change handlers.

```typescript
@OnStatusChanged({ 
  from: MyStatus.Pending, 
  to: MyStatus.Processing, 
  failOnError?: boolean 
})
async onStatusChange(params: { entity: MyEntity; payload: any }): Promise<MyEntity> {
  // Handle status change
  return params.entity;
}
```

## Kafka Integration

### Configuration

```typescript
const definition: WorkflowDefinition<Order, any, OrderEvent, OrderStatus> = {
  // ... other properties
  kafka: {
    brokers: 'localhost:9092',
    events: [
      { topic: 'orders.submitted', event: OrderEvent.Submit },
      { topic: 'orders.completed', event: OrderEvent.Complete },
      { topic: 'orders.failed', event: OrderEvent.Fail }
    ]
  }
};
```

### KafkaClient Features

- **Producer**: Send events to Kafka topics
- **Consumer**: Consume events with retry logic and dead letter queue
- **Health Check**: Monitor Kafka connection status
- **Error Handling**: Configurable retry limits and dead letter queue

```typescript
export class KafkaClient {
  async produce<T>(topic: string, key: string, event: T): Promise<void>
  async consume<T>(topic: string, groupId: string, handler: IEventHandler<T>): Promise<void>
  async isHealthy(): Promise<boolean>
}
```

## Workflow Execution Flow

1. **Event Emission**: `workflowService.emit({ event, urn, payload })`
2. **Entity Loading**: Load entity using `entity.load(urn)`
3. **Transition Finding**: Find matching transition based on current state and event
4. **Condition Evaluation**: Check all conditions for the transition
5. **Action Execution**: Execute inline actions and decorated event handlers
6. **Status Update**: Update entity status using `entity.update(entity, newStatus)`
7. **Status Change Handlers**: Execute `@OnStatusChanged` handlers
8. **Auto-Transition**: Continue to next state if not idle
9. **Error Handling**: Transition to failed state on errors

## State Management

### State Categories

```typescript
states: {
  finals: State[];    // Terminal states (workflow ends)
  idles: State[];     // States waiting for external events
  failed: State;      // Error state
}
```

### State Transition Rules

- **Multiple From States**: `from: [State1, State2]`
- **Multiple Events**: `event: [Event1, Event2]`
- **Conditional Transitions**: Use `conditions` array
- **Auto-Transitions**: Automatically progress through non-idle states
- **Final States**: No transitions allowed from final states

## Error Handling

### Failed State Transitions
- Actions throwing errors transition to `failed` state
- `@OnStatusChanged` handlers can be configured with `failOnError: false`
- Fallback function can handle unmatched transitions

### Kafka Error Handling
- Configurable retry limits (default: 3)
- Dead letter queue for failed messages
- Retry delay mechanism (default: 30 seconds)

## Testing Patterns

### Unit Testing Workflows

```typescript
describe('Order Workflow', () => {
  let service: WorkflowService<Order, any, OrderEvent, OrderStatus>;
  let testEntity: Order;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        WorkflowModule.register({
          name: 'orderWorkflow',
          definition: orderWorkflowDefinition,
        }),
      ],
      providers: [OrderActions],
    }).compile();

    service = module.get('orderWorkflow');
    testEntity = new Order();
  });

  it('should transition from pending to processing', async () => {
    testEntity.status = OrderStatus.Pending;
    const result = await service.emit({ 
      event: OrderEvent.Submit, 
      urn: testEntity.id 
    });
    expect(result.status).toBe(OrderStatus.Processing);
  });
});
```

### Mock Strategies

```typescript
const moduleRef = createMock<ModuleRef>();
const workflow = new WorkflowService(definition, moduleRef);
```

## Advanced Features

### Complex Transitions

```typescript
// Multiple from states and events
{
  from: [OrderStatus.Pending, OrderStatus.Rejected],
  to: OrderStatus.Processing,
  event: [OrderEvent.Submit, OrderEvent.Retry],
  conditions: [
    (entity: Order) => entity.isValid(),
    (entity: Order) => entity.hasPayment()
  ]
}
```

### Fallback Mechanisms

```typescript
const definition: WorkflowDefinition<Order, any, OrderEvent, OrderStatus> = {
  // ... other properties
  fallback: async (entity: Order, event: OrderEvent, payload?: any) => {
    // Handle unmatched transitions
    console.log(`Unhandled event ${event} for entity ${entity.id}`);
    return entity;
  }
};
```

## Project Structure

```
src/
├── index.ts                                  # Main exports
├── workflow/
│   ├── action.class.decorator.ts            # @WorkflowAction decorator
│   ├── action.event.method.decorator.ts     # @OnEvent decorator
│   ├── action.status.method.decorator.ts    # @OnStatusChanged decorator
│   ├── definition.ts                        # Workflow interfaces
│   ├── entity.service.ts                    # Entity service abstract class
│   ├── module.ts                            # NestJS module
│   ├── service.ts                           # Core workflow service
│   └── kafka/
│       ├── client.ts                        # Kafka client implementation
│       └── event.handler.ts                 # Event handler interfaces
test/
├── cases/
│   └── subscriptions.spec.ts               # Complex use case tests
├── complex.workflow.spec.ts                # Complex workflow tests
├── decorators.workflow.spec.ts             # Decorator-based tests
├── entityservice.workflow.spec.ts          # Entity service tests
├── module.spec.ts                          # Module tests
├── simple.workflow.spec.ts                 # Basic workflow tests
└── workflow.definition.spec.ts             # Definition tests
```

## Development Setup

### Prerequisites
- Node.js 18+
- TypeScript 5.7+
- NestJS 11+

### Installation
```bash
npm install @jescrich/nestjs-workflow
```

### Dependencies
```json
{
  "dependencies": {
    "@nestjs/common": "^11.0.1",
    "@nestjs/core": "^11.0.1",
    "kafkajs": "^2.2.4",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.2"
  }
}
```

### Build Configuration
- **TypeScript**: ES2022 target with decorators enabled
- **Jest**: Testing framework with ts-jest transformer
- **ESLint**: Code linting with Prettier integration
- **Path Mapping**: `@this/*` for internal imports

## API Reference

### WorkflowService Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `emit()` | Trigger workflow transition | `{ event: E, urn: string, payload?: any }` | `Promise<T>` |
| `onModuleInit()` | Initialize workflow components | None | `Promise<void>` |

### Entity Configuration

| Property | Type | Description |
|----------|------|-------------|
| `new` | `() => T` | Create new entity instance |
| `update` | `(entity: T, status: S) => Promise<T>` | Update entity status |
| `load` | `(urn: string) => Promise<T>` | Load entity by URN |
| `status` | `(entity: T) => S` | Get entity status |
| `urn` | `(entity: T) => string` | Get entity URN |

### Workflow States

| State Type | Description |
|------------|-------------|
| `finals` | Terminal states where workflow ends |
| `idles` | States waiting for external events |
| `failed` | Error state for failed transitions |

## Best Practices

1. **Entity Design**: Keep workflow state as a property of domain entities
2. **State Management**: Use enums for states and events for type safety
3. **Error Handling**: Implement proper error states and fallback mechanisms
4. **Testing**: Write comprehensive tests for all transition paths
5. **Kafka Integration**: Use meaningful topic names and implement proper error handling
6. **Performance**: Consider entity loading strategies for high-volume workflows
7. **Monitoring**: Implement logging and metrics for workflow execution

## Version History

- **v1.0.2**: Current stable version with full feature set
- **v1.0.1**: Added comprehensive test coverage and parameter structure improvements
- **v0.0.10**: Initial release with core workflow functionality

## License

MIT License - See LICENSE file for details.

## Contributing

See CONTRIBUTING.md for development guidelines and contribution process. 