# Basic Workflow Example

A simple, educational example demonstrating the fundamental concepts of NestJS Workflow library.

## 🎯 Purpose

This is the **simplest possible example** to understand how NestJS Workflow works. It implements a basic task management system with just 5 states and 5 events.

Perfect for:
- First-time users of the library
- Understanding core workflow concepts
- Learning state transitions
- Quick reference implementation

## 📊 Workflow Overview

### States
- **TODO** - Initial state for new tasks
- **IN_PROGRESS** - Task is being worked on
- **IN_REVIEW** - Task is under review
- **COMPLETED** - Task successfully completed (final)
- **CANCELLED** - Task was cancelled (final)

### Events
- **START** - Begin working on a task
- **SUBMIT_FOR_REVIEW** - Submit completed work for review
- **APPROVE** - Approve and complete the task
- **REJECT** - Send task back to in progress
- **CANCEL** - Cancel the task

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run the interactive demo
npm run demo

# Or start as a server
npm start
```

## 🎮 Interactive Demo

The demo provides a visual, interactive way to understand workflows:

```
═══════════════════════════════════════════════════════════
 ___          _      __      __        _     __ _            
| _ ) __ _ __(_)__  \ \    / /__ _ _ | |__ / _| |_____ __ __
| _ \/ _` (_-< / _|  \ \/\/ / _ \ '_|| / _| _| / _ \ V  V /
|___/\__,_/__/_\__|   \_/\_/\___/_|  |_\___|_| |_\___/\_/\_/ 
═══════════════════════════════════════════════════════════

States and Transitions:

┌──────────────┐
│     TODO     │
└──────────────┘
    │
    │ START (assign task)
    ▼
┌──────────────┐
│ IN_PROGRESS  │
└──────────────┘
    │                    │
    │ SUBMIT_FOR_REVIEW  │ CANCEL
    ▼                    ▼
┌──────────────┐      ╔══════════════╗
│  IN_REVIEW   │      ║  CANCELLED   ║
└──────────────┘      ╚══════════════╝
    │         │
    │ APPROVE │ REJECT
    ▼         │
╔══════════════╗   │
║  COMPLETED   ║   │
╚══════════════╝   │
              │
              └──────────┘
```

## 💻 Code Structure

```
00-basic-example/
├── src/
│   ├── demo/
│   │   ├── demo.ts              # Interactive demo
│   │   └── demo.visualizer.ts   # Workflow visualization
│   ├── task.entity.ts          # Task entity definition
│   ├── task.entity.service.ts  # Entity persistence
│   ├── task.workflow.ts        # Workflow definition
│   ├── task.service.ts         # Business logic
│   ├── task.module.ts          # Module configuration
│   └── app.module.ts           # Application module
└── package.json
```

## 📝 Key Implementation Files

### 1. Entity Definition (`task.entity.ts`)
```typescript
export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export class Task {
  id: string;
  title: string;
  status: TaskStatus;
  assignee?: string;
  // ... other properties
}
```

### 2. Workflow Definition (`task.workflow.ts`)
```typescript
export const taskWorkflowDefinition: WorkflowDefinition = {
  name: 'TaskWorkflow',
  entity: TaskEntityService,
  
  states: {
    finals: [TaskStatus.COMPLETED, TaskStatus.CANCELLED],
    idles: [TaskStatus.TODO, TaskStatus.IN_REVIEW],
    failed: TaskStatus.CANCELLED
  },
  
  transitions: [
    {
      from: TaskStatus.TODO,
      to: TaskStatus.IN_PROGRESS,
      event: TaskEvent.START,
      conditions: [
        (task) => task.assignee !== undefined
      ]
    },
    // ... more transitions
  ]
};
```

### 3. Service Implementation (`task.service.ts`)
```typescript
@Injectable()
export class TaskService {
  constructor(
    @Inject('TaskWorkflow')
    private workflowService: WorkflowService,
    private entityService: TaskEntityService
  ) {}

  async startTask(taskId: string, assignee: string) {
    const task = await this.entityService.findById(taskId);
    task.assignee = assignee;
    
    return await this.workflowService.emit({
      urn: task.id,
      event: TaskEvent.START,
      payload: { assignee }
    });
  }
}
```

## 🎓 Learning Points

1. **States** - Define the possible states of your entity
2. **Events** - Actions that trigger state transitions
3. **Transitions** - Rules for moving between states
4. **Conditions** - Guards that must be true for transitions
5. **Entity Service** - Handles persistence (can be in-memory or database)
6. **Workflow Service** - Manages state transitions and events

## 🔄 Workflow Rules

- Tasks start in `TODO` state
- Can only `START` a task if it has an assignee
- Can only `SUBMIT_FOR_REVIEW` if a reviewer is assigned
- `APPROVE` moves to final state `COMPLETED`
- `REJECT` sends back to `IN_PROGRESS`
- Can `CANCEL` from any non-final state

## 🚦 Try These Scenarios

1. **Happy Path**: Create → Start → Submit → Approve
2. **Review Cycle**: Create → Start → Submit → Reject → Submit → Approve
3. **Cancellation**: Create → Start → Cancel
4. **Direct Cancel**: Create → Cancel

## 🔗 Next Steps

After understanding this basic example:
1. Explore `01-user-onboarding` for multi-step workflows
2. Check `02-order-processing` for complex business logic
3. See `03-kafka-inventory` for event-driven workflows

## 📚 Resources

- [Main Library Documentation](https://github.com/jescrich/nestjs-workflow)
- [Advanced Examples](https://github.com/jescrich/nestjs-workflow/tree/main/examples)
- [API Reference](https://github.com/jescrich/nestjs-workflow#api-reference)