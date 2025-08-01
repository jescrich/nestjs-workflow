import { BadRequestException, Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { KafkaEvent, WorkflowDefinition } from './definition';
import { TransitionEvent } from './definition';
import { ModuleRef } from '@nestjs/core';
import { EntityService } from './entity.service';
import { EventMessage } from './kafka/event.handler';
import { KafkaClient } from './kafka/client';

/**
 * Defines a workflow interface that can emit events and update the state of an entity.
 *
 * @template T - The type of the entity being managed.
 * @template E - The type of events that can trigger transitions.
 */
export interface Workflow<T, E> {
  /**
   * Emits an event to trigger a state transition for the given entity.
   *
   * @param params - An object containing the event, the unique identifier (URN) of the entity, and an optional payload.
   * @returns A promise that resolves to the updated entity.
   */
  emit(params: { event: E; urn: string; payload?: object }): Promise<T>;
}

/**
 * Defines a workflow interface that can emit events and update the state of an entity.
 *
 * @template T - The type of the entity being managed.
 * @template E - The type of events that can trigger transitions.
 */
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
export class WorkflowService<T, P, E, S> implements Workflow<T, E>, OnModuleInit {
  private kafkaClient?: KafkaClient;

  private readonly logger = new Logger(WorkflowService.name);
  private readonly actionsOnStatusChanged: Map<
    String,
    {
      action: (params: { entity: T; payload?: P | T | object | string }) => Promise<T>;
      failOnError?: boolean;
    }[]
  > = new Map();
  private readonly actionsOnEvent: Map<
    E,
    ((params: { entity: T; payload?: P | T | object | string }) => Promise<T>)[]
  > = new Map();

  private entityService: EntityService<T, S> | null = null;

  private readonly moduleRef?: ModuleRef;

  constructor(
    private readonly definition: WorkflowDefinition<T, P, E, S>,
    @Optional() injectedEntityService?: EntityService<T, S>,
    @Optional() injectedModuleRef?: ModuleRef,
  ) {
    this.moduleRef = injectedModuleRef;
    this.logger.log(`Initializing workflow: ${this.definition.name}`, this.definition.name);
    this.entityService = injectedEntityService || null;
  }

  async onModuleInit() {
    // Resolve entity service if not already injected
    if (!this.entityService && typeof this.definition.entity === 'function' && this.moduleRef) {
      try {
        const entityServiceInstance = this.moduleRef.get(this.definition.entity, { strict: false });
        if (entityServiceInstance) {
          this.entityService = entityServiceInstance;
          this.logger.log(`Resolved entity service: ${this.definition.entity.name}`, this.definition.name);
        }
      } catch (error) {
        this.logger.warn(`Could not resolve entity service during initialization: ${error.message}`, this.definition.name);
      }
    }
    
    this.configureActions();

    this.configureConditions();

    await this.initializeKakfaConsumers();
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

      let entity: T | null = await this.loadEntity(urn);

      if (!entity || entity === null) {
        this.logger.error(`Element not found`, urn);
        throw new BadRequestException(`Entity not found`, urn);
      }

      let entityCurrentState = this.getEntityStatus(entity);

      if (this.definition.states.finals.includes(entityCurrentState)) {
        this.logger.warn(`Entity: ${urn} is in a final status. Accepting transitions due to a retry mechanism.`, urn);
      }

      let transitionEvent: TransitionEvent<T, P, E, S> | undefined;
      let transition;
      let message = '';

      do {
        transitionEvent = this.definition.transitions.find((transition) => {
          const events = Array.isArray(transition.event) ? transition.event : [transition.event];
          const states = Array.isArray(transition.from) ? transition.from : [transition.from];
          return currentEvent && events.includes(currentEvent) && states.includes(entityCurrentState);
        });

        if (!transitionEvent) {
          throw new Error(
            `Unable to find transition event for Event: ${currentEvent} and Status: ${entityCurrentState}`,
          );
        }

        const nextStatus = transitionEvent.to;

        const possibleTransitions = this.definition.transitions.filter(
          (t) =>
            (Array.isArray(t.from) ? t.from.includes(entityCurrentState) : t.from === entityCurrentState) &&
            t.to === nextStatus,
        );

        this.logger.log(`Possible transitions for ${urn}: ${JSON.stringify(possibleTransitions)}`, urn);

        for (const t of possibleTransitions) {
          this.logger.log(`Checking conditional transition from ${entityCurrentState} to ${nextStatus}`, urn);

          if (
            !t.conditions ||
            (t.conditions &&
              t.conditions.every((condition) => {
                const result = condition(entity!, payload);
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

          if (this.definition.fallback) {
            this.logger.log(`Falling back to the default transition`, urn);
            entity = await this.definition.fallback(entity, currentEvent, payload);
          }

          return entity;
        }

        this.logger.log(`Executing transition from ${entityCurrentState} to ${nextStatus}`, urn);

        let failed;

        if (this.actionsOnEvent.has(currentEvent)) {
          const actions = this.actionsOnEvent.get(currentEvent);
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
          Element: entity,
          message,
        } = await this.executeInlineActions(
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
          await this.updateEntityStatus(entity, this.definition.states.failed);
          this.logger.log(`Element transitioned to failed status. ${message}`, urn);
          break;
        }

        entity = await this.updateEntityStatus(entity, nextStatus);

        this.logger.log(`Element transitioned from ${entityCurrentState} to ${nextStatus} ${message}`, urn);

        // once entity has change it status and

        const statusChangeKey = `${entityCurrentState}-${nextStatus}`;
        if (this.actionsOnStatusChanged.has(statusChangeKey)) {
          const actions = this.actionsOnStatusChanged.get(statusChangeKey);
          if (actions && actions.length > 0) {
            this.logger.log(`Executing actions for status change from ${entityCurrentState} to ${nextStatus}`, urn);
            for (const action of actions) {
              this.logger.log(`Executing action ${action.action.name}`, urn);
              try {
                entity = await action.action({ entity, payload });
              } catch (error) {
                this.logger.error(`Action ${action.action.name} failed: ${error.message}`, urn);
                failed = action.failOnError;
                break;
              }
            }
          }
        }

        if (failed) {
          this.logger.log(`Transition has succeded by a post on status change event has failed. ${message}`, urn);
          await this.updateEntityStatus(entity, this.definition.states.failed);
          this.logger.log(`Element transitioned to failed status. ${message}`, urn);
          break;
        }

        if (this.isInIdleStatus(entity)) {
          this.logger.log(`Element: ${urn} is idle in ${nextStatus} status. Waiting for external event...`);
          break; // Break the loop if the status is idle and waiting for an external event
        }

        if (this.isInFailedStatus(entity)) {
          this.logger.log(`Element: ${urn} is in a final state. Workflow completed.`);
          break;
        }

        currentEvent = this.nextEvent(entity);
        entityCurrentState = this.getEntityStatus(entity);

        this.logger.log(`Next event: ${currentEvent ?? 'none'} Next status: ${entityCurrentState}`, urn);
      } while (currentEvent);

      return entity;
    } catch (error) {
      const message = `An error occurred while transitioning the Element ${error?.message ?? ''}`;
      throw new Error(`Element: ${urn} Event: ${event} - ${message}.`);
    }
  }

  private async executeInlineActions(
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
      return { failed: false, Element: entity, message };
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
    return { failed, Element: entity, message };
  }

  private nextEvent(entity: T): E | null {
    const status = this.getEntityStatus(entity);
    const nextTransitions = this.definition.transitions.filter(
      (transition) =>
        (Array.isArray(transition.from) ? transition.from.includes(status) : transition.from === status) &&
        transition.to !== this.definition.states.failed,
    );
    if (nextTransitions && nextTransitions.length > 1) {
      for (const transition of nextTransitions) {
        const transitionEvent = this.definition.transitions.find((t) => t.event === transition.event);
        if (transitionEvent) {
          const transitionVector = this.definition.transitions.find((t) => t.to === transitionEvent.to);
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
              if (Array.isArray(transition.event)) {
                throw new Error('Multiple transition events are not allowed in a non-idle state');
              }
              return transition.event;
            } else {
              this.logger.log(`Conditions not met for transition ${transition.event}`);
            }
          }
        }
      }
    } else {
      if (nextTransitions && nextTransitions.length === 1) {
        if (Array.isArray(nextTransitions[0].event)) {
          throw new Error('Multiple transition events are not allowed in a non-idle state');
        }
        return nextTransitions[0].event;
      }
    }
    return null;
  }

  private isInIdleStatus(entity: T): boolean {
    const status = this.getEntityStatus(entity);
    if (!status) {
      throw new Error('Entity status is not defined. Unable to determine if the entity is idle or not.');
    }

    return this.definition.states.idles.includes(status);
  }

  private isInFailedStatus(entity: T): boolean {
    const status = this.getEntityStatus(entity);
    if (!status) {
      throw new Error('Entity status is not defined. Unable to determine if the entity is idle or not.');
    }

    return status === this.definition.states.failed;
  }

  private configureActions() {
    try {
      if (this.definition.actions && this.moduleRef) {
        for (const action of this.definition.actions) {
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

                this.validateActionMethod(instance, method);

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

                const from = Reflect.getMetadata('from', instance, method);
                const to = Reflect.getMetadata('to', instance, method);
                const key = `${from}-${to}`;
                if (!this.actionsOnStatusChanged.has(key)) {
                  this.actionsOnStatusChanged.set(key, []);
                }

                this.actionsOnStatusChanged.get(key)?.push({
                  action: instance[method].bind(instance),
                  failOnError: Reflect.getMetadata('failOnError', instance, method),
                });
              }
            }
          }
        }
      }

      this.logger.log(`Initialized with ${this.actionsOnEvent.size} actions on events`, this.definition.name);
      this.logger.log(
        `Initialized with ${this.actionsOnStatusChanged.size} actions on status changes`,
        this.definition.name,
      );
      this.logger.log(`Initialized with ${this.definition.transitions.length} transitions`, this.definition.name);
      this.logger.log(`Initialized with ${this.definition.conditions?.length} conditions`, this.definition.name);

      this.logger.log('moduleref instance ', this.moduleRef);
    } catch (e) {
      this.logger.error('Error trying to initialize workflow actions', e);
      throw e;
    }
  }

  private configureConditions() {}

  private async initializeKakfaConsumers() {
    if (!this.definition.kafka) {
      this.logger.log('No Kafka events defined.');
      return;
    }

    if (!this.kafkaClient) {
      this.logger.log('Kafka client not available, skipping Kafka consumer initialization.');
      return;
    }

    for (const kafkaDef of this.definition.kafka?.events) {
      this.kafkaClient.consume(
        kafkaDef.topic,
        this.definition.name + 'consumer',
        async (params: { key: string; event: T | P; payload?: EventMessage }) => {
          const { key, event } = params;
          this.logger.log(`Kafka Event received on topic ${kafkaDef.topic} with key ${key}`, key);
          try {
            this.emit({ event: kafkaDef.event, urn: key, payload: event });
            this.logger.log(`Kafka Event emmited successfuly`, key);
          } catch (e) {
            this.logger.error(`Kafka Event fail to process`, key);
          }
        },
      );
      this.logger.log('Initializing topic consumption');
    }
  }

  private validateActionMethod = (instance: any, method: string) => {
    // Create a proxy to intercept the method call
    const originalMethod = instance[method];

    instance[method] = function (...args: any[]) {
      if (args.length !== 1) {
        throw new Error(`Action method ${method} must be called with exactly one parameter`);
      }

      const param = args[0];
      if (!param || typeof param !== 'object') {
        throw new Error(`Action method ${method} parameter must be an object`);
      }

      if (!('entity' in param)) {
        throw new Error(`Action method ${method} parameter must have an 'entity' property`);
      }

      // Optional payload is allowed, no need to validate its presence

      // Call the original method if validation passes
      return originalMethod.apply(this, args);
    };
  };

  private async loadEntity(urn: string): Promise<T | null> {
    if (this.entityService) {
      const e = await this.entityService.load(urn);
      return e ?? null;
    }
    
    // Check if entity is a class (EntityService) and resolve it using ModuleRef
    if (typeof this.definition.entity === 'function' && this.moduleRef) {
      try {
        const entityServiceInstance = this.moduleRef.get(this.definition.entity, { strict: false });
        if (entityServiceInstance) {
          return await entityServiceInstance.load(urn);
        }
      } catch (error) {
        this.logger.warn(`Could not resolve EntityService from ModuleRef: ${error.message}`);
      }
    }
    
    // Fallback to inline entity configuration
    if (typeof this.definition.entity === 'object' && 'load' in this.definition.entity) {
      return await (this.definition.entity as { load: (urn: string) => Promise<T> }).load(urn);
    }
    
    throw new Error(`Unable to load entity: entity service not properly configured`);
  }

  private getEntityStatus(entity: T): S {
    if (this.entityService) {
      return this.entityService.status(entity);
    }
    
    // Check if entity is a class (EntityService) and resolve it using ModuleRef
    if (typeof this.definition.entity === 'function' && this.moduleRef) {
      try {
        const entityServiceInstance = this.moduleRef.get(this.definition.entity, { strict: false });
        if (entityServiceInstance) {
          return entityServiceInstance.status(entity);
        }
      } catch (error) {
        this.logger.warn(`Could not resolve EntityService from ModuleRef: ${error.message}`);
      }
    }
    
    // Fallback to inline entity configuration
    return (this.definition.entity as { status: (entity: T) => S }).status(entity);
  }

  private async updateEntityStatus(entity: T, status: S): Promise<T> {
    if (this.entityService) {
      return await this.entityService.update(entity, status);
    }
    
    // Check if entity is a class (EntityService) and resolve it using ModuleRef
    if (typeof this.definition.entity === 'function' && this.moduleRef) {
      try {
        const entityServiceInstance = this.moduleRef.get(this.definition.entity, { strict: false });
        if (entityServiceInstance) {
          return await entityServiceInstance.update(entity, status);
        }
      } catch (error) {
        this.logger.warn(`Could not resolve EntityService from ModuleRef: ${error.message}`);
      }
    }
    
    // Fallback to inline entity configuration
    if (typeof this.definition.entity === 'object' && 'update' in this.definition.entity) {
      return await (this.definition.entity as { update: (entity: T, status: S) => Promise<T> }).update(entity, status);
    }
    
    throw new Error(`Unable to update entity status: entity service not properly configured`);
  }

  private getEntityUrn(entity: T): string {
    if (this.entityService) {
      return this.entityService.urn(entity);
    }
    
    // Check if entity is a class (EntityService) and resolve it using ModuleRef
    if (typeof this.definition.entity === 'function' && this.moduleRef) {
      try {
        const entityServiceInstance = this.moduleRef.get(this.definition.entity, { strict: false });
        if (entityServiceInstance) {
          return entityServiceInstance.urn(entity);
        }
      } catch (error) {
        this.logger.warn(`Could not resolve EntityService from ModuleRef: ${error.message}`);
      }
    }
    
    // Fallback to inline entity configuration
    return (this.definition.entity as { urn: (entity: T) => string }).urn(entity);
  }
}
