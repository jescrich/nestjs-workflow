import { DynamicModule, ForwardReference, Module, Provider, Type } from '@nestjs/common';
import { WorkflowDefinition } from './definition';
import WorkflowService from './service';
import { ModuleRef } from '@nestjs/core';
import { KafkaModule } from '@this/kafka/module';
import { EntityService } from './entity.service';
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
    if (params.kafka && params.kafka.enabled) {
      params.imports?.push(
        KafkaModule.register({
          brokers: params.kafka.brokers,
          clientId: params.kafka.clientId,
        }),
      );
    }

    if (params.definition.Entity === undefined) {
      throw new Error('Workflow definition must have an Entity defined');
    }

    const isEntityServiceAClass =
      typeof params.definition.Entity === 'function' && params.definition.Entity.prototype !== undefined;

    // Check if it's a provider (could be a class or a factory provider)
    const isEntityServiceAProvider =
      isEntityServiceAClass ||
      (typeof params.definition.Entity === 'object' &&
        'provide' in params.definition.Entity &&
        'useClass' in params.definition.Entity);

    // if (!isEntityServiceAClass  && !isEntityServiceAProvider) {
    //   throw new Error('Entity must be a Type, Provider, or function');
    // }

    return {
      module: WorkflowModule,
      imports: [...(params.imports ?? [])],
      providers: [
        !isEntityServiceAProvider
          ? {
              provide: params.name,
              useFactory: (moduleRef) => {
                return new WorkflowService(params.definition, moduleRef);
              },
              inject: [ModuleRef],
            }
          : {
              provide: params.name,
              useFactory: (moduleRef, entityService) => {
                return new WorkflowService(params.definition, moduleRef, entityService);
              },
              inject: [ModuleRef, EntityService<T, State>],
            },
        ...(params.providers ?? []),
      ],
      exports: [
        {
          provide: params.name,
          useExisting: WorkflowService,
        },
      ],
    };
  }
}
