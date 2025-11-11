# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.6] - 2025-11-11

### Added
- **BullMQ Integration**: Complete BullMQ messaging adapter for event-driven workflows
  - BullMQClient for queue management with producer and consumer functionality
  - Automatic retry logic with configurable attempts and exponential backoff
  - Dead Letter Queue (DLQ) support for failed jobs after retry exhaustion
  - Health check functionality with Redis connection monitoring
  - Graceful shutdown with proper worker and queue cleanup
  - Support for multiple queues per workflow with independent event handling
  - Concurrent job processing with configurable worker options
  - Comprehensive logging for job lifecycle (production, processing, success, failure, DLQ)
- **GitHub Release Automation**: Automatic GitHub release creation on NPM package publish
- **Documentation Enhancements**:
  - Added interactive examples and demos section with links to examples repository
  - Included real-world workflow examples (User Onboarding, Order Processing, Kafka-Driven Inventory)
  - Added dark/light mode support for README images
  - Comprehensive BullMQ configuration and usage documentation

### Fixed
- **Critical**: Fixed inline actions executing when OnEvent actions fail
  - Properly initialize `failed` variable to track error state
  - Skip inline actions if OnEvent actions have already failed
  - Improved error handling and state management in WorkflowService
  - Added test coverage for OnEvent error scenarios

### Changed
- Enhanced WorkflowModule to support BullMQ configuration alongside Kafka
- Added mutual exclusivity validation between Kafka and BullMQ (only one can be enabled)
- Extended WorkflowDefinition interface with optional `bullmq` property
- Improved test infrastructure with Redis test utilities and helpers

### Testing
- Added comprehensive BullMQ test suite:
  - End-to-end workflow execution tests
  - Multiple workflows sharing same Redis instance
  - Concurrent job processing tests
  - Error scenario tests (retry, DLQ, connection failures)
  - Performance tests for high-volume job throughput
  - Graceful shutdown tests with in-flight jobs

## [1.0.5] - 2025-08-18

### Fixed
- Updated entity service token resolution in WorkflowModule

## [1.0.4] - 2025-08-18

### Changed
- Minor improvements and bug fixes

## [1.0.3]

### Fixed
- **CRITICAL**: Fixed WorkflowModule.register() returning null instead of WorkflowService instances
- Fixed dependency injection issues preventing ModuleRef and KafkaClient from being properly injected
- Fixed entity service resolution when using class-based EntityService configurations
- Fixed decorator-based actions not being executed due to dependency injection failures
- Fixed test configurations and provider registrations across all test suites
- Improved error handling in entity service methods with proper async/await patterns
- Enhanced entity service resolution during module initialization to prevent runtime errors

### Improved
- Added automatic entity service resolution and caching in onModuleInit()
- Better error messages and fallback handling for entity operations
- Comprehensive test coverage now at 100% (60/60 tests passing)
- Updated all test configurations to properly provide required dependencies

### Notes
- This release fixes critical issues that prevented the library from functioning in v1.0.1-1.0.2
- All users on versions 1.0.1-1.0.2 should upgrade immediately
- No breaking changes - this is a drop-in replacement

## [1.0.1]

### Added
- Comprehensive test cases for complex workflow scenarios
- Stripe subscription workflow example with complete test coverage
- Mock implementations for external dependencies in tests
- Test coverage for all possible state transitions in workflows
- Test cases for error handling and edge cases in workflows

### Changed
- Updated parameter structure for action methods to use `params: { entity: T, payload?: P }` pattern
- Improved type safety in workflow definitions

### Breaking Changes
- Action methods now require a consistent parameter structure of `params: { entity: T, payload?: P }`
- All action handlers must return a Promise of the entity type
- Changed workflow definition property `actions` to `Actions` (capitalized)
- Modified entity service interface to enforce stricter type checking

## [0.0.10] - 2025-03-18

### Added
- Initial release of nestjs-workflow
- Workflow definition interface with support for states, transitions, and events
- Decorator-based approach for defining workflow actions and conditions
- `@OnEvent` decorator for event-triggered actions
- `@OnStatusChanged` decorator with configurable error handling via `failOnError` parameter
- Stateless architecture that maintains state within domain entities
- Kafka integration for event-driven workflows
- Support for inline functions in transitions for actions and conditions
- Class-based approach with decorators for complex workflows
- Entity service interface for workflow state management
