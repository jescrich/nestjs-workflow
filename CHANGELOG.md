# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
