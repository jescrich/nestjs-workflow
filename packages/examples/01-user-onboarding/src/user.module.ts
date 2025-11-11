import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WorkflowModule } from '@jescrich/nestjs-workflow';
import { userOnboardingWorkflowDefinition } from './user.workflow';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserEntityService } from './user.entity.service';
import {
  UserRegistrationActions,
  UserVerificationActions,
  UserProfileActions,
  UserActivationActions,
} from './user.actions';
import { EmailService } from './services/email.service';
import { VerificationService } from './services/verification.service';
import { RiskAssessmentService } from './services/risk-assessment.service';
import { AnalyticsService } from './services/analytics.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    WorkflowModule.register({
      name: 'UserOnboardingWorkflow',
      definition: userOnboardingWorkflowDefinition,
    }),
  ],
  controllers: [UserController],
  providers: [
    UserService,
    UserEntityService,
    
    // Workflow Actions
    UserRegistrationActions,
    UserVerificationActions,
    UserProfileActions,
    UserActivationActions,
    
    // Supporting Services
    EmailService,
    VerificationService,
    RiskAssessmentService,
    AnalyticsService,
  ],
  exports: [UserService],
})
export class UserModule {}