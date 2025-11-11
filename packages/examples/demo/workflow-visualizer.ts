import { WorkflowDefinition } from '@jescrich/nestjs-workflow';
import * as chalk from 'chalk';

export class SimpleWorkflowVisualizer<TEntity, TContext, TEvent, TStatus extends string> {
  protected workflow: WorkflowDefinition<TEntity, TContext, TEvent, TStatus>;

  constructor(workflow: WorkflowDefinition<TEntity, TContext, TEvent, TStatus>) {
    this.workflow = workflow;
  }

  protected getStatusColor(status: TStatus, currentStatus?: TStatus): chalk.Chalk {
    if (currentStatus === status) {
      return chalk.bold.greenBright;
    }
    if (this.workflow.states.finals.includes(status)) {
      return chalk.bold.cyan;
    }
    return chalk.white;
  }

  protected getBoxStyle(status: TStatus, currentStatus?: TStatus): { border: string[], color: chalk.Chalk } {
    const isActive = currentStatus === status;
    const isFinal = this.workflow.states.finals.includes(status);
    
    if (isActive) {
      return {
        border: ['╔', '═', '╗', '║', '║', '╚', '═', '╝'],
        color: chalk.bold.green
      };
    }
    if (isFinal) {
      return {
        border: ['╔', '═', '╗', '║', '║', '╚', '═', '╝'],
        color: chalk.bold.cyan
      };
    }
    return {
      border: ['┌', '─', '┐', '│', '│', '└', '─', '┘'],
      color: chalk.blue
    };
  }

  protected formatStatus(status: TStatus): string {
    const formatted = String(status).replace(/_/g, ' ').toUpperCase();
    const maxLength = 24;
    if (formatted.length > maxLength) {
      // Shorten specific long statuses
      if (formatted === 'IDENTITY VERIFICATION PENDING') return 'ID VERIFY PENDING';
      return formatted.substring(0, maxLength);
    }
    return formatted;
  }

  protected drawBox(status: TStatus, currentStatus?: TStatus): string[] {
    const style = this.getBoxStyle(status, currentStatus);
    const text = this.formatStatus(status);
    const padding = 26 - text.length;
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    
    const [tl, h, tr, vl, vr, bl, b, br] = style.border;
    
    return [
      style.color(tl + h.repeat(26) + tr),
      style.color(vl) + ' '.repeat(leftPad) + this.getStatusColor(status, currentStatus)(text) + ' '.repeat(rightPad) + style.color(vr),
      style.color(bl + b.repeat(26) + br)
    ];
  }

  protected drawArrow(type: 'right' | 'down' | 'diagonal-down-right' | 'diagonal-down-left', label?: string): string[] {
    const arrow = chalk.dim.gray;
    const labelColor = chalk.dim.cyan;
    
    switch(type) {
      case 'right':
        return [
          '',
          arrow('────────>') + (label ? ' ' + labelColor(label) : ''),
          ''
        ];
      case 'down':
        return [
          arrow('    │'),
          arrow('    │') + (label ? ' ' + labelColor(label) : ''),
          arrow('    v')
        ];
      case 'diagonal-down-right':
        return [
          arrow('     \\'),
          arrow('      \\') + (label ? ' ' + labelColor(label) : ''),
          arrow('       >')
        ];
      case 'diagonal-down-left':
        return [
          arrow('    /'),
          arrow('   /') + (label ? ' ' + labelColor(label) : ''),
          arrow('  <')
        ];
      default:
        return ['', '', ''];
    }
  }

  visualize(currentStatus?: TStatus): string {
    // This is a simplified visualization - subclasses can override for custom layouts
    const lines: string[] = [];
    
    // Title
    lines.push(chalk.bold.white('                        WORKFLOW VISUALIZATION'));
    lines.push('═'.repeat(80));
    lines.push('');
    
    // Simple linear layout of states
    // Get all states from transitions
    const statesSet = new Set<TStatus>();
    for (const transition of this.workflow.transitions) {
      const fromStates = Array.isArray(transition.from) ? transition.from : [transition.from];
      fromStates.forEach(s => statesSet.add(s as TStatus));
      statesSet.add(transition.to as TStatus);
    }
    const states = Array.from(statesSet);
    const isFinal = (state: TStatus) => this.workflow.states.finals.includes(state);
    
    // Group states by type
    const regularStates = states.filter(s => !isFinal(s));
    const finalStates = states.filter(s => isFinal(s));
    
    // Display regular states
    if (regularStates.length > 0) {
      lines.push(chalk.dim('Regular States:'));
      for (const state of regularStates) {
        const box = this.drawBox(state, currentStatus);
        box.forEach(line => lines.push('  ' + line));
        lines.push('');
      }
    }
    
    // Display final states
    if (finalStates.length > 0) {
      lines.push(chalk.dim('Final States:'));
      for (const state of finalStates) {
        const box = this.drawBox(state, currentStatus);
        box.forEach(line => lines.push('  ' + line));
        lines.push('');
      }
    }
    
    // Legend
    lines.push('─'.repeat(80));
    lines.push('╔═╗ Current State    ╔═╗ Final State    ┌─┐ Regular State    ──> Transition');
    lines.push('');
    
    return lines.join('\n');
  }
}