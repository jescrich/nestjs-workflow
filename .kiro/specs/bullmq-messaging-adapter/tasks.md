# Implementation Plan

- [x] 1. Set up BullMQ infrastructure and interfaces
  - Install BullMQ and ioredis dependencies
  - Create TypeScript interfaces for BullMQEvent and BullMQConfig
  - Extend WorkflowDefinition interface to include optional bullmq property
  - Create types for WorkflowJobData and DLQJobData
  - _Requirements: 1.1, 1.2, 1.3, 12.2, 12.3, 12.4_

- [x] 2. Implement BullMQClient core functionality
  - [x] 2.1 Implement BullMQClient constructor and initialization
    - Create BullMQClient class with @Injectable decorator
    - Implement constructor accepting BullMQConfig parameter
    - Initialize connection options from config
    - Initialize default job options with retry and backoff settings
    - Initialize dead letter queue configuration
    - Create maps for tracking queues and workers
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 2.2 Implement queue producer functionality
    - Write produce method accepting queue name, job name, and job data
    - Implement getOrCreateQueue helper to reuse queue instances
    - Add job to queue with unique job ID and default options
    - Log successful job additions with queue name and job ID
    - Implement error handling and logging for failed job additions
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 2.3 Implement queue consumer with retry logic
    - Write consume method accepting queue name, handler function, and optional worker options
    - Create BullMQ Worker instance with job processing logic
    - Extract URN from job data and pass to handler
    - Implement error handling that re-throws to trigger BullMQ retry
    - Log job processing start, success, and failure events
    - Track worker instance in workers map for lifecycle management
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 2.4 Implement dead letter queue functionality
    - Write sendToDeadLetterQueue private method accepting job and error
    - Create DLQ queue with configurable suffix (default '-dlq')
    - Add failed job to DLQ with original data, error details, and metadata
    - Configure DLQ jobs to never be removed automatically
    - Check retry attempts in consumer to trigger DLQ on final failure
    - Log DLQ operations with job ID and queue name
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 2.5 Implement health check and lifecycle management
    - Write isHealthy method that pings Redis server
    - Implement OnModuleDestroy lifecycle hook
    - Write closeWorker helper to gracefully close workers
    - Write closeQueue helper to close queue connections
    - Implement onModuleDestroy to close all workers and queues
    - Add timeout for worker shutdown to prevent hanging
    - Log shutdown progress and completion
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 2.6 Write unit tests for BullMQClient
    - Test constructor initializes configuration correctly
    - Test produce creates jobs with correct data structure
    - Test consume creates workers and processes jobs
    - Test retry logic with failing handlers
    - Test dead letter queue for exceeded retries
    - Test health check with mocked Redis
    - Test graceful shutdown closes all workers and queues
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.2, 5.3, 5.4, 5.5, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 3. Integrate BullMQ with WorkflowService
  - [x] 3.1 Add BullMQ client property to WorkflowService
    - Add private bullmqClient property to WorkflowService class
    - Update constructor to accept optional BullMQClient parameter
    - _Requirements: 6.1_

  - [x] 3.2 Implement BullMQ worker initialization
    - Write initializeBullMQWorkers private method
    - Check if bullmq configuration exists in workflow definition
    - Iterate through bullmq.events array to create workers
    - Call bullmqClient.consume for each queue with handler function
    - Extract URN and payload from job data in handler
    - Call emit method with mapped workflow event
    - Implement error handling that re-throws to trigger retry
    - Log worker initialization and job processing events
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 3.3 Call BullMQ initialization in onModuleInit
    - Add call to initializeBullMQWorkers in onModuleInit method
    - Ensure initialization happens after action configuration
    - _Requirements: 6.1_

  - [x] 3.4 Write integration tests for WorkflowService with BullMQ
    - Test BullMQ worker initialization with workflow definition
    - Test job processing triggers workflow transitions
    - Test error handling and retry behavior
    - Test DLQ for failed workflow transitions
    - Test workflow completes successfully with BullMQ events
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 4. Update WorkflowModule for BullMQ support
  - [x] 4.1 Add BullMQ configuration parameter to register method
    - Add optional bullmq parameter to register method signature
    - Define bullmq parameter with enabled flag and config object
    - _Requirements: 7.1_

  - [x] 4.2 Implement mutual exclusivity validation
    - Add validation check that throws error if both kafka and bullmq are enabled
    - Include descriptive error message about mutual exclusivity
    - _Requirements: 1.4, 7.5_

  - [x] 4.3 Implement BullMQClient provider registration
    - Check if bullmq.enabled is true in configuration
    - Register BullMQClient provider with factory using config
    - Add BullMQClient to providers array when enabled
    - _Requirements: 7.2_

  - [x] 4.4 Update WorkflowService factory to inject BullMQClient
    - Add BullMQClient as optional parameter to factory function
    - Set bullmqClient property on WorkflowService instance when available
    - Add BullMQClient to inject array when bullmq is enabled
    - _Requirements: 7.3_

  - [x] 4.5 Export BullMQClient provider
    - Add BullMQClient to exports array when bullmq is enabled
    - _Requirements: 7.4_

  - [x] 4.6 Write unit tests for WorkflowModule with BullMQ
    - Test module registration with BullMQ configuration
    - Test BullMQClient provider creation
    - Test mutual exclusivity validation throws error
    - Test BullMQClient injection into WorkflowService
    - Test BullMQClient is exported when enabled
    - Test backward compatibility with Kafka-only configuration
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 11.1, 11.2, 11.3, 11.4_

