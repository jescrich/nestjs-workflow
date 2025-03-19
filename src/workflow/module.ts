import { DynamicModule, ForwardReference, Module, Provider, Type } from '@nestjs/common';
import { WorkflowDefinition } from './definition';
import WorkflowService from './service';
import { ModuleRef } from '@nestjs/core';
import { KafkaModule } from '@this/kafka/module';
import { KafkaClient } from '@this/kafka/client';

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
    providers?: Provider[]
    kafka?: {
      enabled: boolean;
      clientId: string;
      brokers: string;
    }
  }): DynamicModule {

    if (params.kafka && params.kafka.enabled) {
      params.imports?.push(
        KafkaModule.register({
          brokers: params.kafka.brokers,
          clientId: params.kafka.clientId,
        })
      )
    }
    
    return {
      module: WorkflowModule,
      imports: [
        ...params.imports ?? [],
      ],
      providers: [
        {
          provide: params.name,
          useFactory: (moduleRef) => {
            return new WorkflowService(params.definition, moduleRef);
          },
          inject: [ModuleRef],
        },
        ...params.providers ?? [],
      ],
      exports: [
        {
          provide: params.name,
          useExisting: WorkflowService,
        },
        ModuleRef,
      ],
    };
  }
}