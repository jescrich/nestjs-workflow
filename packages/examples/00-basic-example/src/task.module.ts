import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WorkflowModule } from '@jescrich/nestjs-workflow';
import { taskWorkflowDefinition } from './task.workflow';
import { TaskService } from './task.service';
import { TaskEntityService } from './task.entity.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    WorkflowModule.register({
      name: 'TaskWorkflow',
      definition: taskWorkflowDefinition,
    }),
  ],
  providers: [
    TaskService,
    TaskEntityService,
  ],
  exports: [TaskService, TaskEntityService]
})
export class TaskModule {}