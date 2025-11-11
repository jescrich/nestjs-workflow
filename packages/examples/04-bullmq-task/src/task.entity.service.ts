import { Injectable } from '@nestjs/common';
import { Task } from './task.entity';

@Injectable()
export class TaskEntityService {
  private tasks: Map<string, Task> = new Map();

  async new(): Promise<Task> {
    return new Task('New Task');
  }

  async findById(id: string): Promise<Task | null> {
    return this.tasks.get(id) || null;
  }

  async save(task: Task): Promise<Task> {
    this.tasks.set(task.id, task);
    return task;
  }

  async findAll(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  async findByStatus(status: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(t => t.status === status);
  }

  async clearAll(): Promise<void> {
    this.tasks.clear();
  }
}
