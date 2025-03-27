import { DynamicModule, ForwardReference, Module, Provider, Type } from '@nestjs/common';
import { WorkflowDefinition } from './definition';
import { WorkflowService } from './service';
import { ModuleRef } from '@nestjs/core';
import { EntityService } from './entity.service';
import { KafkaClient } from './kafka/client';
@Module({})
/**
 * Registers a dynamic workflow module with a specific name and definition.
 *
 * @template T The type of the workflow context
 * @template P The type of workflow parameters
 * @template Event The type of workflow events
 * @template State The type of workflow state
 *
 * @param params Configuration for registering the workflow module
 * @param params.name The unique name to provide the workflow service
 * @param params.definition The workflow definition to be used
 *
 * @returns A dynamic module configuration for NestJS
 */
export class WorkflowModule {
  static register<T, P, Event, State>(params: {
    name: string;
    definition: WorkflowDefinition<T, P, Event, State>;
    imports?: Array<Type<any> | DynamicModule | Promise<DynamicModule> | ForwardReference>;
    providers?: Provider[];
    kafka?: {
      enabled: boolean;
      clientId: string;
      brokers: string;
    };
  }): DynamicModule {
    const providers = params.providers ?? [];

    if (params.kafka && params.kafka.enabled) {
      providers.push({
        provide: KafkaClient,
        useFactory: () => new KafkaClient(params.kafka?.clientId, params.kafka?.brokers),
      });
    }

    if (params.definition.entity === undefined) {
      throw new Error('Workflow definition must have an Entity defined');
    }

    const isEntityServiceAClass =
      typeof params.definition.entity === 'function' && params.definition.entity.prototype !== undefined;

    // Check if it's a provider (could be a class or a factory provider)
    const isEntityServiceAProvider =
      isEntityServiceAClass ||
      (typeof params.definition.entity === 'object' &&
        'provide' in params.definition.entity &&
        'useClass' in params.definition.entity);

    return {
      module: WorkflowModule,
      imports: [...(params.imports ?? [])],
      providers: [
        // {
        //   provide: ConsumerService,
        //   useFactory: (kafkaClient: KafkaClient, consumerRef: ConsumerRefService, moduleRef: ModuleRef) => {
        //     return new ConsumerService(params.name, kafkaClient, consumerRef, moduleRef);
        //   },
        //   inject: [KafkaClient, ConsumerRefService, ModuleRef],
        // },

        !isEntityServiceAProvider
          ? {
              provide: WorkflowService<T, P, Event, State>,
              useFactory: (moduleRef: ModuleRef) => {
                return new WorkflowService(params.definition);
              },
              inject: [],
            }
          : {
              provide: WorkflowService<T, P, Event, State>,
              useFactory: (entityService: EntityService<T, State>) => {
                return new WorkflowService(params.definition, entityService);
              },
              inject: [EntityService<T, State>],
            },
        !isEntityServiceAProvider
          ? {
              provide: params.name,
              useFactory: (moduleRef: ModuleRef) => {
                return new WorkflowService(params.definition);
              },
              inject: [],
            }
          : {
              provide: params.name,
              useFactory: (entityService: EntityService<T, State>) => {
                return new WorkflowService(params.definition, entityService);
              },
              inject: [EntityService<T, State>],
            },
        ...(params.providers ?? []),
      ],
      exports: [
        WorkflowService<T, P, Event, State>,
        {
          provide: params.name,
          useExisting: WorkflowService<T, P, Event, State>,
        },
        ...(params.kafka?.enabled ? [KafkaClient] : []),
      ],
    };
  }
}
