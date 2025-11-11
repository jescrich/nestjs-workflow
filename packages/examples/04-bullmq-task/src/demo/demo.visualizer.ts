import chalk from 'chalk';
import { Task, TaskStatus } from '../task.entity';

export class DemoVisualizer {
  static displayHeader() {
    console.log('\n' + chalk.cyan('═'.repeat(80)));
    console.log(chalk.cyan.bold('  BullMQ Task Workflow Demo'));
    console.log(chalk.cyan('═'.repeat(80)) + '\n');
  }

  static displayTask(task: Task) {
    console.log(chalk.bold('\n📋 Task Details:'));
    console.log(chalk.gray('─'.repeat(80)));
    console.log(`  ${chalk.bold('ID:')}          ${chalk.yellow(task.id)}`);
    console.log(`  ${chalk.bold('Title:')}       ${task.title}`);
    if (task.description) {
      console.log(`  ${chalk.bold('Description:')} ${task.description}`);
    }
    console.log(`  ${chalk.bold('Status:')}      ${this.formatStatus(task.status)}`);
    if (task.assignee) {
      console.log(`  ${chalk.bold('Assignee:')}    ${chalk.cyan(task.assignee)}`);
    }
    if (task.reviewer) {
      console.log(`  ${chalk.bold('Reviewer:')}    ${chalk.cyan(task.reviewer)}`);
    }
    console.log(`  ${chalk.bold('Created:')}     ${task.createdAt.toLocaleString()}`);
    console.log(`  ${chalk.bold('Updated:')}     ${task.updatedAt.toLocaleString()}`);
    if (task.completedAt) {
      console.log(`  ${chalk.bold('Completed:')}   ${task.completedAt.toLocaleString()}`);
    }
    
    if (task.notes.length > 0) {
      console.log(`\n  ${chalk.bold('Notes:')}`);
      task.notes.forEach(note => {
        console.log(`    ${chalk.gray('•')} ${note}`);
      });
    }
    console.log(chalk.gray('─'.repeat(80)));
  }

  static formatStatus(status: TaskStatus): string {
    const statusColors = {
      [TaskStatus.TODO]: chalk.gray,
      [TaskStatus.IN_PROGRESS]: chalk.blue,
      [TaskStatus.IN_REVIEW]: chalk.yellow,
      [TaskStatus.COMPLETED]: chalk.green,
      [TaskStatus.CANCELLED]: chalk.red,
    };
    
    const statusIcons = {
      [TaskStatus.TODO]: '⏸️ ',
      [TaskStatus.IN_PROGRESS]: '🔄',
      [TaskStatus.IN_REVIEW]: '👀',
      [TaskStatus.COMPLETED]: '✅',
      [TaskStatus.CANCELLED]: '❌',
    };

    const color = statusColors[status] || chalk.white;
    const icon = statusIcons[status] || '';
    return `${icon} ${color(status)}`;
  }

  static displayTransition(from: TaskStatus, to: TaskStatus, event: string) {
    console.log(chalk.bold('\n🔄 Workflow Transition:'));
    console.log(chalk.gray('─'.repeat(80)));
    console.log(`  ${this.formatStatus(from)} ${chalk.gray('→')} ${this.formatStatus(to)}`);
    console.log(`  ${chalk.bold('Event:')} ${chalk.magenta(event)}`);
    console.log(chalk.gray('─'.repeat(80)));
  }

  static displayBullMQJob(queueName: string, jobId: string, action: string) {
    console.log(chalk.bold(`\n📦 BullMQ ${action}:`));
    console.log(chalk.gray('─'.repeat(80)));
    console.log(`  ${chalk.bold('Queue:')}  ${chalk.cyan(queueName)}`);
    console.log(`  ${chalk.bold('Job ID:')} ${chalk.yellow(jobId)}`);
    console.log(chalk.gray('─'.repeat(80)));
  }

  static displayHealthCheck(isHealthy: boolean) {
    console.log(chalk.bold('\n🏥 Health Check:'));
    console.log(chalk.gray('─'.repeat(80)));
    if (isHealthy) {
      console.log(`  ${chalk.green('✓')} Redis connection is ${chalk.green.bold('HEALTHY')}`);
    } else {
      console.log(`  ${chalk.red('✗')} Redis connection is ${chalk.red.bold('UNHEALTHY')}`);
    }
    console.log(chalk.gray('─'.repeat(80)));
  }

  static displayError(error: Error) {
    console.log(chalk.bold('\n❌ Error:'));
    console.log(chalk.gray('─'.repeat(80)));
    console.log(chalk.red(`  ${error.message}`));
    if (error.stack) {
      console.log(chalk.gray(`\n  ${error.stack}`));
    }
    console.log(chalk.gray('─'.repeat(80)));
  }

  static displaySuccess(message: string) {
    console.log(chalk.green.bold(`\n✓ ${message}\n`));
  }

  static displayInfo(message: string) {
    console.log(chalk.blue(`ℹ ${message}`));
  }

  static displayWarning(message: string) {
    console.log(chalk.yellow(`⚠ ${message}`));
  }

  static displayWorkflowDiagram() {
    console.log(chalk.bold('\n📊 Workflow State Diagram:'));
    console.log(chalk.gray('─'.repeat(80)));
    console.log(`
    ${chalk.gray('TODO')}
      ${chalk.gray('│')}
      ${chalk.gray('│')} ${chalk.magenta('START')}
      ${chalk.gray('↓')}
    ${chalk.blue('IN_PROGRESS')}
      ${chalk.gray('│')}
      ${chalk.gray('│')} ${chalk.magenta('SUBMIT_FOR_REVIEW')}
      ${chalk.gray('↓')}
    ${chalk.yellow('IN_REVIEW')} ${chalk.gray('─')}${chalk.magenta('REJECT')}${chalk.gray('→ back to IN_PROGRESS')}
      ${chalk.gray('│')}
      ${chalk.gray('│')} ${chalk.magenta('APPROVE')}
      ${chalk.gray('↓')}
    ${chalk.green('COMPLETED')}

    ${chalk.gray('Any state')} ${chalk.gray('─')}${chalk.magenta('CANCEL')}${chalk.gray('→')} ${chalk.red('CANCELLED')}
    `);
    console.log(chalk.gray('─'.repeat(80)));
  }

  static displayRetryInfo(attempt: number, maxAttempts: number) {
    console.log(chalk.bold('\n🔁 Retry Information:'));
    console.log(chalk.gray('─'.repeat(80)));
    console.log(`  ${chalk.bold('Attempt:')}     ${attempt} of ${maxAttempts}`);
    console.log(`  ${chalk.bold('Backoff:')}     Exponential (30s base delay)`);
    console.log(chalk.gray('─'.repeat(80)));
  }

  static displayDLQInfo(queueName: string, jobId: string) {
    console.log(chalk.bold('\n💀 Dead Letter Queue:'));
    console.log(chalk.gray('─'.repeat(80)));
    console.log(`  ${chalk.bold('DLQ Queue:')} ${chalk.red(queueName)}`);
    console.log(`  ${chalk.bold('Job ID:')}    ${chalk.yellow(jobId)}`);
    console.log(`  ${chalk.red('Job has exceeded retry limit and moved to DLQ')}`);
    console.log(chalk.gray('─'.repeat(80)));
  }

  static wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static displaySeparator() {
    console.log('\n' + chalk.gray('═'.repeat(80)) + '\n');
  }
}
