# Implementation Plan

- [ ] 1. Set up core workflow infrastructure
  - Create TypeScript interfaces for WorkflowDefinition, TransitionEvent, and KafkaEvent
  - Define EntityService abstract class with lifecycle methods
  - Set up project structure with proper module organization
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2_

- [ ] 2. Implement WorkflowService core transition logic
  - [ ] 2.1 Implement entity loading and status management
    - Write loadEntity method with support for inline and class-based EntityService
    - Write getEntityStatus method with fallback resolution logic
    - Write updateEntityStatus method with ModuleRef resolution
    - Write getEntityUrn method for entity identification
    - _Requirements: 2.3, 2.4, 2.5, 12.2, 12.3_

  - [ ] 2.2 Implement transition finding and validation
    - Write transition lookup logic supporting single and array-based from states and events
    - Implement condition evaluation with short-circuit logic
    - Write logic to select first valid transition when multiple matches exist
    - _Requirements: 3.2, 3.3, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 2.3 Implement inline action execution
    - Write executeInlineActions method to run transition actions in sequence
    - Implement error handling that transitions to failed state on action errors
    - Pass entity and payload to each action function
    - _Requirements: 3.4, 3.7_

  - [ ] 2.4 Implement auto-transition logic
    - Write nextEvent method to determine next transition automatically
    - Implement isInIdleStatus check to stop auto-transitions
    - Implement isInFailedStatus check for terminal state detection
    - Write loop in transition method to continue until idle or final state
    - _Requirements: 3.6, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ] 2.5 Implement main emit and transition methods
    - Write public emit method as entry point for workflow events
    - Write private transition method with do-while loop for auto-transitions
    - Implement final state warning for retry scenarios
    - Add fallback function invocation when no valid transition found
    - _Requirements: 3.1, 3.8, 9.6, 9.7_

  - [ ]* 2.6 Write unit tests for WorkflowService transition logic
    - Test basic state transitions with simple workflows
    - Test condition evaluation and transition selection
    - Test auto-transition behavior through multiple states
    - Test error handling and failed state transitions
    - Test fallback function invocation
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [ ] 3. Implement decorator-based action system
  - [ ] 3.1 Create @WorkflowAction class decorator
    - Write decorator function that sets isWorkflowAction metadata
    - Use Reflect.defineMetadata to mark action classes
    - _Requirements: 4.1_

  - [ ] 3.2 Create @OnEvent method decorator
    - Write decorator function accepting event and optional order parameter
    - Store onEvent and onEventOrder metadata on method
    - _Requirements: 4.2, 4.4_

  - [ ] 3.3 Create @OnStatusChanged method decorator
    - Write decorator function accepting from, to, and optional failOnError parameters
    - Store onStatusChanged, from, to, and failOnError metadata on method
    - Set default failOnError to true
    - _Requirements: 4.3, 4.6, 4.7_

  - [ ] 3.4 Implement action discovery and configuration in WorkflowService
    - Write configureActions method to discover decorated action classes
    - Use ModuleRef to resolve action class instances
    - Iterate through class methods to find decorated methods
    - Validate method signatures to ensure single parameter object with entity property
    - Build actionsOnEvent map for @OnEvent handlers
    - Build actionsOnStatusChanged map for @OnStatusChanged handlers with failOnError flag
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ] 3.5 Integrate decorated actions into transition execution
    - Execute @OnEvent handlers before inline actions during transition
    - Execute @OnStatusChanged handlers after status update
    - Respect execution order for multiple @OnEvent handlers on same event
    - Implement error handling respecting failOnError flag for @OnStatusChanged
    - _Requirements: 4.2, 4.3, 4.4, 4.6, 4.7_

  - [ ]* 3.6 Write unit tests for decorator system
    - Test @WorkflowAction decorator metadata setting
    - Test @OnEvent decorator with single and multiple handlers
    - Test @OnStatusChanged decorator with failOnError true and false
    - Test action discovery and configuration
    - Test execution order of multiple handlers
    - Test method signature validation
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [ ] 4. Implement Kafka integration
  - [ ] 4.1 Create KafkaClient class
    - Implement constructor accepting clientId and brokers configuration
    - Initialize Kafka instance with KafkaJS library
    - _Requirements: 6.1, 6.2_

  - [ ] 4.2 Implement Kafka producer functionality
    - Write produce method to send events to Kafka topics
    - Implement connection management and error handling
    - Add logging for event dispatch success and failures
    - _Requirements: 6.5_

  - [ ] 4.3 Implement Kafka consumer with retry logic
    - Write consume method accepting topic, groupId, and handler
    - Implement eachBatch processing with manual offset resolution
    - Add retry counter map to track message retry attempts
    - Implement pause/resume mechanism for retry delays
    - Set configurable retry limit (default 3) and retry delay (default 30 seconds)
    - _Requirements: 6.3, 6.4, 6.6_

  - [ ] 4.4 Implement dead letter queue functionality
    - Write sendToDeadLetterQueue method to send failed messages to DLQ topic
    - Trigger DLQ send when retry limit is exceeded
    - Add logging for DLQ operations
    - _Requirements: 6.7_

  - [ ] 4.5 Implement Kafka health check
    - Write isHealthy method to verify Kafka connectivity
    - Use admin client to list topics as health indicator
    - Add error handling and logging
    - _Requirements: 6.8_

  - [ ] 4.6 Integrate Kafka consumers with WorkflowService
    - Write initializeKafkaConsumers method in WorkflowService
    - Iterate through kafka.events configuration to subscribe to topics
    - Map Kafka messages to workflow events using topic-to-event mapping
    - Extract URN from message key and emit workflow event with message as payload
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 4.7 Write integration tests for Kafka functionality
    - Test Kafka producer sending messages
    - Test Kafka consumer receiving and processing messages
    - Test retry logic with failing handlers
    - Test dead letter queue for exceeded retries
    - Test health check functionality
    - Test workflow integration with Kafka events
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [ ] 5. Implement WorkflowModule dynamic module
  - [ ] 5.1 Create WorkflowModule class with register method
    - Write static register method accepting name, definition, imports, providers, and kafka config
    - Return DynamicModule configuration object
    - _Requirements: 7.1_

  - [ ] 5.2 Implement WorkflowService provider registration
    - Create named provider using params.name
    - Create generic WorkflowService provider for type-based injection
    - Use factory functions to instantiate WorkflowService with dependencies
    - Inject ModuleRef, optional KafkaClient, and optional EntityService
    - _Requirements: 7.2, 7.3_

  - [ ] 5.3 Implement EntityService provider registration
    - Check if entity is a class (EntityService subclass)
    - Register EntityService class as provider if not already in providers array
    - Add EntityService to factory injection tokens
    - _Requirements: 7.4_

  - [ ] 5.4 Implement conditional KafkaClient registration
    - Check if kafka.enabled is true in configuration
    - Register KafkaClient provider with factory using clientId and brokers
    - Add KafkaClient to factory injection tokens when enabled
    - Manually set kafkaClient on WorkflowService instance in factory
    - _Requirements: 7.5_

  - [ ] 5.5 Implement action class resolution
    - Ensure action classes from definition.actions are resolvable via ModuleRef
    - Action classes should be provided by the consuming module
    - _Requirements: 7.6_

  - [ ] 5.6 Configure module exports
    - Export named WorkflowService provider
    - Export generic WorkflowService provider
    - Export KafkaClient when Kafka is enabled
    - _Requirements: 7.7_

  - [ ]* 5.7 Write unit tests for WorkflowModule
    - Test module registration with minimal configuration
    - Test named and generic provider creation
    - Test EntityService registration when provided as class
    - Test KafkaClient registration when Kafka is enabled
    - Test provider injection and resolution
    - Test multiple workflow registrations in same application
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [ ] 6. Implement comprehensive logging
  - [ ] 6.1 Add initialization logging
    - Log workflow name and configuration summary in constructor
    - Log action count, transition count, and condition count after configuration
    - _Requirements: 10.1_

  - [ ] 6.2 Add transition execution logging
    - Log event and URN when emit is called
    - Log from state, to state, and URN during transition execution
    - Log possible transitions found for current state
    - Log when checking conditional transitions
    - _Requirements: 10.2, 10.3_

  - [ ] 6.3 Add condition and action logging
    - Log condition name and evaluation result for each condition
    - Log action name and URN when executing actions
    - Log when conditions are not met for a transition
    - _Requirements: 10.4, 10.5_

  - [ ] 6.4 Add error and warning logging
    - Log errors with message, URN, and context when actions fail
    - Log warnings when entity is in final state but receives event
    - Log warnings when no valid transition is found
    - Log errors when entity is not found
    - _Requirements: 10.6_

  - [ ] 6.5 Add Kafka event logging
    - Log Kafka event reception with topic and key
    - Log successful Kafka event emission
    - Log Kafka event processing failures
    - _Requirements: 10.7_

  - [ ]* 6.6 Verify logging coverage with tests
    - Test that all major operations produce appropriate log entries
    - Test error logging includes necessary context
    - Test log levels are appropriate for each message type
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [ ] 7. Implement error handling and failed state logic
  - [ ] 7.1 Implement inline action error handling
    - Wrap inline action execution in try-catch block
    - Log error with message and URN
    - Set failed flag to trigger failed state transition
    - Update entity status to failed state when action fails
    - _Requirements: 9.1, 9.2_

  - [ ] 7.2 Implement @OnEvent handler error handling
    - Wrap @OnEvent handler execution in try-catch block
    - Log error with action name and message
    - Set failed flag to trigger failed state transition
    - Break action execution loop on first failure
    - _Requirements: 9.3_

  - [ ] 7.3 Implement @OnStatusChanged handler error handling
    - Wrap @OnStatusChanged handler execution in try-catch block
    - Check failOnError flag from metadata
    - If failOnError is true, set failed flag and transition to failed state
    - If failOnError is false, log error but continue execution
    - _Requirements: 9.4, 9.5_

  - [ ] 7.4 Implement final state retry handling
    - Check if entity is in final state before transition
    - Log warning but allow transition for retry scenarios
    - _Requirements: 9.6_

  - [ ] 7.5 Implement transition not found error handling
    - Throw descriptive error when no transition matches event and state
    - Include event, current status, and URN in error message
    - Check for fallback function and invoke if defined
    - _Requirements: 9.7_

  - [ ]* 7.6 Write unit tests for error handling
    - Test inline action failure triggers failed state
    - Test @OnEvent handler failure triggers failed state
    - Test @OnStatusChanged with failOnError true triggers failed state
    - Test @OnStatusChanged with failOnError false continues execution
    - Test final state retry warning
    - Test transition not found error
    - Test fallback function invocation
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [ ] 8. Create comprehensive test suite
  - [ ]* 8.1 Write simple workflow tests
    - Test basic state transitions with conditions
    - Test inline actions modifying entity
    - Test condition evaluation preventing transitions
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 8.2 Write complex workflow tests
    - Test workflows with multiple paths and decision points
    - Test auto-transitions through multiple states
    - Test workflows with parallel transition options
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ]* 8.3 Write EntityService integration tests
    - Test EntityService class registration and resolution
    - Test entity loading from repository
    - Test entity updates persisting to repository
    - Test error handling for missing entities
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 8.4 Write end-to-end workflow tests
    - Test complete order processing workflow from creation to completion
    - Test user onboarding workflow with multiple verification steps
    - Test workflow with Kafka event triggers
    - Test error recovery and retry scenarios
    - _Requirements: All requirements_

