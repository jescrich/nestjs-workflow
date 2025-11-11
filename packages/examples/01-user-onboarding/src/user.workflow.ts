import { WorkflowDefinition } from '@jescrich/nestjs-workflow';
import { User, UserEvent, UserStatus } from './user.entity';
import { UserEntityService } from './user.entity.service';
import {
  UserRegistrationActions,
  UserVerificationActions,
  UserProfileActions,
  UserActivationActions,
} from './user.actions';

export const userOnboardingWorkflowDefinition: WorkflowDefinition<User, any, UserEvent, UserStatus> = {
  name: 'UserOnboardingWorkflow',
  
  states: {
    finals: [
      UserStatus.ACTIVE,
      UserStatus.SUSPENDED,
      UserStatus.INACTIVE,
    ],
    idles: [
      UserStatus.REGISTERED,
      UserStatus.EMAIL_VERIFIED,
      UserStatus.PROFILE_INCOMPLETE,
      UserStatus.PROFILE_COMPLETE,
      UserStatus.IDENTITY_VERIFICATION_PENDING,
      UserStatus.IDENTITY_VERIFIED,
      UserStatus.ACTIVE,
      UserStatus.SUSPENDED,
      UserStatus.INACTIVE,
    ],
    failed: UserStatus.INACTIVE,
  },
  
  transitions: [
    // Registration to email verification
    {
      from: UserStatus.REGISTERED,
      to: UserStatus.EMAIL_VERIFIED,
      event: UserEvent.VERIFY_EMAIL,
      conditions: [
        (user: User, payload: any) => {
          // Verify the email token matches
          return user.verification.emailVerificationToken === payload.token;
        },
      ],
    },
    
    // Email verified to profile incomplete (when profile not complete)
    {
      from: UserStatus.EMAIL_VERIFIED,
      to: UserStatus.PROFILE_INCOMPLETE,
      event: UserEvent.UPDATE_PROFILE,
      conditions: [
        (user: User) => user.profileCompleteness < 100,
      ],
    },
    
    // Email verified directly to profile complete (when profile is complete)
    {
      from: UserStatus.EMAIL_VERIFIED,
      to: UserStatus.PROFILE_COMPLETE,
      event: UserEvent.UPDATE_PROFILE,
      conditions: [
        (user: User) => user.profileCompleteness >= 100,
      ],
    },
    
    // Update profile while still incomplete
    {
      from: UserStatus.PROFILE_INCOMPLETE,
      to: UserStatus.PROFILE_INCOMPLETE,
      event: UserEvent.UPDATE_PROFILE,
      conditions: [
        (user: User) => user.profileCompleteness < 100,
      ],
    },
    
    // Update profile and it becomes complete
    {
      from: UserStatus.PROFILE_INCOMPLETE,
      to: UserStatus.PROFILE_COMPLETE,
      event: UserEvent.UPDATE_PROFILE,
      conditions: [
        (user: User) => user.profileCompleteness >= 100,
      ],
    },
    
    // Explicit complete profile action (for backward compatibility)
    {
      from: UserStatus.PROFILE_INCOMPLETE,
      to: UserStatus.PROFILE_COMPLETE,
      event: UserEvent.COMPLETE_PROFILE,
      conditions: [
        (user: User) => user.profileCompleteness >= 100,
      ],
    },
    
    // Start identity verification
    {
      from: UserStatus.PROFILE_COMPLETE,
      to: UserStatus.IDENTITY_VERIFICATION_PENDING,
      event: UserEvent.START_IDENTITY_VERIFICATION,
    },
    
    // Complete identity verification
    {
      from: UserStatus.IDENTITY_VERIFICATION_PENDING,
      to: UserStatus.IDENTITY_VERIFIED,
      event: UserEvent.COMPLETE_IDENTITY_VERIFICATION,
      conditions: [
        (user: User, payload: any) => {
          // Check verification passed
          return payload.verificationStatus === 'completed';
        },
      ],
    },
    
    // Fail identity verification
    {
      from: UserStatus.IDENTITY_VERIFICATION_PENDING,
      to: UserStatus.SUSPENDED,
      event: UserEvent.FAIL_IDENTITY_VERIFICATION,
    },
    
    // Activate user
    {
      from: UserStatus.IDENTITY_VERIFIED,
      to: UserStatus.ACTIVE,
      event: UserEvent.ACTIVATE,
      conditions: [
        (user: User) => !user.isHighRisk(),
      ],
    },
    
    // High risk users require manual review
    {
      from: UserStatus.IDENTITY_VERIFIED,
      to: UserStatus.SUSPENDED,
      event: UserEvent.SUSPEND,
      conditions: [
        (user: User) => user.isHighRisk(),
      ],
    },
    
    // Reactivate suspended user
    {
      from: UserStatus.SUSPENDED,
      to: UserStatus.ACTIVE,
      event: UserEvent.REACTIVATE,
    },
    
    // Mark inactive (from various states)
    {
      from: [
        UserStatus.REGISTERED,
        UserStatus.EMAIL_VERIFIED,
        UserStatus.PROFILE_INCOMPLETE,
        UserStatus.PROFILE_COMPLETE,
      ],
      to: UserStatus.INACTIVE,
      event: UserEvent.MARK_INACTIVE,
      conditions: [
        (user: User) => {
          // Mark inactive if no activity for 30 days
          return user.getDaysSinceRegistration() > 30;
        },
      ],
    },
    
    // Suspend active user
    {
      from: UserStatus.ACTIVE,
      to: UserStatus.SUSPENDED,
      event: UserEvent.SUSPEND,
    },
  ],
  
  actions: [
    UserRegistrationActions,
    UserVerificationActions,
    UserProfileActions,
    UserActivationActions,
  ],
  
  entity: UserEntityService,
  
  // Optional: Handle abandoned onboarding
  fallback: async (user: User, event: UserEvent, payload: any) => {
    console.log(`No valid transition for user ${user.id} with event ${event}`);
    
    // Check if user should be marked inactive
    if (user.getDaysSinceRegistration() > 30 && user.status !== UserStatus.ACTIVE) {
      user.status = UserStatus.INACTIVE;
    }
    
    return user;
  },
};