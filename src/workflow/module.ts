import { DynamicModule, Module } from '@nestjs/common';
import { WorkflowDefinition } from './definition';
import WorkflowService from './service';

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
  }): DynamicModule {
    const service = new WorkflowService(params.definition);

    return {
      module: WorkflowModule,
      providers: [
        {
          provide: params.name,
          useValue: service,
        },
      ],
      exports: [
        {
          provide: params.name,
          useValue: service,
        },
      ],
    };
  }
}
