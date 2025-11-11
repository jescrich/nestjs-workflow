import { WorkflowDefinition } from '@jescrich/nestjs-workflow';
import { Task, TaskStatus, TaskEvent } from './task.entity';
import { TaskEntityService } from './task.entity.service';

export interface TaskContext {
  rejectionReason?: string;
  approvedBy?: string;
}

export const taskWorkflowDefinition: WorkflowDefinition<Task, TaskContext, TaskEvent, TaskStatus> = {
  name: 'TaskWorkflow',
  entity: TaskEntityService,
  
  states: {
    // Final states - workflow ends here
    finals: [TaskStatus.COMPLETED, TaskStatus.CANCELLED],
    
    // Idle states - waiting for external input
    idles: [TaskStatus.TODO, TaskStatus.IN_REVIEW],
    
    // Failed state
    failed: TaskStatus.CANCELLED
  },
  
  transitions: [
    // Start working on a task
    {
      from: TaskStatus.TODO,
      to: TaskStatus.IN_PROGRESS,
      event: TaskEvent.START,
      conditions: [
        (task: Task) => task.assignee !== undefined
      ]
    },
    
    // Submit task for review
    {
      from: TaskStatus.IN_PROGRESS,
      to: TaskStatus.IN_REVIEW,
      event: TaskEvent.SUBMIT_FOR_REVIEW,
      conditions: [
        (task: Task) => task.reviewer !== undefined
      ]
    },
    
    // Approve task (complete it)
    {
      from: TaskStatus.IN_REVIEW,
      to: TaskStatus.COMPLETED,
      event: TaskEvent.APPROVE
    },
    
    // Reject task (back to in progress)
    {
      from: TaskStatus.IN_REVIEW,
      to: TaskStatus.IN_PROGRESS,
      event: TaskEvent.REJECT
    },
    
    // Cancel from any non-final state
    {
      from: [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW],
      to: TaskStatus.CANCELLED,
      event: TaskEvent.CANCEL
    }
  ],
  
  // BullMQ configuration for event-driven workflow
  bullmq: {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    },
    events: [
      { queue: 'task-start', event: TaskEvent.START },
      { queue: 'task-submit', event: TaskEvent.SUBMIT_FOR_REVIEW },
      { queue: 'task-approve', event: TaskEvent.APPROVE },
      { queue: 'task-reject', event: TaskEvent.REJECT },
      { queue: 'task-cancel', event: TaskEvent.CANCEL },
    ],
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 30000, // 30 seconds
      },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
    deadLetterQueue: {
      enabled: true,
      suffix: '-dlq',
    },
  },
};
