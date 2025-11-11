import * as chalk from "chalk";
import { SimpleWorkflowVisualizer } from "../../../demo/workflow-visualizer";

export class OrderProcessingVisualizer<TEntity, TContext, TEvent, TStatus extends string> extends SimpleWorkflowVisualizer<TEntity, TContext, TEvent, TStatus> {
    visualizeTwoColumn(currentStatus?: TStatus, rightContent?: string[]): string {
      const lines: string[] = [];
      const TOTAL_WIDTH = 120;
      const LEFT_COL_WIDTH = 60;
      const DIVIDER_WIDTH = 3;
      const RIGHT_COL_WIDTH = TOTAL_WIDTH - LEFT_COL_WIDTH - DIVIDER_WIDTH;
      
      // Title
      lines.push(chalk.bold.white(this.padCenter('ORDER PROCESSING WORKFLOW', TOTAL_WIDTH)));
      lines.push(chalk.dim('═'.repeat(TOTAL_WIDTH)));
      lines.push('');
      
      // Generate left column (compact workflow diagram)
      const leftLines = this.generateCompactOrderDiagram(currentStatus);
      
      // Generate right column (info and actions)
      const rightLines = rightContent || [];
      
      // Combine columns
      const maxLines = Math.max(leftLines.length, rightLines.length);
      
      for (let i = 0; i < maxLines; i++) {
        const leftLine = i < leftLines.length ? leftLines[i] : '';
        const rightLine = i < rightLines.length ? rightLines[i] : '';
        
        // Ensure left line doesn't exceed width
        const truncatedLeft = this.truncateString(leftLine, LEFT_COL_WIDTH);
        const paddedLeft = truncatedLeft + ' '.repeat(LEFT_COL_WIDTH - this.stripAnsi(truncatedLeft).length);
        
        // Add divider
        const divider = chalk.dim(' │ ');
        
        // Combine
        lines.push(paddedLeft + divider + rightLine);
      }
      
      return lines.join('\n');
    }
    
