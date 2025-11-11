import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { UserService } from './src/user.service';
import { UserEvent } from './src/user.entity';
import * as chalk from 'chalk';

async function testHappyPath() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false
  });
  const userService = app.get(UserService);
  
  try {
    console.log(chalk.bold.blue('\n=== Testing Happy Path ===\n'));
    
    // Create user
    const user = await userService.createUser({
      email: `test-${Date.now()}@example.com`,
      username: `test_user_${Date.now()}`,
      source: 'web'
    });
    console.log(chalk.green('✓') + ' User created:', user.status);
    
    // Verify email
    const user2 = await userService.processWorkflowEvent(user.id, UserEvent.VERIFY_EMAIL, {
      token: user.verification.emailVerificationToken
    });
    console.log(chalk.green('✓') + ' Email verified:', user2.status);
    
    // Update profile (complete)
    const user3 = await userService.processWorkflowEvent(user.id, UserEvent.UPDATE_PROFILE, {
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
      bio: 'Test bio',
      preferences: {
        language: 'en',
        timezone: 'America/New_York',
        newsletter: true,
        notifications: true
      }
    });
    console.log(chalk.green('✓') + ' Profile updated:', user3.status, `(completeness: ${user3.profileCompleteness}%)`);
    
    // Start identity verification
    const user4 = await userService.processWorkflowEvent(user.id, UserEvent.START_IDENTITY_VERIFICATION, {
      documents: ['passport.jpg', 'utility_bill.pdf']
    });
    console.log(chalk.green('✓') + ' Identity verification started:', user4.status);
    
    // Complete identity verification
    const user5 = await userService.processWorkflowEvent(user.id, UserEvent.COMPLETE_IDENTITY_VERIFICATION, {
      verificationStatus: 'completed',
      verificationId: 'VER-123456'
    });
    console.log(chalk.green('✓') + ' Identity verification completed:', user5.status);
    
    // Activate user
    const user6 = await userService.processWorkflowEvent(user.id, UserEvent.ACTIVATE, {});
    console.log(chalk.green('✓') + ' User activated:', user6.status);
    
    console.log(chalk.bold.green('\n✅ Happy path completed successfully!\n'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Error during happy path:'), error.message);
    console.error(chalk.dim('Stack trace:'), error.stack);
  }
  
  await app.close();
}

testHappyPath().catch(console.error);