import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UserService } from '../user.service';
import { UserEvent } from '../user.entity';
import { BaseDemoRunner, DemoScenario } from '../../../demo';
import { DemoUtils } from '../../../demo';
import * as chalk from 'chalk';

const scenarios: DemoScenario<UserEvent>[] = [
  {
    name: 'Happy Path - Complete Onboarding',
    description: 'User successfully completes all onboarding steps',
    steps: [
      {
        event: UserEvent.VERIFY_EMAIL,
        payload: { token: 'test-token-123' },
        delay: 1000,
        description: 'Verifying email address'
      },
      {
        event: UserEvent.UPDATE_PROFILE,
        payload: {
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
        },
        delay: 1500,
        description: 'Providing complete profile information in one update'
      },
      {
        event: UserEvent.START_IDENTITY_VERIFICATION,
        payload: { documents: ['passport.jpg', 'utility_bill.pdf'] },
        delay: 2000,
        description: 'Starting identity verification process'
      },
      {
        event: UserEvent.COMPLETE_IDENTITY_VERIFICATION,
        payload: { verificationStatus: 'completed', verificationId: 'VER-123456' },
        delay: 3000,
        description: 'Identity verification completed successfully'
      },
      {
        event: UserEvent.ACTIVATE,
        payload: {},
        delay: 1000,
        description: 'Activating user account'
      }
    ]
  },
  {
    name: 'High Risk User',
    description: 'User flagged as high risk requiring manual review',
    steps: [
      {
        event: UserEvent.VERIFY_EMAIL,
        payload: { token: 'test-token-456' },
        delay: 1000,
        description: 'Verifying email address'
      },
      {
        event: UserEvent.UPDATE_PROFILE,
        payload: {
          firstName: 'Jane',
          lastName: 'Smith'
        },
        delay: 1500,
        description: 'Partial profile update (will go to PROFILE_INCOMPLETE)'
      },
      {
        event: UserEvent.UPDATE_PROFILE,
        payload: {
          phoneNumber: '+9876543210',
          address: {
            street: '456 Oak Ave',
            city: 'Los Angeles',
            state: 'CA',
            zipCode: '90001',
            country: 'USA'
          },
          occupation: 'Freelancer',
          dateOfBirth: new Date('1985-05-15'),
          company: 'Self-employed',
          bio: 'Independent contractor',
          preferences: {
            language: 'en',
            timezone: 'America/Los_Angeles',
            newsletter: false,
            notifications: true
          }
        },
        delay: 1500,
        description: 'Completing remaining profile fields (should auto-transition to PROFILE_COMPLETE)'
      },
      {
        event: UserEvent.START_IDENTITY_VERIFICATION,
        payload: { documents: ['driver_license.jpg'] },
        delay: 2000,
        description: 'Starting identity verification'
      },
      {
        event: UserEvent.COMPLETE_IDENTITY_VERIFICATION,
        payload: { verificationStatus: 'completed', verificationId: 'VER-789012' },
        delay: 3000,
        description: 'Identity verification completed (high risk detected)'
      },
      {
        event: UserEvent.SUSPEND,
        payload: { reason: 'High risk profile - manual review required' },
        delay: 1000,
        description: 'Account suspended for manual review'
      }
    ]
  },
  {
    name: 'Abandoned Onboarding',
    description: 'User starts but abandons the onboarding process',
    steps: [
      {
        event: UserEvent.VERIFY_EMAIL,
        payload: { token: 'test-token-789' },
        delay: 1000,
        description: 'Verifying email address'
      },
      {
        event: UserEvent.UPDATE_PROFILE,
        payload: {
          firstName: 'Bob',
          lastName: 'Johnson'
        },
        delay: 1500,
        description: 'Partial profile update'
      },
      {
        event: UserEvent.MARK_INACTIVE,
        payload: { reason: 'No activity for 30+ days' },
        delay: 2000,
        description: 'Marking user as inactive due to abandonment'
      }
    ]
  }
];

class DemoRunner extends BaseDemoRunner<any, UserEvent, string> {
  private userService: UserService;

  constructor(userService: UserService) {
    super();
    this.userService = userService;
  }

  protected getStatusColor(status: string): string {
    return DemoUtils.getStatusColor(status);
  }

  protected async createEntity(): Promise<any> {
    const userData = {
      email: `demo-${Date.now()}@example.com`,
      username: `demo_user_${Date.now()}`,
      source: 'web' as const
    };
    return await this.userService.createUser(userData);
  }

  protected async processEvent(entityId: string, event: UserEvent, payload?: any): Promise<any> {
    return await this.userService.processWorkflowEvent(entityId, event, payload);
  }

  protected printEntityState(user: any): void {
    const content = [];
    content.push(chalk.bold('ID: ') + chalk.cyan(user.id.substring(0, 8) + '...'));
    content.push(chalk.bold('Status: ') + this.getStatusColor(user.status));
    content.push(chalk.bold('Email: ') + chalk.white(user.email));
    content.push(chalk.bold('Profile Completeness: ') + this.getProgressBar(user.profileCompleteness));
    
    if (user.verification) {
      content.push(chalk.bold('Email Verified: ') + 
        (user.verification.emailVerified ? chalk.green('✓') : chalk.red('✗')));
      
      if (user.verification.identityVerificationStatus) {
        content.push(chalk.bold('Identity Status: ') + 
          DemoUtils.getVerificationStatusColor(user.verification.identityVerificationStatus));
      }
    }
    
    if (user.riskAssessment) {
      content.push(chalk.bold('Risk Level: ') + 
        DemoUtils.getRiskLevelColor(user.riskAssessment.level));
    }
    
    DemoUtils.printBox(content, chalk.dim);
  }
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false // Disable NestJS logging for cleaner output
  });
  const userService = app.get(UserService);
  
  const runner = new DemoRunner(userService);
  
  // Check for command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--all')) {
    await runner.runAllScenarios(scenarios);
  } else if (args.includes('--interactive')) {
    await runner.runInteractive(scenarios);
  } else {
    const scenarioIndex = args.findIndex(arg => arg.startsWith('--scenario='));
    if (scenarioIndex !== -1) {
      const scenarioNum = parseInt(args[scenarioIndex].split('=')[1]) - 1;
      if (scenarioNum >= 0 && scenarioNum < scenarios.length) {
        await runner.runScenario(scenarios[scenarioNum]);
      } else {
        console.error(chalk.red('Invalid scenario number'));
      }
    } else {
      // Default: run all scenarios
      await runner.runAllScenarios(scenarios);
    }
  }
  
  await app.close();
}

bootstrap().catch(console.error);