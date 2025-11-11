# Requirements Document

## Introduction

The NestJS Workflow Library is a flexible, stateless workflow engine built on top of the NestJS framework. It enables developers to create, manage, and execute complex state machines and workflows in Node.js applications. The library follows a domain-driven design approach where workflow state is maintained within domain entities, eliminating the need for separate state storage. It supports both declarative inline configuration and decorator-based approaches for defining workflows, with built-in Kafka integration for event-driven architectures.

## Glossary

- **Workflow Engine**: The core system that orchestrates state transitions based on defined rules and events
- **Entity**: A domain object that contains workflow state as one of its properties
- **State**: A specific condition or status that an entity can be in at any given time
- **Event**: A trigger that causes a state transition in the workflow
- **Transition**: A rule defining how an entity moves from one state to another based on an event
- **Action**: A function executed during a state transition to modify the entity or perform side effects
- **Condition**: A boolean function that determines whether a transition is allowed
- **URN**: Unique Resource Name - a unique identifier for an entity instance
- **Idle State**: A state where the workflow waits for external events before proceeding
- **Final State**: A terminal state where the workflow ends
- **Failed State**: A designated error state for handling workflow failures
- **EntityService**: An abstract service class that defines operations for entity lifecycle management
- **WorkflowDefinition**: A configuration object that defines all aspects of a workflow
- **WorkflowService**: The main service class that executes workflow transitions
- **WorkflowModule**: A NestJS dynamic module for registering workflows
- **Kafka Integration**: Built-in support for consuming Kafka events to trigger workflow transitions
- **Decorator-Based Actions**: Actions defined using TypeScript decorators on class methods
- **Inline Actions**: Actions defined as functions directly in transition definitions
- **Status Change Handler**: An action triggered when an entity transitions between specific states
- **Event Handler**: An action triggered when a specific event occurs
- **Fallback Function**: An optional function executed when no valid transition is found

## Requirements

### Requirement 1: Workflow Definition and Configuration

**User Story:** As a developer, I want to define workflows using a declarative configuration, so that I can specify states, transitions, and rules in a clear and maintainable way.

#### Acceptance Criteria

1. THE Workflow Engine SHALL accept a WorkflowDefinition object containing states, transitions, entity configuration, and optional actions
2. THE WorkflowDefinition SHALL include a states object with finals array, idles array, and failed state property
3. THE WorkflowDefinition SHALL include a transitions array where each transition specifies event, from state, to state, and optional conditions and actions
4. WHERE a transition is defined, THE Workflow Engine SHALL support single or multiple from states as an array
5. WHERE a transition is defined, THE Workflow Engine SHALL support single or multiple events as an array

### Requirement 2: Entity Management

**User Story:** As a developer, I want to manage entity lifecycle operations through a consistent interface, so that I can integrate the workflow with my existing data layer.

#### Acceptance Criteria

1. THE Workflow Engine SHALL support entity configuration through inline functions or EntityService class
2. THE EntityService SHALL define methods for new, update, load, status, and urn operations
3. WHEN an entity is loaded, THE Workflow Engine SHALL call the load method with the entity URN
4. WHEN an entity status changes, THE Workflow Engine SHALL call the update method with the entity and new status
5. THE Workflow Engine SHALL retrieve entity status by calling the status method

### Requirement 3: State Transition Execution

**User Story:** As a developer, I want the workflow engine to execute state transitions based on events, so that my entities can progress through their lifecycle automatically.

#### Acceptance Criteria

1. WHEN an event is emitted with URN and optional payload, THE Workflow Engine SHALL load the entity using the URN
2. WHEN an entity is loaded, THE Workflow Engine SHALL find matching transitions based on current state and event
3. WHERE multiple transitions match, THE Workflow Engine SHALL evaluate conditions to select the valid transition
4. WHEN a valid transition is found, THE Workflow Engine SHALL execute inline actions in sequence
5. WHEN all actions complete successfully, THE Workflow Engine SHALL update the entity status to the target state
6. WHILE the entity is not in an idle state, THE Workflow Engine SHALL automatically continue to the next transition
7. IF a transition action throws an error, THEN THE Workflow Engine SHALL transition the entity to the failed state
8. WHERE no valid transition is found and a fallback function is defined, THE Workflow Engine SHALL execute the fallback function