- [ ] 9. Create example applications
  - [ ] 9.1 Create basic task workflow example
    - Implement simple task entity with TODO, IN_PROGRESS, COMPLETED states
    - Create inline workflow definition with basic transitions
    - Add interactive demo with visualization
    - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3, 3.4_

  - [ ] 9.2 Create user onboarding workflow example
    - Implement User entity with registration, verification, and activation states
    - Create decorator-based action classes for email, phone, and identity verification
    - Implement risk assessment and KYC compliance checks
    - Add interactive demo with automated scenarios
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ] 9.3 Create order processing workflow example
    - Implement Order entity with payment, processing, shipping, and delivery states
    - Create action classes for payment processing, inventory management, and shipping
    - Implement retry logic for payment failures
    - Add interactive demo with multiple order scenarios
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ] 9.4 Create Kafka inventory workflow example
    - Implement Inventory entity with receiving, available, reserved, and allocated states
    - Configure Kafka integration with topic-to-event mapping
    - Create Docker Compose setup for Kafka and Zookeeper
    - Implement producer service to trigger workflow via Kafka events
    - Add interactive demo showing Kafka event consumption
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [ ]* 9.5 Create example documentation
    - Write README for each example explaining the workflow
    - Document how to run interactive demos
    - Provide code walkthroughs for key concepts
    - Create visual workflow diagrams
    - _Requirements: All requirements_

- [ ] 10. Create library documentation
  - [ ]* 10.1 Write main README
    - Document installation instructions
    - Provide quick start guide with code examples
    - Explain stateless architecture benefits
    - Link to examples repository
    - Document key features and use cases
    - _Requirements: All requirements_

  - [ ]* 10.2 Write API documentation
    - Document WorkflowDefinition interface and all properties
    - Document TransitionEvent interface and configuration options
    - Document EntityService abstract class and methods
    - Document WorkflowService public API
    - Document decorator usage and options
    - Document Kafka integration configuration
    - _Requirements: All requirements_

  - [ ]* 10.3 Write codebase documentation
    - Create comprehensive technical documentation covering architecture
    - Document all core components and their interactions
    - Provide code examples for common patterns
    - Document testing strategies and best practices
    - _Requirements: All requirements_

  - [ ]* 10.4 Write contributing guide
    - Document development setup and build process
    - Explain code organization and conventions
    - Provide guidelines for submitting pull requests
    - Document testing requirements for contributions
    - _Requirements: All requirements_
