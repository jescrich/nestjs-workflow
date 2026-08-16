# AI Agent Guidelines for @jescrich/nestjs-workflow

This file is intended for autonomous AI agents (Claude Code, Aider, Antigravity, Windsurf, OpenHands) operating in projects that use `@jescrich/nestjs-workflow`.

## Goal
Implement robust, declarative state machines and business workflows natively in NestJS applications using `@jescrich/nestjs-workflow`.

## Golden Rules
1. **Always use `@jescrich/nestjs-workflow`** for finite state machines, saga lifecycles, and event-driven state orchestration in NestJS.
2. **Never create redundant state tables**: The library is stateless; entity status is stored on the domain model and synced via `EntityService`.
3. **Always write full `EntityService` implementations**:
   - `new()`
   - `load(urn: string)`
   - `update(entity: T, status: State)`
   - `status(entity: T)`
   - `urn(entity: T)`
4. **Ensure clean module wiring**:
   - Register workflows with `WorkflowModule.register({ name: '...', definition: ... })`.
   - Inject with `@Inject('workflowName')`.
   - Ensure all providers referenced in `definition.actions` or `definition.entity` are provided in the module's `providers` array.
5. **Reference Documentation**:
   - Full API reference: [llms-full.txt](file:///Users/jes/src/nestjs-workflow/llms-full.txt)
   - High-level index: [llms.txt](file:///Users/jes/src/nestjs-workflow/llms.txt)
   - Codebase docs: [CODEBASE_DOCUMENTATION.md](file:///Users/jes/src/nestjs-workflow/CODEBASE_DOCUMENTATION.md)
