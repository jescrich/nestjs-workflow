# Requirements Document

## Introduction

The BullMQ Messaging Adapter extends the NestJS Workflow Library to support BullMQ as an alternative messaging backend to Kafka. This feature enables developers who are already using BullMQ in their applications to integrate workflow event triggering through BullMQ queues without requiring Kafka infrastructure. The adapter follows the same patterns as the existing Kafka integration, providing a consistent developer experience while leveraging BullMQ's Redis-based queue system.

## Glossary

- **BullMQ**: A Redis-based queue system for Node.js that provides reliable message processing with features like job retries, priorities, and delayed jobs
- **Queue**: A BullMQ queue that holds jobs to be processed
- **Job**: A unit of work in BullMQ containing data and metadata
- **Worker**: A BullMQ worker that processes jobs from a queue
- **Queue Producer**: A component that adds jobs to a BullMQ queue
- **Queue Consumer**: A component that processes jobs from a BullMQ queue
- **Job Retry**: BullMQ's built-in mechanism to retry failed jobs
- **Dead Letter Queue**: A queue for jobs that have failed after all retry attempts
- **Redis Connection**: The connection configuration for Redis server used by BullMQ
- **Workflow Engine**: The core system from the base library that orchestrates state transitions
- **Event Mapping**: Configuration that maps BullMQ queue names to workflow events
- **Messaging Adapter**: An abstraction layer that allows different messaging systems to trigger workflows

## Requirements

### Requirement 1: BullMQ Configuration

**User Story:** As a developer, I want to configure BullMQ as my messaging backend, so that I can use my existing BullMQ infrastructure to trigger workflows.

#### Acceptance Criteria

1. THE WorkflowDefinition SHALL accept an optional bullmq configuration object as an alternative to kafka configuration
2. THE bullmq configuration SHALL include Redis connection settings with host, port, and optional password
3. THE bullmq configuration SHALL include an events array mapping queue names to workflow events
4. THE Workflow Engine SHALL NOT allow both kafka and bullmq configurations to be enabled simultaneously
5. WHERE bullmq configuration is provided, THE WorkflowModule SHALL initialize BullMQ workers instead of Kafka consumers

### Requirement 2: BullMQ Client Implementation

**User Story:** As a developer, I want a BullMQ client that manages queue operations, so that I can produce and consume workflow events through BullMQ.

#### Acceptance Criteria

1. THE BullMQClient SHALL accept Redis connection configuration in its constructor
2. THE BullMQClient SHALL create Queue instances for producing jobs
3. THE BullMQClient SHALL create Worker instances for consuming jobs
4. THE BullMQClient SHALL maintain a map of queue names to Queue instances
5. THE BullMQClient SHALL maintain a map of queue names to Worker instances
6. THE BullMQClient SHALL provide a health check method to verify Redis connectivity

### Requirement 3: Queue Producer Functionality

**User Story:** As a developer, I want to emit workflow events to BullMQ queues, so that I can trigger workflows asynchronously through my message queue.

#### Acceptance Criteria

1. THE BullMQClient SHALL provide a produce method accepting queue name, job name, and job data
2. WHEN produce is called, THE BullMQClient SHALL add a job to the specified queue
3. THE job data SHALL include the entity URN as a required field
4. THE job data SHALL include the workflow event payload as an optional field
5. THE BullMQClient SHALL log successful job additions with queue name and job ID
6. IF job addition fails, THEN THE BullMQClient SHALL log the error and throw an exception

### Requirement 4: Queue Consumer with Retry Logic

**User Story:** As a developer, I want BullMQ workers to process workflow events with automatic retries, so that transient failures don't cause workflow execution to fail permanently.

#### Acceptance Criteria

1. THE BullMQClient SHALL provide a consume method accepting queue name, worker handler, and optional retry configuration
2. THE Worker SHALL process jobs by calling the provided handler function with job data
3. THE Worker SHALL use BullMQ's built-in retry mechanism with configurable attempts (default 3)
4. THE Worker SHALL use exponential backoff for retry delays with configurable base delay (default 30 seconds)
5. WHEN a job handler succeeds, THE Worker SHALL mark the job as completed
6. WHEN a job handler fails and retries remain, THE Worker SHALL schedule a retry with backoff delay
7. WHEN a job handler fails and no retries remain, THE Worker SHALL move the job to failed state

### Requirement 5: Dead Letter Queue Support

**User Story:** As a developer, I want failed jobs to be moved to a dead letter queue, so that I can investigate and manually retry failed workflow events.

#### Acceptance Criteria

1. THE BullMQClient SHALL support optional dead letter queue configuration per queue
2. WHERE dead letter queue is configured, THE BullMQClient SHALL create a separate queue for failed jobs
3. WHEN a job fails after all retry attempts, THE BullMQClient SHALL add the job data to the dead letter queue
4. THE dead letter queue job SHALL include original job data, error message, and failure timestamp
5. THE BullMQClient SHALL log when jobs are moved to the dead letter queue

