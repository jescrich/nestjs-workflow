import chalk from 'chalk';
import { TaskStatus } from '../task.entity';

export class TaskWorkflowVisualizer {
  render(currentStatus: TaskStatus | null): string {
    const lines: string[] = [];
    
    lines.push(chalk.cyan('═'.repeat(60)));
    lines.push(chalk.cyan.bold('          TASK WORKFLOW VISUALIZATION'));
    lines.push(chalk.cyan('═'.repeat(60)));
    lines.push('');
    lines.push('States and Transitions:');
    lines.push('');
    
    // TODO state
    lines.push(this.renderState('TODO', currentStatus === TaskStatus.TODO));
    lines.push('    │');
    lines.push('    │ ' + chalk.yellow('START') + ' (assign task)');
    lines.push('    ▼');
    
    // IN_PROGRESS state
    lines.push(this.renderState('IN_PROGRESS', currentStatus === TaskStatus.IN_PROGRESS));
    lines.push('    │                    │');
    lines.push('    │ ' + chalk.yellow('SUBMIT_FOR_REVIEW') + '  │ ' + chalk.red('CANCEL'));
    lines.push('    ▼                    ▼');
    
    // IN_REVIEW state
    lines.push(this.renderState('IN_REVIEW', currentStatus === TaskStatus.IN_REVIEW) + '      ' + this.renderState('CANCELLED', currentStatus === TaskStatus.CANCELLED, true));
    lines.push('    │         │');
    lines.push('    │ ' + chalk.green('APPROVE') + ' │ ' + chalk.orange('REJECT'));
    lines.push('    ▼         │');
    
    // COMPLETED state
    lines.push(this.renderState('COMPLETED', currentStatus === TaskStatus.COMPLETED, true) + '   │');
    lines.push('              │');
    lines.push('              └──────────┘');
    lines.push('');
    lines.push('─'.repeat(60));
    lines.push('');
    lines.push('Legend:');
    lines.push('  ' + chalk.green('╔═╗') + ' Final states');
    lines.push('  ' + chalk.yellow('┌─┐') + ' Active state');
    lines.push('  ' + chalk.blue('┌─┐') + ' Other states');
    lines.push('');
    
    return lines.join('\n');
  }
  
  private renderState(name: string, isActive: boolean, isFinal: boolean = false): string {
    const width = 14;
    const padding = Math.max(0, width - name.length);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    
    const paddedName = ' '.repeat(leftPad) + name + ' '.repeat(rightPad);
    
    if (isActive) {
      return chalk.yellow(`┌${'─'.repeat(width)}┐\n│${paddedName}│\n└${'─'.repeat(width)}┘`);
    } else if (isFinal) {
      return chalk.green(`╔${'═'.repeat(width)}╗\n║${paddedName}║\n╚${'═'.repeat(width)}╝`);
    } else {
      return chalk.blue(`┌${'─'.repeat(width)}┐\n│${paddedName}│\n└${'─'.repeat(width)}┘`);
    }
  }
}