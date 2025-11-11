import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UserService } from '../user.service';
import { UserEvent, UserStatus, User } from '../user.entity';
import { BaseInteractiveDemo, DemoUtils } from '../../../demo';
import { userOnboardingWorkflowDefinition } from '../user.workflow';
import * as chalk from 'chalk';
import { UserOnboardingVisualizer } from './demo.visualizer';

class InteractiveDemo extends BaseInteractiveDemo<any, UserEvent, UserStatus> {
  private userService: UserService;
  private visualizer: UserOnboardingVisualizer<User, any, UserEvent, UserStatus>;
  private isAutomatedMode: boolean = false;

  constructor(userService: UserService) {
    super();
    this.userService = userService;
    this.visualizer = new UserOnboardingVisualizer(userOnboardingWorkflowDefinition);
    this.currentEntity = null;
  }

  protected async showVisualization(): Promise<void> {
    this.clearScreen();
    
    // Generate right column content
    const rightContent: string[] = [];
    
    if (this.currentEntity) {
      rightContent.push(chalk.bold.yellow('CURRENT USER'));
      rightContent.push(chalk.dim('─'.repeat(40)));
      rightContent.push('');
      rightContent.push(chalk.white('ID: ') + chalk.cyan(this.currentEntity.id.substring(0, 8) + '...'));
      rightContent.push(chalk.white('Email: ') + chalk.cyan(this.currentEntity.email));
      rightContent.push(chalk.white('Status: ') + this.getStatusColor(this.currentEntity.status));
      rightContent.push('');
      rightContent.push(chalk.white('Profile: ') + this.getProgressBar(this.currentEntity.profileCompleteness));
      
      if (this.currentEntity.verification) {
        rightContent.push(chalk.white('Email Verified: ') + 
          (this.currentEntity.verification.emailVerified ? chalk.green('✓ Yes') : chalk.red('✗ No')));
        
        if (this.currentEntity.verification.identityVerificationStatus) {
          rightContent.push(chalk.white('ID Status: ') + 
            DemoUtils.getVerificationStatusColor(this.currentEntity.verification.identityVerificationStatus));
        }
      }
      
      if (this.currentEntity.riskAssessment) {
        rightContent.push(chalk.white('Risk Level: ') + 
          DemoUtils.getRiskLevelColor(this.currentEntity.riskAssessment.level));
      }
      
      rightContent.push('');
      rightContent.push(chalk.dim('─'.repeat(40)));
      rightContent.push('');
      
      // Add available actions
      rightContent.push(chalk.bold.yellow('AVAILABLE ACTIONS'));
      rightContent.push('');
      
      const events = this.getAvailableEvents();
      if (events.length > 0) {
        events.forEach((event, index) => {
          rightContent.push(chalk.cyan(`${index + 1}. `) + chalk.white(this.getEventDescription(event)));
        });
      } else {
        rightContent.push(chalk.gray('No actions available in current state'));
      }
      
      rightContent.push('');
      rightContent.push(chalk.dim('─'.repeat(40)));
      rightContent.push('');
      
      // Add history
      if (this.history.length > 1) {
        rightContent.push(chalk.bold.yellow('TRANSITION HISTORY'));
        rightContent.push('');
        
        for (let i = 0; i < Math.min(this.history.length, 5); i++) {
          const status = this.history[i];
          const arrow = i < this.history.length - 1 ? ' → ' : '';
          rightContent.push('  ' + this.getStatusColor(status) + arrow);
        }
        
        if (this.history.length > 5) {
          rightContent.push('  ' + chalk.gray(`... and ${this.history.length - 5} more`));
        }
      }
    } else {
      rightContent.push(chalk.gray('No entity created yet'));
      rightContent.push('');
      rightContent.push('Press ' + chalk.cyan('n') + ' to create a new user');
    }
    
    // Use two-column visualization
    const visualization = this.visualizer.visualizeTwoColumn(this.currentEntity?.status, rightContent);
    console.log(visualization);
  }

