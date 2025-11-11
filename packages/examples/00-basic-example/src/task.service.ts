import { Injectable, Inject, Logger } from '@nestjs/common';
import { WorkflowService } from '@jescrich/nestjs-workflow';
import { Task, TaskStatus, TaskEvent } from './task.entity';
import { TaskEntityService } from './task.entity.service';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    @Inject('TaskWorkflow')
    private readonly workflowService: WorkflowService<Task, any, TaskEvent, TaskStatus>,
    private readonly entityService: TaskEntityService
  ) {}

  async createTask(title: string, description?: string): Promise<Task> {
    const task = new Task(title, description);
    await this.entityService.save(task);
    this.logger.log(`Created task: ${task.id} - ${title}`);
    return task;
  }

  async startTask(taskId: string, assignee: string): Promise<Task> {
    const task = await this.entityService.findById(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.assignee = assignee;
    task.addNote(`Assigned to ${assignee}`);

    const updatedTask = await this.workflowService.emit({
      urn: task.id,
      event: TaskEvent.START,
      payload: { assignee }
    });

    await this.entityService.save(updatedTask);
    this.logger.log(`Task ${taskId} started by ${assignee}`);
    return updatedTask;
  }

  async submitForReview(taskId: string, reviewer: string): Promise<Task> {
    const task = await this.entityService.findById(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.reviewer = reviewer;
    task.addNote(`Submitted for review to ${reviewer}`);

    const updatedTask = await this.workflowService.emit({
      urn: task.id,
      event: TaskEvent.SUBMIT_FOR_REVIEW,
      payload: { reviewer }
    });

    await this.entityService.save(updatedTask);
    this.logger.log(`Task ${taskId} submitted for review to ${reviewer}`);
    return updatedTask;
  }

  async approveTask(taskId: string, approvedBy: string): Promise<Task> {
    const task = await this.entityService.findById(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.addNote(`Approved by ${approvedBy}`);
    task.complete();

    const updatedTask = await this.workflowService.emit({
      urn: task.id,
      event: TaskEvent.APPROVE,
      payload: { approvedBy }
    });

    await this.entityService.save(updatedTask);
    this.logger.log(`Task ${taskId} approved by ${approvedBy}`);
    return updatedTask;
  }

  async rejectTask(taskId: string, reason: string): Promise<Task> {
    const task = await this.entityService.findById(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.addNote(`Rejected: ${reason}`);

    const updatedTask = await this.workflowService.emit({
      urn: task.id,
      event: TaskEvent.REJECT,
      payload: { reason }
    });

    await this.entityService.save(updatedTask);
    this.logger.log(`Task ${taskId} rejected: ${reason}`);
    return updatedTask;
  }

  async cancelTask(taskId: string, reason?: string): Promise<Task> {
    const task = await this.entityService.findById(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.addNote(`Cancelled${reason ? ': ' + reason : ''}`);

    const updatedTask = await this.workflowService.emit({
      urn: task.id,
      event: TaskEvent.CANCEL,
      payload: { reason }
    });

    await this.entityService.save(updatedTask);
    this.logger.log(`Task ${taskId} cancelled`);
    return updatedTask;
  }

  async getTask(taskId: string): Promise<Task | null> {
    return await this.entityService.findById(taskId);
  }

  async getAllTasks(): Promise<Task[]> {
    return await this.entityService.findAll();
  }

  async getTasksByStatus(status: TaskStatus): Promise<Task[]> {
    return await this.entityService.findByStatus(status);
  }
}