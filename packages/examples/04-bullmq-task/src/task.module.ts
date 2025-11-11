import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WorkflowModule } from '@jescrich/nestjs-workflow';
import { taskWorkflowDefinition } from './task.workflow';
import { TaskService } from './task.service';
import { TaskEntityService } from './task.entity.service';
import { TaskProducerService } from './task.producer.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    WorkflowModule.register({
      name: 'TaskWorkflow',
      definition: taskWorkflowDefinition,
      bullmq: {
        enabled: true,
        config: taskWorkflowDefinition.bullmq!,
      },
    }),
  ],
  providers: [
    TaskService,
    TaskEntityService,
    TaskProducerService,
  ],
  exports: [TaskService, TaskEntityService, TaskProducerService]
})
export class TaskModule {}
