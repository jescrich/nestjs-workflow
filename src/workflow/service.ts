import { BadRequestException, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WorkflowDefinition } from './definition';
import { TransitionEvent } from './definition';
import { ModuleRef } from '@nestjs/core';

export interface Workflow<T, E> {
  emit(params: { event: E; urn: string; payload?: object }): Promise<T>;
}

@Injectable()
/**
 * A generic workflow service that manages state transitions for entities
 *
 * @typeParam T - The type of the entity being managed
 * @typeParam P - The type of the payload used in transitions
 * @typeParam E - The type of events that can trigger transitions
 * @typeParam S - The type of states the entity can be in
 */
export default class WorkflowService<T, P, E, S> implements Workflow<T, E>, OnModuleInit {
  private readonly logger = new Logger(WorkflowService.name);
  private readonly actionsOnStatusChanged: Map<
    S,
    Map<S, ((params: { entity: T; payload?: P | T | object | string }) => Promise<T>)[]>
  > = new Map();
  private readonly actionsOnEvent: Map<
    E,
    ((params: { entity: T; payload?: P | T | object | string }) => Promise<T>)[]
  > = new Map();

  constructor(
    private readonly definition: WorkflowDefinition<T, P, E, S>,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit() {
    // Collect all actions from the definition

    if (!this.moduleRef) {
      throw new Error('ModuleRef is not available');
    }
    if (this.definition.Actions) {
      for (const action of this.definition.Actions) {
        const instance = this.moduleRef.get(action, { strict: false });
        if (instance && Reflect.getMetadata('isWorkflowAction', action)) {
          const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(instance));
          for (const method of methods) {
            const event = Reflect.getMetadata('onEvent', instance, method);
            const statusChanged = Reflect.getMetadata('onStatusChanged', instance, method);

            if (event) {
              const methodParams = Reflect.getMetadata('design:paramtypes', instance, method);
              if (!methodParams || methodParams.length !== 1 || !methodParams[0].name.includes('Object')) {
                throw new Error(
                  `Action method ${method} must have signature (params: { entity: T, payload?: P | T | object | string })`,
                );
              }
              if (!this.actionsOnEvent.has(event)) {
                this.actionsOnEvent.set(event, []);
              }
              this.actionsOnEvent.get(event)?.push(instance[method].bind(instance));
            }

            if (statusChanged) {
              const methodParams = Reflect.getMetadata('design:paramtypes', instance, method);
              if (!methodParams || methodParams.length !== 1 || !methodParams[0].name.includes('Object')) {
                throw new Error(
                  `Action method ${method} must have signature (params: { entity: T, payload?: P | T | object | string })`,
                );
              }
              const { from, to } = statusChanged;
              if (!this.actionsOnStatusChanged.has(from)) {
                this.actionsOnStatusChanged.set(from, new Map());
              }
              if (!this.actionsOnStatusChanged.get(from)?.has(to)) {
                this.actionsOnStatusChanged.get(from)?.set(to, []);
              }
              this.actionsOnStatusChanged.get(from)?.get(to)?.push(instance[method].bind(instance));
            }
          }
        }
      }
    }

    this.logger.log(`Initialized with ${this.actionsOnEvent.size} actions on events`);
    this.logger.log(`Initialized with ${this.actionsOnStatusChanged.size} actions on status changes`);
    this.logger.log(`Initialized with ${this.definition.Transitions.length} transitions`);
    this.logger.log(`Initialized with ${this.definition.Conditions?.length} conditions`);
  }

  /**
   * Emits an event to trigger a state transition for an entity
   *
   * @param params - The parameters for the state transition
   * @param params.event - The event triggering the transition
   * @param params.urn - The unique identifier of the entity
   * @param params.payload - Optional payload associated with the transition
   * @returns A promise that resolves to the updated entity after the transition
   */
  public async emit(params: { event: E; urn: string; payload?: T | P | object | string }): Promise<T> {
    const { event, urn, payload } = params;
    const result = await this.transition({ event, urn, payload });
    return result;
  }

