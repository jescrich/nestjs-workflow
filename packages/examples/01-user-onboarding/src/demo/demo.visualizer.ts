import * as chalk from "chalk";
import { SimpleWorkflowVisualizer } from "../../../demo/workflow-visualizer";

// Specialized visualizer for user onboarding workflow
export class UserOnboardingVisualizer<TEntity, TContext, TEvent, TStatus extends string> extends SimpleWorkflowVisualizer<TEntity, TContext, TEvent, TStatus> {
    visualizeTwoColumn(currentStatus?: TStatus, rightContent?: string[]): string {
      const lines: string[] = [];
      const TOTAL_WIDTH = 120;
      const LEFT_COL_WIDTH = 55;
      const DIVIDER_WIDTH = 3;
      const RIGHT_COL_WIDTH = TOTAL_WIDTH - LEFT_COL_WIDTH - DIVIDER_WIDTH;
      
      // Title
      lines.push(chalk.bold.white(this.padCenter('USER ONBOARDING WORKFLOW', TOTAL_WIDTH)));
      lines.push(chalk.dim('═'.repeat(TOTAL_WIDTH)));
      lines.push('');
      
      // Generate left column (compact vertical diagram)
      const leftLines = this.generateCompactDiagram(currentStatus);
      
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
      // Remove ANSI escape codes for accurate length calculation
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
    
    private generateCompactDiagram(currentStatus?: TStatus): string[] {
      const lines: string[] = [];
      const BOX_WIDTH = 24;
      
      // Helper to create compact box
      const createCompactBox = (name: string, status: TStatus, isFinal: boolean = false): string[] => {
        const isActive = currentStatus === status;
        
        let borderChar = isFinal ? '═' : '─';
        let cornerTL = isFinal ? '╔' : '┌';
        let cornerTR = isFinal ? '╗' : '┐';
        let cornerBL = isFinal ? '╚' : '└';
        let cornerBR = isFinal ? '╝' : '┘';
        let sideChar = isFinal ? '║' : '│';
        
        let borderColor = chalk.blue;
        let textColor = chalk.white;
        
        if (isActive) {
          borderColor = chalk.bold.green;
          textColor = chalk.bold.greenBright;
        } else if (isFinal) {
          borderColor = chalk.bold.cyan;
          textColor = chalk.bold.cyan;
        }
        
        const displayName = name.replace(/_/g, ' ');
        const paddedName = this.padCenter(displayName, BOX_WIDTH - 2);
        
        return [
          borderColor(cornerTL + borderChar.repeat(BOX_WIDTH - 2) + cornerTR),
          borderColor(sideChar) + textColor(paddedName) + borderColor(sideChar),
          borderColor(cornerBL + borderChar.repeat(BOX_WIDTH - 2) + cornerBR)
        ];
      };
      
      // Main flow (vertical)
      lines.push(chalk.bold('MAIN FLOW:'));
      lines.push('');
      
      // Registered
      const registered = createCompactBox('REGISTERED', 'registered' as TStatus, false);
      registered.forEach(line => lines.push('  ' + line));
      lines.push('          ' + chalk.dim('│'));
      lines.push('    ' + chalk.yellow('→ VERIFY EMAIL'));
      lines.push('          ' + chalk.dim('▼'));
      
      // Email Verified
      const emailVerified = createCompactBox('EMAIL VERIFIED', 'email_verified' as TStatus, false);
      emailVerified.forEach(line => lines.push('  ' + line));
      lines.push('          ' + chalk.dim('│'));
      lines.push('   ' + chalk.yellow('→ UPDATE PROFILE'));
      lines.push('          ' + chalk.dim('▼'));
      
      // Profile Complete
      const profileComplete = createCompactBox('PROFILE COMPLETE', 'profile_complete' as TStatus, false);
      profileComplete.forEach(line => lines.push('  ' + line));
      lines.push('          ' + chalk.dim('│'));
      lines.push('   ' + chalk.yellow('→ START ID VERIFY'));
      lines.push('          ' + chalk.dim('▼'));
      
      // ID Verification Pending
      const idPending = createCompactBox('ID VERIFY PENDING', 'identity_verification_pending' as TStatus, false);
      idPending.forEach(line => lines.push('  ' + line));
      lines.push('          ' + chalk.dim('│'));
      lines.push('  ' + chalk.yellow('→ COMPLETE VERIFY'));
      lines.push('          ' + chalk.dim('▼'));
      
      // Identity Verified
      const idVerified = createCompactBox('IDENTITY VERIFIED', 'identity_verified' as TStatus, false);
      idVerified.forEach(line => lines.push('  ' + line));
      lines.push('          ' + chalk.dim('│'));
      lines.push('     ' + chalk.yellow('→ ACTIVATE'));
      lines.push('          ' + chalk.dim('▼'));
      
      // Active (Final)
      const active = createCompactBox('ACTIVE', 'active' as TStatus, true);
      active.forEach(line => lines.push('  ' + line));
      
      lines.push('');
      lines.push(chalk.bold('ALTERNATIVE PATHS:'));
      lines.push('');
      
      // Alternative states side by side
      lines.push('  ' + chalk.red('✗ SUSPENDED') + '     ' + chalk.gray('○ INACTIVE'));
      lines.push('  ' + chalk.dim('(High risk)') + '      ' + chalk.dim('(Abandoned)'));
      lines.push('');
      lines.push('  ' + chalk.blue('↺ PROFILE INCOMPLETE'));
      lines.push('  ' + chalk.dim('(Partial updates loop)'));
      
      return lines;
    }
    
    visualize(currentStatus?: TStatus): string {
      const lines: string[] = [];
      
      // Title
      lines.push(chalk.bold.white('                        USER ONBOARDING WORKFLOW'));
      lines.push(chalk.dim('═'.repeat(90)));
      lines.push('');
      
      // Constants for layout
      const BOX_WIDTH = 28;
      const COL_SPACING = 4;
      const LEFT_MARGIN = 2;
      
      // Helper to pad strings to fixed width
      const padCenter = (str: string, width: number): string => {
        const padding = width - str.length;
        const leftPad = Math.floor(padding / 2);
        const rightPad = padding - leftPad;
        return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
      };
      
      // Helper to create a state box with consistent width
      const createBox = (name: string, status: TStatus, isFinal: boolean = false): string[] => {
        const isActive = currentStatus === status;
        
        let borderChar = isFinal ? '═' : '─';
        let cornerTL = isFinal ? '╔' : '┌';
        let cornerTR = isFinal ? '╗' : '┐';
        let cornerBL = isFinal ? '╚' : '└';
        let cornerBR = isFinal ? '╝' : '┘';
        let sideChar = isFinal ? '║' : '│';
        
        let borderColor = chalk.blue;
        let textColor = chalk.white;
        
        if (isActive) {
          borderColor = chalk.bold.green;
          textColor = chalk.bold.greenBright;
        } else if (isFinal) {
          borderColor = chalk.bold.cyan;
          textColor = chalk.bold.cyan;
        }
        
        const displayName = name.replace(/_/g, ' ');
        const paddedName = padCenter(displayName, BOX_WIDTH - 2);
        
        return [
          borderColor(cornerTL + borderChar.repeat(BOX_WIDTH - 2) + cornerTR),
          borderColor(sideChar) + textColor(paddedName) + borderColor(sideChar),
          borderColor(cornerBL + borderChar.repeat(BOX_WIDTH - 2) + cornerBR)
        ];
      };
      
      // Format event name helper
      const formatEvent = (event: string): string => {
        return chalk.bold.yellow('→ ' + event.replace(/_/g, ' '));
      };
      
      // Helper to align columns
      const alignColumns = (col1: string[], col2: string[], col3: string[]): void => {
        for (let i = 0; i < 3; i++) {
          lines.push(
            ' '.repeat(LEFT_MARGIN) + 
            col1[i] + 
            ' '.repeat(COL_SPACING) + 
            col2[i] + 
            ' '.repeat(COL_SPACING) + 
            col3[i]
          );
        }
      };
      
      // Row 1: Initial states
      const registered = createBox('REGISTERED', 'registered' as TStatus, false);
      const emailVerified = createBox('EMAIL VERIFIED', 'email_verified' as TStatus, false);
      const profileIncomplete = createBox('PROFILE INCOMPLETE', 'profile_incomplete' as TStatus, false);
      
      alignColumns(registered, emailVerified, profileIncomplete);
      
      
      // Transition arrows and events between rows 1 and 2
      lines.push('');
      const arrow = chalk.dim('────────►');
      const downArrow = chalk.dim('│');
      const spacing = ' '.repeat(BOX_WIDTH + COL_SPACING);
      
      // Arrows between first row states
      lines.push(' '.repeat(LEFT_MARGIN + 14) + arrow + ' '.repeat(10) + arrow);
      lines.push(' '.repeat(LEFT_MARGIN + 8) + formatEvent('VERIFY EMAIL') + ' '.repeat(8) + formatEvent('UPDATE PROFILE'));
      lines.push(' '.repeat(LEFT_MARGIN + 14) + downArrow + ' '.repeat(18) + downArrow + ' ' + formatEvent('COMPLETE'));
      lines.push(' '.repeat(LEFT_MARGIN + 14) + downArrow + ' '.repeat(18) + chalk.dim('▼') + ' '.repeat(20) + downArrow + ' ' + chalk.yellow('↺ UPDATE'));
      lines.push(' '.repeat(LEFT_MARGIN + 14) + downArrow + ' '.repeat(40) + chalk.dim('▼'));
      lines.push('');
      
      // Row 2: Middle states
      const profileComplete = createBox('PROFILE COMPLETE', 'profile_complete' as TStatus, false);
      const idVerifyPending = createBox('ID VERIFY PENDING', 'identity_verification_pending' as TStatus, false);
      const identityVerified = createBox('IDENTITY VERIFIED', 'identity_verified' as TStatus, false);
      
      alignColumns(profileComplete, idVerifyPending, identityVerified);
      
      // Transition arrows and events between rows 2 and 3
      lines.push('');
      lines.push(' '.repeat(LEFT_MARGIN + 14) + arrow + ' '.repeat(10) + arrow);
      lines.push(' '.repeat(LEFT_MARGIN + 6) + formatEvent('START ID VERIFY') + ' '.repeat(4) + formatEvent('COMPLETE VERIFY'));
      lines.push(' '.repeat(LEFT_MARGIN + 14) + downArrow + ' '.repeat(18) + downArrow + ' ' + formatEvent('FAIL'));
      lines.push(' '.repeat(LEFT_MARGIN + 14) + downArrow + ' ' + formatEvent('MARK') + ' '.repeat(8) + chalk.dim('▼') + ' '.repeat(20) + downArrow);
      lines.push(' '.repeat(LEFT_MARGIN + 14) + downArrow + ' ' + formatEvent('INACTIVE') + ' '.repeat(32) + chalk.dim('▼'));
      lines.push(' '.repeat(LEFT_MARGIN + 14) + chalk.dim('▼'));
      lines.push('');
      
      // Row 3: Final states
      const inactive = createBox('INACTIVE', 'inactive' as TStatus, true);
      const suspended = createBox('SUSPENDED', 'suspended' as TStatus, true);
      const active = createBox('ACTIVE', 'active' as TStatus, true);
      
      alignColumns(inactive, suspended, active);
      
      // Final transitions
      lines.push('');
      lines.push(' '.repeat(LEFT_MARGIN + 32) + chalk.dim('◄────────────────'));
      lines.push(' '.repeat(LEFT_MARGIN + 34) + formatEvent('REACTIVATE'));
      lines.push(' '.repeat(LEFT_MARGIN + 42) + downArrow);
      lines.push(' '.repeat(LEFT_MARGIN + 42) + chalk.dim('▼'));
      lines.push(' '.repeat(LEFT_MARGIN + 36) + formatEvent('ACTIVATE'));
      lines.push('');
      
      // Legend
      lines.push(chalk.dim('═'.repeat(80)));
      lines.push(chalk.bold.white('LEGEND:'));
      lines.push('');
      lines.push('  States:     ' + chalk.bold.green('╔═╗') + ' Current    ' + chalk.bold.cyan('╔═╗') + ' Final    ' + chalk.blue('┌─┐') + ' Regular');
      lines.push('  Events:     ' + chalk.bold.yellow('→ EVENT_NAME') + ' (triggers state transition)');
      lines.push('  Flow:       ' + chalk.dim('──>') + ' Transition    ' + chalk.dim('│ v') + ' Direction    ' + chalk.yellow('↺') + ' Loop');
      lines.push('');
      lines.push(chalk.bold.white('KEY EVENTS:'));
      lines.push('  ' + chalk.yellow('• VERIFY_EMAIL') + ': Confirm email ownership');
      lines.push('  ' + chalk.yellow('• UPDATE_PROFILE') + ': Add/edit user information');
      lines.push('  ' + chalk.yellow('• START_ID_VERIFY') + ': Begin identity verification');
      lines.push('  ' + chalk.yellow('• COMPLETE_VERIFY') + ': Finish identity check');
      lines.push('  ' + chalk.yellow('• ACTIVATE') + ': Enable user account');
      lines.push('  ' + chalk.yellow('• SUSPEND') + ': Temporarily disable account');
      lines.push('  ' + chalk.yellow('• MARK_INACTIVE') + ': Flag abandoned onboarding (30+ days)');
      lines.push('');
      
      return lines.join('\n');
    }
  
    public printTransitionTable(): string {
      const lines: string[] = [];
      lines.push('');
      lines.push(chalk.bold.white('STATE TRANSITION TABLE'));
      lines.push(chalk.dim('═'.repeat(85)));
      lines.push(
        chalk.bold.cyan('From State'.padEnd(28)) + 
        chalk.dim('│') + ' ' +
        chalk.bold.yellow('Event'.padEnd(28)) + 
        chalk.dim('│') + ' ' +
        chalk.bold.green('To State')
      );
      lines.push(chalk.dim('─'.repeat(85)));
      
      // Group transitions by from state for better readability
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
          const eventName = event.split('.').pop()?.replace(/_/g, ' ').toUpperCase() || event;
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
      lines.push(chalk.bold.white('EVENT DESCRIPTIONS:'));
      lines.push('');
      
      const eventDescriptions = [
        { event: 'VERIFY_EMAIL', desc: 'User confirms email address ownership via token' },
        { event: 'UPDATE_PROFILE', desc: 'User provides or updates profile information' },
        { event: 'COMPLETE_PROFILE', desc: 'Profile reaches 100% completion' },
        { event: 'START_ID_VERIFY', desc: 'User initiates identity verification process' },
        { event: 'COMPLETE_ID_VERIFY', desc: 'Identity verification succeeds' },
        { event: 'FAIL_ID_VERIFY', desc: 'Identity verification fails' },
        { event: 'ACTIVATE', desc: 'Enable user account for full access' },
        { event: 'SUSPEND', desc: 'Temporarily disable account (manual review)' },
        { event: 'REACTIVATE', desc: 'Re-enable suspended account' },
        { event: 'MARK_INACTIVE', desc: 'Flag account as inactive (30+ days)' }
      ];
      
      for (const {event, desc} of eventDescriptions) {
        lines.push('  ' + chalk.yellow('→ ' + event.padEnd(20)) + chalk.dim(desc));
      }
      
      lines.push('');
      
      return lines.join('\n');
    }
    
    public visualizeCompact(currentStatus?: TStatus): string {
      const lines: string[] = [];
      
      lines.push(chalk.bold.white('USER ONBOARDING WORKFLOW - COMPACT VIEW'));
      lines.push(chalk.dim('═'.repeat(80)));
      lines.push('');
      
      // Define the workflow path
      const mainPath = [
        { status: 'REGISTERED', event: 'VERIFY_EMAIL' },
        { status: 'EMAIL_VERIFIED', event: 'UPDATE_PROFILE' },
        { status: 'PROFILE_COMPLETE', event: 'START_ID_VERIFY' },
        { status: 'ID_VERIFY_PENDING', event: 'COMPLETE_VERIFY' },
        { status: 'IDENTITY_VERIFIED', event: 'ACTIVATE' },
        { status: 'ACTIVE', event: null }
      ];
      
      // Main flow
      lines.push(chalk.bold('Main Flow:'));
      lines.push('');
      
      for (let i = 0; i < mainPath.length; i++) {
        const {status, event} = mainPath[i];
        const isActive = currentStatus === status.toLowerCase().replace(/_/g, '_');
        const isFinal = status === 'ACTIVE';
        
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
      lines.push('  ' + chalk.red('✗ SUSPENDED') + chalk.dim(' ← High risk / Failed verification'));
      lines.push('  ' + chalk.gray('○ INACTIVE') + chalk.dim(' ← No activity for 30+ days'));
      lines.push('  ' + chalk.blue('↺ PROFILE_INCOMPLETE') + chalk.dim(' ← Partial updates loop'));
      lines.push('');
      
      return lines.join('\n');
    }
  }