  protected printEntityInfo(): void {
    console.log('\n' + chalk.bold.yellow('Current User Information:'));
    DemoUtils.printDivider();
    console.log(chalk.white('  ID: ') + chalk.cyan(this.currentEntity.id.substring(0, 8) + '...'));
    console.log(chalk.white('  Email: ') + chalk.cyan(this.currentEntity.email));
    console.log(chalk.white('  Status: ') + this.getStatusColor(this.currentEntity.status));
    console.log(chalk.white('  Profile Complete: ') + this.getProgressBar(this.currentEntity.profileCompleteness));
    
    if (this.currentEntity.verification) {
      console.log(chalk.white('  Email Verified: ') + 
        (this.currentEntity.verification.emailVerified ? chalk.green('✓ Yes') : chalk.red('✗ No')));
    }
    
    DemoUtils.printDivider();
  }

  protected getStatusColor(status: string): string {
    return DemoUtils.getStatusColor(status);
  }

  protected async showMenu(): Promise<string> {
    console.log('');
    console.log(chalk.dim('═'.repeat(120)));
    console.log(chalk.bold.yellow('MENU OPTIONS:'));
    
    // Create menu in columns for better space usage
    const menuItems: string[] = [];
    
    if (this.currentEntity) {
      const events = this.getAvailableEvents();
      events.forEach((event, index) => {
        menuItems.push(chalk.cyan(`${index + 1}`) + ' ' + this.getEventDescription(event));
      });
    }
    
    menuItems.push(chalk.cyan('v') + ' Full visualization');
    menuItems.push(chalk.cyan('c') + ' Compact view');
    menuItems.push(chalk.cyan('t') + ' Transition table');
    menuItems.push(chalk.cyan('n') + ' New entity');
    menuItems.push(chalk.cyan('r') + ' Run scenario');
    menuItems.push(chalk.cyan('h') + ' History');
    menuItems.push(chalk.cyan('q') + ' Quit');
    
    // Display menu items in 3 columns
    const itemsPerRow = 3;
    const columnWidth = 40;
    
    for (let i = 0; i < menuItems.length; i += itemsPerRow) {
      let row = '';
      for (let j = 0; j < itemsPerRow && i + j < menuItems.length; j++) {
        const item = menuItems[i + j];
        const padding = columnWidth - this.stripAnsi(item).length;
        row += item + ' '.repeat(Math.max(0, padding));
      }
      console.log('  ' + row);
    }
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise<string>((resolve) => {
      rl.question('\n' + chalk.cyan('Select option: '), (answer: string) => {
        rl.close();
        resolve(answer);
      });
    });
  }
  