  private async transition(params: { event: E; urn: string; payload?: T | P | object | string }): Promise<T> {
    const { event, urn, payload } = params;

    let currentEvent: E | null = event;

    try {
      this.logger.log(`Event: ${event}`, urn);

      let entity: T = await this.definition.Entity.load(urn);

      if (!entity) {
        this.logger.error(`Element not found`, urn);
        throw new BadRequestException(`Entity not found`, urn);
      }

      let entityCurrentState = this.definition.Entity.status(entity);

      if (this.definition.FinalStates.includes(entityCurrentState)) {
        this.logger.warn(`Entity: ${urn} is in a final status. Accepting transitions due to a retry mechanism.`, urn);
      }

      let transitionEvent: { from: S; to: S; event: E } | undefined;
      let transition;
      let message = '';

      do {
        transitionEvent = this.definition.Transitions.find(
          (transition) => transition.event === currentEvent && transition.from === entityCurrentState,
        );

        if (!transitionEvent) {
          throw new Error(
            `Unable to find transition event for Event: ${currentEvent} and Status: ${entityCurrentState}`,
          );
        }

        const nextStatus = transitionEvent.to;

        const possibleTransitions = this.definition.Transitions.filter(
          (t) => t.from === entityCurrentState && t.to === nextStatus,
        );

        this.logger.log(`Possible transitions for ${urn}: ${JSON.stringify(possibleTransitions)}`, urn);

        for (const t of possibleTransitions) {
          this.logger.log(`Checking conditional transition from ${entityCurrentState} to ${nextStatus}`, urn);

          if (
            !t.conditions ||
            (t.conditions &&
              t.conditions.every((condition) => {
                const result = condition(entity, payload);
                this.logger.log(`Condition ${condition.name || 'anonymous'} result: ${result}`, urn);
                return result;
              }))
          ) {
            transition = t;
            break;
          } else {
            this.logger.log(`Condition not met for transition from ${entityCurrentState} to ${nextStatus}`, urn);
          }
        }

        if (!transition) {
          this.logger.warn(
            `There's no valid transition from ${entityCurrentState} to ${nextStatus} or the condition is not met.`,
          );

          if (this.definition.Fallback) {
            this.logger.log(`Falling back to the default transition`, urn);
            entity = await this.definition.Fallback(entity, currentEvent, payload);
          }

          return entity;
        }

        this.logger.log(`Executing transition from ${entityCurrentState} to ${nextStatus}`, urn);

        let failed;

        if (this.actionsOnEvent.has(transition.event)) {
          const actions = this.actionsOnEvent.get(transition.event);
          if (actions && actions.length > 0) {
            this.logger.log(`Executing actions for event ${transition.event}`, urn);

            for (const action of actions) {
              this.logger.log(`Executing action ${action.name}`, urn);
              try {
                entity = await action({ entity, payload });
              } catch (error) {
                this.logger.error(`Action ${action.name} failed: ${error.message}`, urn);
                failed = true;
                break;
              }
            }
          }
        }

        ({
          failed,
          order: entity,
          message,
        } = await this.executeActions(
          transition,
          entity,
          currentEvent,
          message,
          payload,
          entityCurrentState,
          nextStatus,
          urn,
        ));

        // If the transition failed, set the status to failed and break the loop

        if (failed) {
          this.logger.log(`Transition failed. Setting status to failed. ${message}`, urn);
          await this.definition.Entity.update(entity, this.definition.FailedState);
          this.logger.log(`Order transitioned to failed status. ${message}`, urn);
          break;
        }

        entity = await this.definition.Entity.update(entity, nextStatus);

        this.logger.log(`Order transitioned from ${entityCurrentState} to ${nextStatus} ${message}`, urn);

        if (this.isInIdleStatus(entity)) {
          this.logger.log(`Order: ${urn} is idle in ${nextStatus} status. Waiting for external event...`);
          break; // Break the loop if the status is idle and waiting for an external event
        }

        currentEvent = this.nextEvent(entity);
        entityCurrentState = this.definition.Entity.status(entity);

        this.logger.log(`Next event: ${currentEvent ?? 'none'} Next status: ${entityCurrentState}`, urn);
      } while (currentEvent);

      return entity;
    } catch (error) {
      const message = `An error occurred while transitioning the order ${error?.message ?? ''}`;
      throw new Error(`Order: ${urn} Event: ${event} - ${message}.`);
    }
  }

  private async executeActions(
    transition: TransitionEvent<T, P, E, S>,
    entity: T,
    currentEvent: E,
    message: string,
    payload: string | T | P | object | undefined,
    currentStatus: S,
    nextStatus: S,
    urn: string,
  ) {
    if (!transition.actions) {
      return { failed: false, order: entity, message };
    }
    const actions = await transition.actions;
    let failed = false;

    try {
      for (const action of actions) {
        entity = await action(entity, payload);
        if (!entity) {
          throw new Error(`Transition from ${currentStatus} to ${nextStatus} has failed. Error: Result is null.`);
        }
      }
    } catch (error) {
      this.logger.error(`Entity workflow has failed. Error: ${error?.message}`, urn);
      message = error?.message;
      failed = true;
    }
    return { failed, order: entity, message };
  }

  private nextEvent(entity: T): E | null {
    const status = this.definition.Entity.status(entity);
    const nextTransitions = this.definition.Transitions.filter(
      (transition) => transition.from === status && transition.to !== this.definition.FailedState,
    );

    if (nextTransitions && nextTransitions.length > 1) {
      // Determine which of the next transitions to take based on the order and conditions.
      for (const transition of nextTransitions) {
        const transitionEvent = this.definition.Transitions.find((t) => t.event === transition.event);
        if (transitionEvent) {
          const transitionVector = this.definition.Transitions.find((t) => t.to === transitionEvent.to);
          if (transitionVector && transitionVector.conditions) {
            let allConditionsMet = true;

            // Execute each condition separately and log the results
            for (const condition of transition.conditions || []) {
              const conditionResult = condition(entity);
              this.logger.log(`Condition ${condition.name || 'unnamed'} result:`, conditionResult);

              if (!conditionResult) {
                allConditionsMet = false;
                // You can choose to break here or continue evaluating all conditions
                // break;
              }
            }

            if (allConditionsMet) {
              return transition.event;
            } else {
              this.logger.log(`Conditions not met for transition ${transition.event}`);
            }
          }
        }
      }
    } else {
      return nextTransitions && nextTransitions.length === 1 ? nextTransitions[0].event : null;
    }
    return nextTransitions && nextTransitions.length === 1 ? nextTransitions[0].event : null;
  }

  private isInIdleStatus(entity: T): boolean {
    const status = this.definition.Entity.status(entity);
    if (!status) {
      throw new Error('Entity status is not defined. Unable to determine if the entity is idle or not.');
    }

    return this.definition.IdleStates.includes(status);
  }
}
