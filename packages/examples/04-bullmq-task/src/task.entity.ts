// Task entity demonstrating BullMQ workflow integration

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum TaskEvent {
  START = 'START',
  SUBMIT_FOR_REVIEW = 'SUBMIT_FOR_REVIEW',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  CANCEL = 'CANCEL'
}

export class Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assignee?: string;
  reviewer?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  notes: string[] = [];

  constructor(title: string, description?: string) {
    this.id = `TASK-${Date.now()}`;
    this.title = title;
    this.description = description;
    this.status = TaskStatus.TODO;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.notes = [];
  }

  addNote(note: string) {
    this.notes.push(`[${new Date().toISOString()}] ${note}`);
    this.updatedAt = new Date();
  }

  complete() {
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }
}
