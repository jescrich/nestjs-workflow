import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { WorkflowDefinition } from './definition';
import { TransitionEvent } from './definition';

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
export default class WorkflowService<T, P, E, S> implements Workflow<T, E> {
  private readonly logger = new Logger(WorkflowService.name);
  constructor(private readonly definition: WorkflowDefinition<T, P, E, S>) {}

  // /**
  //  * Starts a new order workflow
  //  *
  //  * @param params - The parameters for creating the order.
  //  * @param params.source - The source order object.
  //  * @returns A promise that resolves to the created order.
  //  */
  // public async start(params: { order: Order }): Promise<Order> {
  //   const { order } = params;

  //   this.log(order.id, `Starting order workflow for order: ${order.id}`);

  //   const localOrder = await this.repository.createOrUpdate(order);
  //   return await this.emit({ event: OrderEvent.Create, id: localOrder.id, payload: order.request?.payload });
  // }

  // public async emit(params: { urn: string; event: E; payload?: T | P | string }): Promise<T> {
  //   const { urn, event, payload } = params;
  //   return await this.emit({ event, urn, payload });
  // }

  // public emit(params: { event: E; urn: string; payload?: object }): Promise<T> {
  //   const { event, urn, payload } = params;
  //   return this.emit2({ event, urn, payload });
  // }

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