### Requirement 6: Workflow Integration

**User Story:** As a developer, I want BullMQ queues to trigger workflow transitions, so that my workflows can react to events from my message queue.

#### Acceptance Criteria

1. THE WorkflowService SHALL initialize BullMQ workers when bullmq configuration is present
2. THE WorkflowService SHALL create a worker for each queue defined in the events array
3. WHEN a job is received from a queue, THE WorkflowService SHALL extract the URN from the job data
4. WHEN a job is received, THE WorkflowService SHALL emit the mapped workflow event with the job data as payload
5. THE WorkflowService SHALL use the BullMQClient consume method to register job handlers
6. IF workflow event emission fails, THEN THE job handler SHALL throw an error to trigger BullMQ retry

### Requirement 7: Module Registration

**User Story:** As a developer, I want to register workflows with BullMQ support through the WorkflowModule, so that I can leverage NestJS dependency injection.

#### Acceptance Criteria

1. THE WorkflowModule register method SHALL accept optional bullmq configuration alongside existing kafka configuration
2. WHERE bullmq configuration is provided, THE WorkflowModule SHALL register BullMQClient as a provider
3. THE WorkflowModule SHALL inject BullMQClient into WorkflowService when bullmq is enabled
4. THE WorkflowModule SHALL export BullMQClient provider when bullmq is enabled
5. THE WorkflowModule SHALL validate that only one messaging backend (kafka or bullmq) is configured

### Requirement 8: Health Monitoring

**User Story:** As a developer, I want to monitor BullMQ connection health, so that I can detect and respond to Redis connectivity issues.

#### Acceptance Criteria

1. THE BullMQClient SHALL provide an isHealthy method that checks Redis connectivity
2. THE isHealthy method SHALL attempt to ping the Redis server
3. WHEN Redis is reachable, THE isHealthy method SHALL return true
4. WHEN Redis is unreachable, THE isHealthy method SHALL return false and log the error
5. THE BullMQClient SHALL provide methods to get queue and worker status information

### Requirement 9: Graceful Shutdown

**User Story:** As a developer, I want BullMQ workers to shut down gracefully, so that in-flight jobs are completed before application termination.

#### Acceptance Criteria

1. THE BullMQClient SHALL implement OnModuleDestroy lifecycle hook
2. WHEN the module is destroyed, THE BullMQClient SHALL close all workers
3. WHEN the module is destroyed, THE BullMQClient SHALL close all queue connections
4. THE BullMQClient SHALL wait for active jobs to complete before closing workers (with timeout)
5. THE BullMQClient SHALL log shutdown progress and completion

### Requirement 10: Error Handling and Logging

**User Story:** As a developer, I want comprehensive logging of BullMQ operations, so that I can debug issues and monitor queue processing.

#### Acceptance Criteria

1. WHEN a worker is initialized, THE BullMQClient SHALL log the queue name and configuration
2. WHEN a job is added to a queue, THE BullMQClient SHALL log the queue name and job ID
3. WHEN a job is processed successfully, THE BullMQClient SHALL log the queue name and job ID
4. WHEN a job fails, THE BullMQClient SHALL log the error message, queue name, job ID, and retry attempt
5. WHEN a job is moved to dead letter queue, THE BullMQClient SHALL log the queue name and job ID
6. WHEN Redis connection fails, THE BullMQClient SHALL log the connection error with details
7. THE BullMQClient SHALL use the same logging patterns as the existing Kafka integration

### Requirement 11: Backward Compatibility

**User Story:** As a developer, I want the BullMQ integration to be optional, so that existing Kafka-based workflows continue to work without changes.

#### Acceptance Criteria

1. THE Workflow Engine SHALL continue to support Kafka configuration without requiring BullMQ
2. WHERE neither kafka nor bullmq configuration is provided, THE Workflow Engine SHALL operate without messaging integration
3. THE WorkflowDefinition interface SHALL maintain backward compatibility with existing workflows
4. THE WorkflowModule SHALL not require BullMQ dependencies when only Kafka is used
5. THE library SHALL document migration path from Kafka to BullMQ for existing workflows

### Requirement 12: Type Safety

**User Story:** As a developer, I want full TypeScript type safety for BullMQ integration, so that I can catch configuration errors at compile time.

#### Acceptance Criteria

1. THE BullMQClient SHALL be generic with type parameters for job data
2. THE bullmq configuration interface SHALL define typed properties for all configuration options
3. THE BullMQEvent interface SHALL define typed mapping between queue names and workflow events
4. THE produce method SHALL enforce type consistency between job data and workflow payload
5. THE consume method SHALL provide typed job data to handler functions
