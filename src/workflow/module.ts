import { DynamicModule, ForwardReference, Logger, Module, Provider, Type } from '@nestjs/common';
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

    const isEntityClass = typeof params.definition.entity === 'function';
    
    // If entity is a class, ensure it's provided in the module
    if (isEntityClass && !providers.some(p => 
      (typeof p === 'object' && 'provide' in p && p.provide === params.definition.entity) ||
      (typeof p === 'object' && 'provide' in p && p.provide === EntityService)
    )) {
      const entityClass = params.definition.entity as Type<EntityService<T, State>>;
      providers.push({
        provide: entityClass,
        useClass: entityClass,
      });
    }

    return {
      module: WorkflowModule,
      imports: [...(params.imports ?? [])],
      providers: [
        // Register the named workflow service
        {
          provide: params.name,
          useFactory: (moduleRef: ModuleRef, kafkaClient?: KafkaClient, entityService?: EntityService<T, State>) => {
            Logger.log('Creating workflow service', 'WorkflowModule');
            const service = new WorkflowService(params.definition, entityService, moduleRef);
            // Manually set kafkaClient if available since @Inject doesn't work with factory
            if (kafkaClient) {
              (service as any).kafkaClient = kafkaClient;
            }
            return service;
          },
          inject: [
            ModuleRef, 
            ...(params.kafka?.enabled ? [KafkaClient] : []),
            ...(isEntityClass ? [{ token: EntityService, optional: true }] : [])
          ],
        },
        // Register the generic WorkflowService
        {
          provide: WorkflowService,
          useFactory: (moduleRef: ModuleRef, kafkaClient?: KafkaClient, entityService?: EntityService<T, State>) => {
            Logger.log('Creating generic workflow service', 'WorkflowModule');
            const service = new WorkflowService(params.definition, entityService, moduleRef);
            // Manually set kafkaClient if available since @Inject doesn't work with factory
            if (kafkaClient) {
              (service as any).kafkaClient = kafkaClient;
            }
            return service;
          },
          inject: [
            ModuleRef, 
            ...(params.kafka?.enabled ? [KafkaClient] : []),
            ...(isEntityClass ? [{ token: EntityService, optional: true }] : [])
          ],
        },
        // Add all providers including Kafka and custom providers
        ...providers,
      ],
      exports: [
        // Export the named workflow service
        {
          provide: params.name,
          useExisting: WorkflowService,
        },
        // Export WorkflowService
        WorkflowService,
        // Export Kafka client if enabled
        ...(params.kafka?.enabled ? [KafkaClient] : []),
      ],
    };
  }
}