    private stripAnsi(str: string): string {
      return str.replace(/\u001b\[[0-9;]*m/g, '');
    }
    
    private truncateString(str: string, maxLength: number): string {
      const stripped = this.stripAnsi(str);
      if (stripped.length <= maxLength) return str;
      return str.substring(0, maxLength - 3) + '...';
    }
    
    private padCenter(str: string, width: number): string {
      const padding = width - str.length;
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
    }
    
    private generateCompactOrderDiagram(currentStatus?: TStatus): string[] {
      const lines: string[] = [];
      const BOX_WIDTH = 26;
      
      // Helper to create compact box
      const createCompactBox = (name: string, status: TStatus, style: 'normal' | 'final' | 'error' = 'normal'): string[] => {
        const isActive = currentStatus === status;
        
        let borderChar = style === 'final' ? '═' : '─';
        let cornerTL = style === 'final' ? '╔' : '┌';
        let cornerTR = style === 'final' ? '╗' : '┐';
        let cornerBL = style === 'final' ? '╚' : '└';
        let cornerBR = style === 'final' ? '╝' : '┘';
        let sideChar = style === 'final' ? '║' : '│';
        
        let borderColor = chalk.blue;
        let textColor = chalk.white;
        
        if (isActive) {
          borderColor = chalk.bold.green;
          textColor = chalk.bold.greenBright;
        } else if (style === 'final') {
          borderColor = chalk.bold.cyan;
          textColor = chalk.bold.cyan;
        } else if (style === 'error') {
          borderColor = chalk.red;
          textColor = chalk.red;
        }
        
        const displayName = name.replace(/_/g, ' ');
        const paddedName = this.padCenter(displayName, BOX_WIDTH - 2);
        
        return [
          borderColor(cornerTL + borderChar.repeat(BOX_WIDTH - 2) + cornerTR),
          borderColor(sideChar) + textColor(paddedName) + borderColor(sideChar),
          borderColor(cornerBL + borderChar.repeat(BOX_WIDTH - 2) + cornerBR)
        ];
      };
      
      // Main flow
      lines.push(chalk.bold('MAIN ORDER FLOW:'));
      lines.push('');
      
      // Created
      const created = createCompactBox('CREATED', 'created' as TStatus);
      created.forEach(line => lines.push('  ' + line));
      lines.push('          ' + chalk.dim('│'));
      lines.push('    ' + chalk.yellow('→ INITIATE PAYMENT'));
      lines.push('          ' + chalk.dim('▼'));
      
      // Payment flow split
      lines.push('  ┌──────────────────────────┐');
      lines.push('  │   ' + chalk.white('PAYMENT PENDING') + '      │');
      lines.push('  └──────────────────────────┘');
      lines.push('       ' + chalk.dim('│              │'));
      lines.push('   ' + chalk.green('SUCCESS') + '      ' + chalk.red('FAILED'));
      lines.push('       ' + chalk.dim('▼              ▼'));
      
      // Paid state
      const paid = createCompactBox('PAID', 'paid' as TStatus);
      paid.forEach(line => lines.push('  ' + line));
      lines.push('          ' + chalk.dim('│'));
      lines.push('    ' + chalk.yellow('→ AUTO PROCESS'));
      lines.push('          ' + chalk.dim('▼'));
      
      // Processing
      const processing = createCompactBox('PROCESSING', 'processing' as TStatus);
      processing.forEach(line => lines.push('  ' + line));
      lines.push('          ' + chalk.dim('│'));
      lines.push('          ' + chalk.dim('▼'));
      
      // Ready to ship
      const readyToShip = createCompactBox('READY TO SHIP', 'ready_to_ship' as TStatus);
      readyToShip.forEach(line => lines.push('  ' + line));
      lines.push('          ' + chalk.dim('│'));
      lines.push('       ' + chalk.yellow('→ SHIP'));
      lines.push('          ' + chalk.dim('▼'));
      
      // Shipped
      const shipped = createCompactBox('SHIPPED', 'shipped' as TStatus);
      shipped.forEach(line => lines.push('  ' + line));
      lines.push('          ' + chalk.dim('│'));
      lines.push('   ' + chalk.yellow('→ OUT FOR DELIVERY'));
      lines.push('          ' + chalk.dim('▼'));
      
      // Out for Delivery
      lines.push('  ┌──────────────────────────┐');
      lines.push('  │  ' + chalk.white('OUT FOR DELIVERY') + '       │');
      lines.push('  └──────────────────────────┘');
      lines.push('          ' + chalk.dim('│'));
      lines.push('      ' + chalk.yellow('→ DELIVER'));
      lines.push('          ' + chalk.dim('▼'));
      
      // Delivered (Final)
      const delivered = createCompactBox('DELIVERED', 'delivered' as TStatus, 'final');
      delivered.forEach(line => lines.push('  ' + line));
      
      lines.push('');
      lines.push(chalk.bold('ALTERNATIVE STATES:'));
      lines.push('');
      
      // Alternative states in columns
      lines.push('  ' + chalk.red('✗ CANCELLED') + '    ' + chalk.yellow('↺ REFUNDED') + '    ' + chalk.blue('↩ RETURNED'));
      lines.push('  ' + chalk.dim('(Can cancel)') + '   ' + chalk.dim('(Money back)') + '  ' + chalk.dim('(Item back)'));
      lines.push('');
      lines.push('  ' + chalk.red('⚠ PAYMENT FAILED'));
      lines.push('  ' + chalk.dim('(Retry or cancel)'));
      
      return lines;
    }
    
    public printTransitionTable(): string {
      const lines: string[] = [];
      lines.push('');
      lines.push(chalk.bold.white('ORDER STATE TRANSITION TABLE'));
      lines.push(chalk.dim('═'.repeat(85)));
      lines.push(
        chalk.bold.cyan('From State'.padEnd(28)) + 
        chalk.dim('│') + ' ' +
        chalk.bold.yellow('Event'.padEnd(28)) + 
        chalk.dim('│') + ' ' +
        chalk.bold.green('To State')
      );
      lines.push(chalk.dim('─'.repeat(85)));
      
      // Group transitions by from state
      const transitionMap = new Map<string, Array<{event: string, to: string}>>();
      
      for (const transition of this.workflow.transitions) {
        const fromStates = Array.isArray(transition.from) ? transition.from : [transition.from];
        const events = Array.isArray(transition.event) ? transition.event : [transition.event];
        
        for (const from of fromStates) {
          const key = String(from);
          if (!transitionMap.has(key)) {
            transitionMap.set(key, []);
          }
          
          for (const event of events) {
            transitionMap.get(key)!.push({
              event: String(event),
              to: String(transition.to)
            });
          }
        }
      }
      
      // Display grouped transitions
      for (const [from, transitions] of transitionMap) {
        const fromFormatted = this.formatStatus(from as TStatus);
        let first = true;
        
        for (const {event, to} of transitions) {
          const eventName = event.split('.').slice(1).join(' ').toUpperCase();
          const toFormatted = this.formatStatus(to as TStatus);
          
          if (first) {
            lines.push(
              chalk.white(fromFormatted.padEnd(28)) + 
              chalk.dim('│') + ' ' +
              chalk.yellow(eventName.padEnd(28)) + 
              chalk.dim('│') + ' ' +
              chalk.green(toFormatted)
            );
            first = false;
          } else {
            lines.push(
              ' '.repeat(28) + 
              chalk.dim('│') + ' ' +
              chalk.yellow(eventName.padEnd(28)) + 
              chalk.dim('│') + ' ' +
              chalk.green(toFormatted)
            );
          }
        }
        
        if (transitions.length > 1) {
          lines.push(chalk.dim('─'.repeat(85)));
        }
      }
      
      lines.push(chalk.dim('═'.repeat(85)));
      lines.push('');
      
      return lines.join('\n');
    }
    
    public visualizeCompact(currentStatus?: TStatus): string {
      const lines: string[] = [];
      
      lines.push(chalk.bold.white('ORDER PROCESSING WORKFLOW - COMPACT VIEW'));
      lines.push(chalk.dim('═'.repeat(80)));
      lines.push('');
      
      // Define the main workflow path
      const mainPath = [
        { status: 'CREATED', event: 'INITIATE_PAYMENT' },
        { status: 'PAYMENT_PENDING', event: 'PAYMENT_SUCCESS' },
        { status: 'PAID', event: 'START_PROCESSING' },
        { status: 'PROCESSING', event: 'COMPLETE_PROCESSING' },
        { status: 'READY_TO_SHIP', event: 'SHIP' },
        { status: 'SHIPPED', event: 'OUT_FOR_DELIVERY' },
        { status: 'OUT_FOR_DELIVERY', event: 'DELIVER' },
        { status: 'DELIVERED', event: null }
      ];
      
      // Main flow
      lines.push(chalk.bold('Main Flow:'));
      lines.push('');
      
      for (let i = 0; i < mainPath.length; i++) {
        const {status, event} = mainPath[i];
        const isActive = currentStatus === status.toLowerCase().replace(/ /g, '_');
        const isFinal = status === 'DELIVERED';
        
        let statusDisplay = status.replace(/_/g, ' ');
        if (isActive) {
          statusDisplay = chalk.bold.greenBright('▶ ' + statusDisplay);
        } else if (isFinal) {
          statusDisplay = chalk.bold.cyan('◆ ' + statusDisplay);
        } else {
          statusDisplay = chalk.white('○ ' + statusDisplay);
        }
        
        lines.push('  ' + statusDisplay);
        
        if (event) {
          lines.push('    ' + chalk.dim('│'));
          lines.push('    ' + chalk.yellow('↓ ' + event.replace(/_/g, ' ')));
        }
      }
      
      lines.push('');
      lines.push(chalk.bold('Alternative Paths:'));
      lines.push('');
      lines.push('  ' + chalk.red('✗ CANCELLED') + chalk.dim(' ← Can cancel before shipping'));
      lines.push('  ' + chalk.red('⚠ PAYMENT_FAILED') + chalk.dim(' ← Payment declined/failed'));
      lines.push('  ' + chalk.yellow('↺ REFUNDED') + chalk.dim(' ← Money returned to customer'));
      lines.push('  ' + chalk.blue('↩ RETURNED') + chalk.dim(' ← Item returned after delivery'));
      lines.push('');
      
      return lines.join('\n');
    }
}