### Requirement 4: Decorator-Based Actions

**User Story:** As a developer, I want to define workflow actions using TypeScript decorators, so that I can organize complex workflow logic in reusable classes.

#### Acceptance Criteria

1. THE Workflow Engine SHALL support action classes decorated with @WorkflowAction decorator
2. WHERE a method is decorated with @OnEvent, THE Workflow Engine SHALL execute the method when the specified event occurs
3. WHERE a method is decorated with @OnStatusChanged, THE Workflow Engine SHALL execute the method when the entity transitions between specified states
4. WHEN multiple @OnEvent handlers exist for the same event, THE Workflow Engine SHALL execute them in order specified by the order property
5. THE Workflow Engine SHALL validate that decorated action methods accept a single parameter object with entity and optional payload properties
6. WHERE @OnStatusChanged decorator has failOnError set to false, THE Workflow Engine SHALL continue workflow execution even if the handler throws an error
7. WHERE @OnStatusChanged decorator has failOnError set to true or undefined, THE Workflow Engine SHALL transition to failed state if the handler throws an error

### Requirement 5: Conditional Transitions

**User Story:** As a developer, I want to define conditions for state transitions, so that entities only transition when specific criteria are met.

#### Acceptance Criteria

1. WHERE a transition defines conditions array, THE Workflow Engine SHALL evaluate all conditions before allowing the transition
2. THE Workflow Engine SHALL pass the entity and payload to each condition function
3. WHEN all conditions return true, THE Workflow Engine SHALL allow the transition to proceed
4. WHEN any condition returns false, THE Workflow Engine SHALL not execute the transition
5. WHERE multiple transitions exist to the same target state, THE Workflow Engine SHALL select the first transition where all conditions are met

### Requirement 6: Kafka Integration

**User Story:** As a developer, I want to trigger workflow transitions from Kafka events, so that I can build event-driven architectures.

#### Acceptance Criteria

1. WHERE WorkflowDefinition includes kafka configuration, THE Workflow Engine SHALL initialize Kafka consumers for specified topics
2. THE Kafka configuration SHALL include brokers string and events array mapping topics to workflow events
3. WHEN a Kafka message arrives on a subscribed topic, THE Workflow Engine SHALL extract the URN from the message key
4. WHEN a Kafka message is received, THE Workflow Engine SHALL emit the mapped workflow event with the message as payload
5. THE Kafka Client SHALL support producer functionality to send events to Kafka topics
6. THE Kafka Client SHALL implement retry logic with configurable retry limits for failed message processing
7. THE Kafka Client SHALL support dead letter queue for messages that exceed retry limits
8. THE Kafka Client SHALL provide health check functionality to monitor Kafka connection status

### Requirement 7: Module Registration

**User Story:** As a developer, I want to register workflows as NestJS modules, so that I can leverage dependency injection and module composition.

#### Acceptance Criteria

1. THE WorkflowModule SHALL provide a register method that accepts name and definition parameters
2. WHEN WorkflowModule is registered, THE WorkflowModule SHALL create a WorkflowService provider with the specified name
3. THE WorkflowModule SHALL create a generic WorkflowService provider for injection by type
4. WHERE EntityService is provided as a class, THE WorkflowModule SHALL register it as a provider
5. WHERE Kafka is enabled, THE WorkflowModule SHALL register KafkaClient as a provider
6. THE WorkflowModule SHALL resolve action classes from the module container during initialization
7. THE WorkflowModule SHALL export the named WorkflowService and generic WorkflowService providers

### Requirement 8: Auto-Transition Logic

