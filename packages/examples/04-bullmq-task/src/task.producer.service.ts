import { Injectable, Logger } from '@nestjs/common';
import { BullMQClient } from '@jescrich/nestjs-workflow';
import { TaskEvent } from './task.entity';

/**
 * TaskProducerService demonstrates how to produce jobs to BullMQ queues
 * to trigger workflow events asynchronously.
 */
@Injectable()
export class TaskProducerService {
  private readonly logger = new Logger(TaskProducerService.name);

  constructor(private readonly bullmqClient: BullMQClient) {}

  /**
   * Emit a START event via BullMQ to begin working on a task
   */
  async emitStartEvent(taskId: string, assignee: string): Promise<void> {
    try {
      const job = await this.bullmqClient.produce(
        'task-start',
        'task-start-job',
        {
          urn: taskId,
          payload: { assignee }
        }
      );
      this.logger.log(`Emitted START event for task ${taskId} via BullMQ (Job ID: ${job.id})`);
    } catch (error) {
      this.logger.error(`Failed to emit START event: ${error.message}`);
      throw error;
    }
  }

  /**
   * Emit a SUBMIT_FOR_REVIEW event via BullMQ
   */
  async emitSubmitForReviewEvent(taskId: string, reviewer: string): Promise<void> {
    try {
      const job = await this.bullmqClient.produce(
        'task-submit',
        'task-submit-job',
        {
          urn: taskId,
          payload: { reviewer }
        }
      );
      this.logger.log(`Emitted SUBMIT_FOR_REVIEW event for task ${taskId} via BullMQ (Job ID: ${job.id})`);
    } catch (error) {
      this.logger.error(`Failed to emit SUBMIT_FOR_REVIEW event: ${error.message}`);
      throw error;
    }
  }

  /**
   * Emit an APPROVE event via BullMQ
   */
  async emitApproveEvent(taskId: string, approvedBy: string): Promise<void> {
    try {
      const job = await this.bullmqClient.produce(
        'task-approve',
        'task-approve-job',
        {
          urn: taskId,
          payload: { approvedBy }
        }
      );
      this.logger.log(`Emitted APPROVE event for task ${taskId} via BullMQ (Job ID: ${job.id})`);
    } catch (error) {
      this.logger.error(`Failed to emit APPROVE event: ${error.message}`);
      throw error;
    }
  }

  /**
   * Emit a REJECT event via BullMQ with rejection reason
   */
  async emitRejectEvent(taskId: string, reason: string): Promise<void> {
    try {
      const job = await this.bullmqClient.produce(
        'task-reject',
        'task-reject-job',
        {
          urn: taskId,
          payload: { reason }
        }
      );
      this.logger.log(`Emitted REJECT event for task ${taskId} via BullMQ (Job ID: ${job.id})`);
    } catch (error) {
      this.logger.error(`Failed to emit REJECT event: ${error.message}`);
      throw error;
    }
  }

  /**
   * Emit a CANCEL event via BullMQ
   */
  async emitCancelEvent(taskId: string, reason?: string): Promise<void> {
    try {
      const job = await this.bullmqClient.produce(
        'task-cancel',
        'task-cancel-job',
        {
          urn: taskId,
          payload: { reason }
        }
      );
      this.logger.log(`Emitted CANCEL event for task ${taskId} via BullMQ (Job ID: ${job.id})`);
    } catch (error) {
      this.logger.error(`Failed to emit CANCEL event: ${error.message}`);
      throw error;
    }
  }

  /**
   * Example: Emit event with complex payload structure
   */
  async emitEventWithComplexPayload(taskId: string, event: TaskEvent, payload: any): Promise<void> {
    const queueMap = {
      [TaskEvent.START]: 'task-start',
      [TaskEvent.SUBMIT_FOR_REVIEW]: 'task-submit',
      [TaskEvent.APPROVE]: 'task-approve',
      [TaskEvent.REJECT]: 'task-reject',
      [TaskEvent.CANCEL]: 'task-cancel',
    };

    const queueName = queueMap[event];
    if (!queueName) {
      throw new Error(`Unknown event: ${event}`);
    }

    try {
      const job = await this.bullmqClient.produce(
        queueName,
        `${queueName}-job`,
        {
          urn: taskId,
          payload
        }
      );
      this.logger.log(`Emitted ${event} event for task ${taskId} via BullMQ (Job ID: ${job.id})`);
    } catch (error) {
      this.logger.error(`Failed to emit ${event} event: ${error.message}`);
      throw error;
    }
  }

  /**
   * Example: Batch emit multiple events
   */
  async emitBatchEvents(events: Array<{ taskId: string; event: TaskEvent; payload: any }>): Promise<void> {
    const promises = events.map(({ taskId, event, payload }) =>
      this.emitEventWithComplexPayload(taskId, event, payload)
    );

    try {
      await Promise.all(promises);
      this.logger.log(`Successfully emitted ${events.length} events via BullMQ`);
    } catch (error) {
      this.logger.error(`Failed to emit batch events: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check BullMQ health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const isHealthy = await this.bullmqClient.isHealthy();
      if (isHealthy) {
        this.logger.log('BullMQ connection is healthy');
      } else {
        this.logger.warn('BullMQ connection is unhealthy');
      }
      return isHealthy;
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      return false;
    }
  }
}
