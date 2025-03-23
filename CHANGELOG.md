# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