**User Story:** As a developer, I want workflows to automatically progress through non-idle states, so that I don't need to manually trigger every transition.

#### Acceptance Criteria

1. WHEN an entity transitions to a new state, THE Workflow Engine SHALL check if the state is in the idles array
2. WHILE the entity is not in an idle state, THE Workflow Engine SHALL determine the next event automatically
3. WHERE only one transition exists from the current state, THE Workflow Engine SHALL use that transition's event
4. WHERE multiple transitions exist from the current state, THE Workflow Engine SHALL evaluate conditions to determine the next event
5. WHEN the next event is determined, THE Workflow Engine SHALL execute the transition without external trigger
6. WHEN the entity reaches an idle state, THE Workflow Engine SHALL stop auto-transition and wait for external events
7. WHEN the entity reaches a final state, THE Workflow Engine SHALL stop auto-transition and complete the workflow

### Requirement 9: Error Handling and Failed States

**User Story:** As a developer, I want workflows to handle errors gracefully, so that I can track and recover from failures.

#### Acceptance Criteria

1. WHERE a transition action throws an error, THE Workflow Engine SHALL log the error with entity URN
2. WHEN an inline action fails, THE Workflow Engine SHALL transition the entity to the failed state
3. WHEN an @OnEvent handler fails, THE Workflow Engine SHALL transition the entity to the failed state
4. WHERE @OnStatusChanged handler fails and failOnError is true, THE Workflow Engine SHALL transition the entity to the failed state
5. WHERE @OnStatusChanged handler fails and failOnError is false, THE Workflow Engine SHALL log the error but continue workflow execution
6. WHEN an entity is in a final state and receives an event, THE Workflow Engine SHALL log a warning but accept the transition for retry scenarios
7. WHERE no valid transition is found, THE Workflow Engine SHALL throw an error with event and status information

### Requirement 10: Logging and Observability

**User Story:** As a developer, I want comprehensive logging of workflow execution, so that I can debug issues and monitor workflow behavior.

#### Acceptance Criteria

1. WHEN a workflow is initialized, THE Workflow Engine SHALL log the workflow name and configuration summary
2. WHEN an event is emitted, THE Workflow Engine SHALL log the event and entity URN
3. WHEN a transition is executed, THE Workflow Engine SHALL log the from state, to state, and entity URN
4. WHEN conditions are evaluated, THE Workflow Engine SHALL log the condition name and result
5. WHEN actions are executed, THE Workflow Engine SHALL log the action name and entity URN
6. WHEN errors occur, THE Workflow Engine SHALL log the error message with entity URN and context
7. WHEN Kafka events are received, THE Workflow Engine SHALL log the topic, key, and processing status

### Requirement 11: Type Safety and Generics

**User Story:** As a developer, I want full TypeScript type safety for workflows, so that I can catch errors at compile time.

#### Acceptance Criteria

1. THE WorkflowService SHALL be generic with type parameters for Entity, Payload, Event, and State
2. THE WorkflowDefinition SHALL be generic with type parameters for Entity, Payload, Event, and State
3. THE EntityService SHALL be generic with type parameters for Entity and State
4. THE Workflow Engine SHALL enforce type consistency between entity, events, and states throughout the workflow
5. THE emit method SHALL accept typed event and payload parameters matching the workflow definition

### Requirement 12: Stateless Architecture

**User Story:** As a developer, I want the workflow engine to be stateless, so that I can use my existing data layer without additional storage requirements.

#### Acceptance Criteria

1. THE Workflow Engine SHALL NOT maintain any internal state storage for entities
2. WHEN an entity is needed, THE Workflow Engine SHALL load it using the entity load method
3. WHEN an entity status changes, THE Workflow Engine SHALL persist it using the entity update method
4. THE Workflow Engine SHALL operate on entities passed through the workflow without caching
5. THE Workflow Engine SHALL support horizontal scaling without shared state requirements