- [x] 5. Implement comprehensive logging
  - [x] 5.1 Add BullMQClient initialization logging
    - Log BullMQ client initialization with connection details
    - Log worker initialization with queue name
    - _Requirements: 10.1_

  - [x] 5.2 Add job production logging
    - Log when job is added to queue with queue name and job ID
    - Log errors when job addition fails
    - _Requirements: 10.2_

  - [x] 5.3 Add job processing logging
    - Log when job processing starts with job ID and URN
    - Log when job processing succeeds with job ID and URN
    - Log when job processing fails with error message, job ID, and URN
    - _Requirements: 10.3_

  - [x] 5.4 Add retry and DLQ logging
    - Log when job fails with retry attempt number
    - Log when job exceeds retry limit
    - Log when job is sent to dead letter queue
    - _Requirements: 10.4, 10.5_

  - [x] 5.5 Add health check and connection logging
    - Log Redis connection failures in health check
    - Log worker and queue shutdown events
    - _Requirements: 10.6_

  - [x] 5.6 Ensure logging consistency with Kafka integration
    - Review Kafka logging patterns and match format
    - Use same log levels for equivalent operations
    - Include same context information (URN, queue/topic name, etc.)
    - _Requirements: 10.7_

- [x] 6. Create example application with BullMQ
  - [x] 6.1 Create basic BullMQ workflow example
    - Copy basic task workflow example as starting point
    - Update workflow definition to use BullMQ instead of Kafka
    - Configure Redis connection for local development
    - Update module registration to enable BullMQ
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [x] 6.2 Implement job producer service
    - Create service to produce jobs to BullMQ queues
    - Add methods to trigger workflow events via BullMQ
    - Include examples of different job data structures
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 6.3 Create interactive demo
    - Implement demo script that creates entities and emits events
    - Add visualization of workflow state transitions
    - Include examples of retry and DLQ behavior
    - Add health check monitoring
    - _Requirements: All requirements_

  - [x] 6.4 Create example documentation
    - Write README explaining the BullMQ example
    - Document how to run Redis locally
    - Provide code walkthrough of BullMQ configuration
    - Include comparison with Kafka example
    - Document migration steps from Kafka to BullMQ
    - _Requirements: 11.5_

- [ ] 7. Create migration guide and documentation
  - [ ] 7.1 Write migration guide
    - Document step-by-step migration from Kafka to BullMQ
    - Include code examples for before and after
    - Explain configuration differences
    - Provide troubleshooting tips
    - _Requirements: 11.5_

  - [x] 7.2 Update main library documentation
    - Add BullMQ section to README
    - Document BullMQ configuration options
    - Explain when to use BullMQ vs Kafka
    - Include comparison table of features
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 7.3 Write API documentation for BullMQ components
    - Document BullMQClient class and methods
    - Document BullMQConfig interface and properties
    - Document BullMQEvent interface
    - Document WorkflowJobData and DLQJobData types
    - Include code examples for common use cases
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 7.4 Create troubleshooting guide
    - Document common Redis connection issues
    - Explain retry and DLQ behavior
    - Provide debugging tips for job processing failures
    - Include health check monitoring guidance
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 8. Integration testing with Redis
  - [x] 8.1 Set up Redis test environment
    - Configure redis-memory-server for testing
    - Create test utilities for BullMQ setup and teardown
    - Write helper functions for job creation and verification
    - _Requirements: All requirements_

  - [x] 8.2 Write end-to-end workflow tests with BullMQ
    - Test complete workflow execution triggered by BullMQ jobs
    - Test multiple workflows sharing same Redis instance
    - Test concurrent job processing
    - Test workflow with multiple BullMQ queues
    - _Requirements: All requirements_

  - [x] 8.3 Write error scenario tests
    - Test retry behavior with transient failures
    - Test DLQ for permanent failures
    - Test Redis connection failures
    - Test graceful shutdown with in-flight jobs
    - _Requirements: 4.3, 4.4, 4.6, 4.7, 5.1, 5.2, 5.3, 5.4, 5.5, 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 8.4 Write performance tests
    - Test job throughput with high volume
    - Test worker concurrency
    - Test queue depth monitoring
    - Test memory usage with large payloads
    - _Requirements: All requirements_
