import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TaskService } from '../task.service';
import { Task, TaskStatus, TaskEvent } from '../task.entity';
import { TaskWorkflowVisualizer } from './demo.visualizer';
import chalk from 'chalk';
import inquirer from 'inquirer';
import clear from 'clear';
import figlet from 'figlet';

class BasicWorkflowDemo {
  private taskService: TaskService;
  private visualizer: TaskWorkflowVisualizer;
  private currentTask: Task | null = null;

  constructor(taskService: TaskService) {
    this.taskService = taskService;
    this.visualizer = new TaskWorkflowVisualizer();
  }

  private printHeader() {
    console.log(chalk.cyan('═'.repeat(60)));
    console.log(chalk.cyan.bold(figlet.textSync('Basic Workflow', { font: 'Small' })));
    console.log(chalk.cyan('═'.repeat(60)));
    console.log();
    console.log(chalk.yellow('This is a simple task management workflow example.'));
    console.log(chalk.yellow('Learn the basics of NestJS Workflow with this demo!'));
    console.log();
  }

  private async displayCurrentTask() {
    if (!this.currentTask) {
      console.log(chalk.gray('No task selected. Create a new task to begin.'));
      return;
    }

    console.log(chalk.cyan('CURRENT TASK:'));
    console.log('─'.repeat(60));
    console.log(`ID: ${chalk.white(this.currentTask.id)}`);
    console.log(`Title: ${chalk.white(this.currentTask.title)}`);
    if (this.currentTask.description) {
      console.log(`Description: ${chalk.white(this.currentTask.description)}`);
    }
    console.log(`Status: ${this.getStatusColor(this.currentTask.status)(this.currentTask.status)}`);
    if (this.currentTask.assignee) {
      console.log(`Assignee: ${chalk.white(this.currentTask.assignee)}`);
    }
    if (this.currentTask.reviewer) {
      console.log(`Reviewer: ${chalk.white(this.currentTask.reviewer)}`);
    }
    
    if (this.currentTask.notes.length > 0) {
      console.log('\nHistory:');
      this.currentTask.notes.slice(-3).forEach(note => {
        console.log(chalk.gray(`  • ${note}`));
      });
    }
    console.log();
  }

  private getStatusColor(status: TaskStatus): (text: string) => string {
    const colors = {
      [TaskStatus.TODO]: chalk.gray,
      [TaskStatus.IN_PROGRESS]: chalk.yellow,
      [TaskStatus.IN_REVIEW]: chalk.cyan,
      [TaskStatus.COMPLETED]: chalk.green,
      [TaskStatus.CANCELLED]: chalk.red
    };
    return colors[status] || chalk.white;
  }

  private async getAvailableActions(): Promise<string[]> {
    if (!this.currentTask) return ['create'];

    const actions: string[] = [];
    const status = this.currentTask.status;

    switch (status) {
      case TaskStatus.TODO:
        actions.push('start');
        actions.push('cancel');
        break;
      case TaskStatus.IN_PROGRESS:
        actions.push('submit');
        actions.push('cancel');
        break;
      case TaskStatus.IN_REVIEW:
        actions.push('approve');
        actions.push('reject');
        actions.push('cancel');
        break;
      case TaskStatus.COMPLETED:
      case TaskStatus.CANCELLED:
        // No actions available for final states
        break;
    }

    actions.push('create'); // Always allow creating a new task
    return actions;
  }