  private stripAnsi(str: string): string {
    return str.replace(/\u001b\[[0-9;]*m/g, '');
  }

  protected getAvailableEvents(): UserEvent[] {
    if (!this.currentEntity) return [];
    
    const events: UserEvent[] = [];
    const currentStatus = this.currentEntity.status;
    
    // Map of status to possible events
    const statusEvents: { [key: string]: UserEvent[] } = {
      [UserStatus.REGISTERED]: [UserEvent.VERIFY_EMAIL, UserEvent.MARK_INACTIVE],
      [UserStatus.EMAIL_VERIFIED]: [UserEvent.UPDATE_PROFILE, UserEvent.MARK_INACTIVE],
      [UserStatus.PROFILE_INCOMPLETE]: [UserEvent.UPDATE_PROFILE, UserEvent.COMPLETE_PROFILE, UserEvent.MARK_INACTIVE],
      [UserStatus.PROFILE_COMPLETE]: [UserEvent.START_IDENTITY_VERIFICATION, UserEvent.MARK_INACTIVE],
      [UserStatus.IDENTITY_VERIFICATION_PENDING]: [UserEvent.COMPLETE_IDENTITY_VERIFICATION, UserEvent.FAIL_IDENTITY_VERIFICATION],
      [UserStatus.IDENTITY_VERIFIED]: [UserEvent.ACTIVATE, UserEvent.SUSPEND],
      [UserStatus.ACTIVE]: [UserEvent.SUSPEND],
      [UserStatus.SUSPENDED]: [UserEvent.REACTIVATE],
    };
    
    return statusEvents[currentStatus] || [];
  }

  protected getEventDescription(event: UserEvent): string {
    const descriptions: { [key: string]: string } = {
      [UserEvent.VERIFY_EMAIL]: 'Verify email address',
      [UserEvent.UPDATE_PROFILE]: 'Update profile information',
      [UserEvent.COMPLETE_PROFILE]: 'Complete profile',
      [UserEvent.START_IDENTITY_VERIFICATION]: 'Start identity verification',
      [UserEvent.COMPLETE_IDENTITY_VERIFICATION]: 'Complete identity verification',
      [UserEvent.FAIL_IDENTITY_VERIFICATION]: 'Fail identity verification',
      [UserEvent.ACTIVATE]: 'Activate account',
      [UserEvent.SUSPEND]: 'Suspend account',
      [UserEvent.REACTIVATE]: 'Reactivate account',
      [UserEvent.MARK_INACTIVE]: 'Mark as inactive',
    };
    
    return descriptions[event] || event;
  }

  protected async processEvent(event: UserEvent): Promise<void> {
    console.log('\n' + chalk.yellow('Processing: ') + chalk.white(this.getEventDescription(event)));
    
    // Generate appropriate payload based on event
    const payload = this.generatePayload(event);
    
    try {
      const previousStatus = this.currentEntity.status;
      
      console.log(chalk.dim('  Payload: ') + chalk.gray(DemoUtils.formatJson(payload)));
      
      this.currentEntity = await this.userService.processWorkflowEvent(
        this.currentEntity.id,
        event,
        payload
      );
      
      if (this.currentEntity.status !== previousStatus) {
        this.history.push(this.currentEntity.status);
        console.log(chalk.green('✓ Transition successful: ') + 
          this.getStatusColor(previousStatus) + 
          chalk.white(' → ') + 
          this.getStatusColor(this.currentEntity.status));
      } else {
        console.log(chalk.yellow('⚠ No transition occurred (conditions may not have been met)'));
      }
      
      await this.delay(1500);
      
    } catch (error: any) {
      console.log(chalk.red('✗ Error: ') + chalk.red(error.message));
      await this.delay(2000);
    }
  }

  private generatePayload(event: UserEvent): any {
    switch (event) {
      case UserEvent.VERIFY_EMAIL:
        return { token: 'test-token-123' };
      
      case UserEvent.UPDATE_PROFILE:
        // For automated scenarios, provide complete profile data
        // For manual interaction, provide partial updates
        if (this.isAutomatedMode) {
          return {
            firstName: 'John',
            lastName: 'Doe',
            phoneNumber: '+1234567890',
            dateOfBirth: new Date('1990-01-01'),
            address: {
              street: '123 Main St',
              city: 'New York',
              state: 'NY',
              zipCode: '10001',
              country: 'USA'
            },
            occupation: 'Software Engineer',
            company: 'TechCorp',
            bio: 'Passionate about technology',
            preferences: {
              language: 'en',
              timezone: 'America/New_York',
              newsletter: true,
              notifications: true
            }
          };
        }
        // For manual mode, randomly generate partial profile data
        const updates = [
          { firstName: 'John', lastName: 'Doe' },
          { phoneNumber: '+1234567890' },
          { 
            address: {
              street: '123 Main St',
              city: 'New York',
              state: 'NY',
              zipCode: '10001',
              country: 'USA'
            }
          },
          { dateOfBirth: new Date('1990-01-01') }
        ];
        return updates[Math.floor(Math.random() * updates.length)];
      
      case UserEvent.COMPLETE_PROFILE:
        return {
          occupation: 'Software Engineer',
          company: 'TechCorp',
          bio: 'Passionate about technology'
        };
      
      case UserEvent.START_IDENTITY_VERIFICATION:
        return { documents: ['passport.jpg', 'utility_bill.pdf'] };
      
      case UserEvent.COMPLETE_IDENTITY_VERIFICATION:
        return { verificationStatus: 'completed', verificationId: 'VER-' + Date.now() };
      
      case UserEvent.FAIL_IDENTITY_VERIFICATION:
        return { reason: 'Document validation failed' };
      
      case UserEvent.SUSPEND:
        return { reason: 'Manual review required' };
      
      case UserEvent.MARK_INACTIVE:
        return { reason: 'No activity for 30+ days' };
      
      default:
        return {};
    }
  }

  protected async createNewEntity(): Promise<void> {
    console.log('\n' + chalk.bold.green('Creating new user...'));
    
    const userData = {
      email: `user-${Date.now()}@example.com`,
      username: `user_${Date.now()}`,
      source: 'web' as const
    };
    
    this.currentEntity = await this.userService.createUser(userData);
    this.history = [UserStatus.REGISTERED];
    
    console.log(chalk.green('✓ User created successfully!'));
    console.log(chalk.white('  Email: ') + chalk.cyan(this.currentEntity.email));
    
    await this.delay(1500);
  }

  private async waitForInput(prompt: string): Promise<string> {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question(prompt, (answer: string) => {
        rl.close();
        resolve(answer);
      });
    });
  }
  
  protected async showHistory(): Promise<void> {
    this.clearScreen();
    this.printHeader('Transition History');
    
    if (this.history.length === 0) {
      console.log(chalk.gray('No transitions yet.'));
    } else {
      console.log(chalk.bold('State transitions:'));
      console.log('');
      for (let i = 0; i < this.history.length; i++) {
        const status = this.history[i];
        const arrow = i < this.history.length - 1 ? ' → ' : '';
        process.stdout.write(this.getStatusColor(status) + arrow);
      }
      console.log('\n');
    }
    
    await this.waitForInput('\nPress Enter to continue...');
  }
  
  protected async showCompactView(): Promise<void> {
    this.clearScreen();
    this.printHeader('User Onboarding Workflow - Compact View');
    
    const visualization = this.visualizer.visualizeCompact(this.currentEntity?.status);
    console.log(visualization);
    
    if (this.currentEntity) {
      this.printEntityInfo();
    }
    
    await this.waitForInput('\nPress Enter to continue...');
  }
  
  protected async showTransitionTable(): Promise<void> {
    this.clearScreen();
    this.printHeader('User Onboarding Workflow - Transition Table');
    
    const table = this.visualizer.printTransitionTable();
    console.log(table);
    
    await this.waitForInput('\nPress Enter to continue...');
  }
  
  protected async handleInput(input: string): Promise<boolean> {
    // Handle numeric inputs for events
    const eventIndex = parseInt(input) - 1;
    const events = this.getAvailableEvents();
    
    if (!isNaN(eventIndex) && eventIndex >= 0 && eventIndex < events.length) {
      await this.processEvent(events[eventIndex]);
      return true;
    }
    
    // Handle other commands
    switch(input.toLowerCase()) {
      case 'v':
        await this.showVisualization();
        return true;
      case 'c':
        await this.showCompactView();
        return true;
      case 't':
        await this.showTransitionTable();
        return true;
      case 'n':
        await this.createNewEntity();
        return true;
      case 'r':
        await this.runAutomatedScenario();
        return true;
      case 'h':
        await this.showHistory();
        return true;
      case 'q':
        return false;
      default:
        console.log(chalk.red('Invalid option. Please try again.'));
        await this.delay(1000);
        return true;
    }
  }
  
  public async run(): Promise<void> {
    this.clearScreen();
    this.printHeader('Interactive Workflow Demo');
    
    console.log('\nWelcome to the Interactive Workflow Demo!');
    console.log('This demo allows you to explore workflow states and transitions.\n');
    
    // Create initial entity
    await this.createNewEntity();
    
    // Main loop
    let running = true;
    while (running) {
      await this.showVisualization();
      const input = await this.showMenu();
      running = await this.handleInput(input);
    }
    
    console.log('\nGoodbye!');
  }
  
  public cleanup(): void {
    // Any cleanup if needed
  }
  
  protected async runAutomatedScenario(): Promise<void> {
    console.log('\n' + chalk.bold.yellow('Running automated happy path scenario...'));
    await this.delay(1000);
    
    this.isAutomatedMode = true;  // Enable automated mode for complete profile data
    
    const steps = [
      { event: UserEvent.VERIFY_EMAIL, delay: 1000 },
      { event: UserEvent.UPDATE_PROFILE, delay: 1000 },  // This will now provide complete profile data
      { event: UserEvent.START_IDENTITY_VERIFICATION, delay: 1500 },
      { event: UserEvent.COMPLETE_IDENTITY_VERIFICATION, delay: 2000 },
      { event: UserEvent.ACTIVATE, delay: 1000 }
    ];
    
    for (const step of steps) {
      await this.showVisualization();
      await this.delay(step.delay);
      await this.processEvent(step.event);
    }
    
    this.isAutomatedMode = false;  // Disable automated mode
    
    console.log('\n' + chalk.bold.green('✓ Scenario completed!'));
    await this.delay(2000);
  }
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false // Disable NestJS logging for cleaner output
  });
  
  const userService = app.get(UserService);
  const demo = new InteractiveDemo(userService);
  
  try {
    await demo.run();
  } finally {
    demo.cleanup();
    await app.close();
    process.exit(0);
  }
}

bootstrap().catch(error => {
  console.error(chalk.red('Error running demo:'), error);
  process.exit(1);
});