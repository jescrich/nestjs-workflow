import { Type } from "@nestjs/common";

/**
 * Defines the structure of a transition event in a workflow definition. This includes the following properties:
 * - `event`: The event that triggers the transition.
 * - `from`: The state that the workflow is transitioning from.
 * - `to`: The state that the workflow is transitioning to.
 * - `actions`: An optional array of actions to be performed during the transition.
 * - `conditions`: An optional array of conditions to be checked during the transition.
 * Actions and conditions can be defined as functions that take an entity and an optional payload as arguments or
 * as workflow actions classes that are decorated with the `@OnEvent` and/or `@OnStatusChanged` decorator.
 */
export interface TransitionEvent<T, P, Event, States> {
  event: Event;
  from: States;
  to: States;
  actions?: ((entity: T, payload?: P | T | object | string) => Promise<T>)[];// | Type<any>[];
  conditions?: ((entity: T, payload?: P | T | object | string) => boolean)[];// | Type<any>[];
}

/**
 * Defines the structure of a workflow definition, which includes the following properties:
 * - `FinalStates`: An array of states that represent the final states of the workflow.
 * - `IdleStates`: An array of states that represent the idle states of the workflow.
 * - `FailedState`: The state that represents a failed state in the workflow.
 * - `Transitions`: An array of transition events that define the allowed transitions between states.
 * - `Actions`: An optional array of actions that can be performed during the workflow.
 * - `Conditions`: An optional array of conditions that can be checked during the workflow.
 * - `Entity`: An object that defines the operations for creating, updating, loading, and retrieving the status and URN of the workflow entity.
 * - `Fallback`: An optional function that can be used as a fallback when a transition event is not defined.
 */
export interface WorkflowDefinition<T, P, Event, State> {
  FinalStates: State[];
  IdleStates: State[];
  FailedState: State;
  Transitions: TransitionEvent<T, P, Event, State>[];
  Actions?: Type<any>[];
  Conditions?: Type<any>[];
  Entity: {
    new: () => T;
    update: (entity: T, status: State) => Promise<T>;
    load: (urn: string) => Promise<T>;
    status: (entity: T) => State;
    urn: (entity: T) => string;
  };
  Fallback?: (entity: T, event: Event, payload?: P | T | object | string) => Promise<T>;
}