  async showMenu(): Promise<boolean> {
    const availableActions = await this.getAvailableActions();
    
    console.log();
    console.log(chalk.cyan('ACTIONS:'));
    console.log('─'.repeat(60));

    const choices = [];
    
    if (availableActions.includes('create')) {
      choices.push({ name: '1. 📝 Create New Task', value: 'create' });
    }
    if (availableActions.includes('start')) {
      choices.push({ name: '2. ▶️  Start Task', value: 'start' });
    }
    if (availableActions.includes('submit')) {
      choices.push({ name: '3. 📤 Submit for Review', value: 'submit' });
    }
    if (availableActions.includes('approve')) {
      choices.push({ name: '4. ✅ Approve Task', value: 'approve' });
    }
    if (availableActions.includes('reject')) {
      choices.push({ name: '5. ❌ Reject Task', value: 'reject' });
    }
    if (availableActions.includes('cancel')) {
      choices.push({ name: '6. 🚫 Cancel Task', value: 'cancel' });
    }
    
    choices.push(
      { name: '─────────────────', value: null, disabled: true },
      { name: '7. 📊 Show Workflow Diagram', value: 'diagram' },
      { name: '8. 📋 List All Tasks', value: 'list' },
      { name: '9. 🎬 Run Demo Scenario', value: 'demo' },
      { name: '─────────────────', value: null, disabled: true },
      { name: '0. Exit', value: 'exit' }
    );

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Select action:',
        choices
      }
    ]);

    switch (action) {
      case 'create':
        await this.createTask();
        break;
      case 'start':
        await this.startTask();
        break;
      case 'submit':
        await this.submitForReview();
        break;
      case 'approve':
        await this.approveTask();
        break;
      case 'reject':
        await this.rejectTask();
        break;
      case 'cancel':
        await this.cancelTask();
        break;
      case 'diagram':
        await this.showDiagram();
        break;
      case 'list':
        await this.listAllTasks();
        break;
      case 'demo':
        await this.runDemoScenario();
        break;
      case 'exit':
        return false;
    }

    return true;
  }

  private async createTask() {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'title',
        message: 'Task title:',
        default: 'Implement new feature'
      },
      {
        type: 'input',
        name: 'description',
        message: 'Task description (optional):',
        default: ''
      }
    ]);

    this.currentTask = await this.taskService.createTask(
      answers.title,
      answers.description || undefined
    );

    console.log(chalk.green(`✓ Task created: ${this.currentTask.id}`));
  }

  private async startTask() {
    if (!this.currentTask) return;

    const { assignee } = await inquirer.prompt([
      {
        type: 'input',
        name: 'assignee',
        message: 'Assign to:',
        default: 'John Doe'
      }
    ]);

    try {
      this.currentTask = await this.taskService.startTask(this.currentTask.id, assignee);
      console.log(chalk.green(`✓ Task started and assigned to ${assignee}`));
    } catch (error: any) {
      console.log(chalk.red(`✗ Error: ${error.message}`));
    }
  }

  private async submitForReview() {
    if (!this.currentTask) return;

    const { reviewer } = await inquirer.prompt([
      {
        type: 'input',
        name: 'reviewer',
        message: 'Submit to reviewer:',
        default: 'Jane Smith'
      }
    ]);

    try {
      this.currentTask = await this.taskService.submitForReview(this.currentTask.id, reviewer);
      console.log(chalk.green(`✓ Task submitted for review to ${reviewer}`));
    } catch (error: any) {
      console.log(chalk.red(`✗ Error: ${error.message}`));
    }
  }

  private async approveTask() {
    if (!this.currentTask) return;

    const { approvedBy } = await inquirer.prompt([
      {
        type: 'input',
        name: 'approvedBy',
        message: 'Approved by:',
        default: this.currentTask.reviewer || 'Manager'
      }
    ]);

    try {
      this.currentTask = await this.taskService.approveTask(this.currentTask.id, approvedBy);
      console.log(chalk.green(`✓ Task approved and completed!`));
    } catch (error: any) {
      console.log(chalk.red(`✗ Error: ${error.message}`));
    }
  }

  private async rejectTask() {
    if (!this.currentTask) return;

    const { reason } = await inquirer.prompt([
      {
        type: 'input',
        name: 'reason',
        message: 'Rejection reason:',
        default: 'Needs more work'
      }
    ]);

    try {
      this.currentTask = await this.taskService.rejectTask(this.currentTask.id, reason);
      console.log(chalk.orange(`✓ Task rejected and sent back to in progress`));
    } catch (error: any) {
      console.log(chalk.red(`✗ Error: ${error.message}`));
    }
  }

  private async cancelTask() {
    if (!this.currentTask) return;

    const { reason } = await inquirer.prompt([
      {
        type: 'input',
        name: 'reason',
        message: 'Cancellation reason (optional):',
        default: ''
      }
    ]);

    try {
      this.currentTask = await this.taskService.cancelTask(
        this.currentTask.id,
        reason || undefined
      );
      console.log(chalk.red(`✓ Task cancelled`));
    } catch (error: any) {
      console.log(chalk.red(`✗ Error: ${error.message}`));
    }
  }

  private async showDiagram() {
    clear();
    this.printHeader();
    console.log(this.visualizer.render(this.currentTask?.status || null));
    
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: 'Press Enter to continue...'
      }
    ]);
  }

  private async listAllTasks() {
    const tasks = await this.taskService.getAllTasks();
    
    if (tasks.length === 0) {
      console.log(chalk.gray('No tasks found.'));
      return;
    }

    console.log(chalk.cyan('\nALL TASKS:'));
    console.log('─'.repeat(60));
    
    for (const task of tasks) {
      const statusColor = this.getStatusColor(task.status);
      console.log(`${task.id}: ${task.title} - ${statusColor(task.status)}`);
    }

    if (tasks.length > 0) {
      const { selectedId } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedId',
          message: 'Select a task to work with:',
          choices: [
            ...tasks.map(t => ({
              name: `${t.id}: ${t.title}`,
              value: t.id
            })),
            { name: 'None', value: null }
          ]
        }
      ]);

      if (selectedId) {
        this.currentTask = await this.taskService.getTask(selectedId);
      }
    }
  }

  private async runDemoScenario() {
    console.log(chalk.cyan('\n🎬 Running Demo Scenario...'));
    console.log(chalk.gray('This will demonstrate a complete task lifecycle.'));
    
    // Create task
    console.log(chalk.yellow('\n1. Creating task...'));
    const task = await this.taskService.createTask(
      'Demo Task',
      'This is a demonstration task'
    );
    this.currentTask = task;
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Start task
    console.log(chalk.yellow('\n2. Starting task...'));
    this.currentTask = await this.taskService.startTask(task.id, 'Demo User');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Submit for review
    console.log(chalk.yellow('\n3. Submitting for review...'));
    this.currentTask = await this.taskService.submitForReview(task.id, 'Demo Reviewer');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Approve task
    console.log(chalk.yellow('\n4. Approving task...'));
    this.currentTask = await this.taskService.approveTask(task.id, 'Demo Reviewer');
    
    console.log(chalk.green('\n✓ Demo completed! Task went through entire workflow.'));
    console.log(chalk.cyan(`Final status: ${this.currentTask.status}`));
  }

  async run() {
    clear();
    this.printHeader();

    let continueRunning = true;
    while (continueRunning) {
      clear();
      this.printHeader();
      console.log(this.visualizer.render(this.currentTask?.status || null));
      console.log();
      await this.displayCurrentTask();
      continueRunning = await this.showMenu();
    }

    console.log(chalk.cyan('\nThank you for using Basic Workflow Demo! 👋'));
    console.log(chalk.gray('Learn more at: https://github.com/jescrich/nestjs-workflow'));
  }
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false
  });

  const taskService = app.get(TaskService);
  const demo = new BasicWorkflowDemo(taskService);

  try {
    await demo.run();
  } finally {
    await app.close();
    process.exit(0);
  }
}

bootstrap().catch(error => {
  console.error(chalk.red('Error running demo:'), error);
  process.exit(1);
});