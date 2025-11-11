import { Injectable, Logger } from '@nestjs/common';
import { WorkflowAction, OnEvent, OnStatusChanged } from '@jescrich/nestjs-workflow';
import { User, UserEvent, UserStatus } from './user.entity';
import { EmailService } from './services/email.service';
import { VerificationService } from './services/verification.service';
import { RiskAssessmentService } from './services/risk-assessment.service';
import { AnalyticsService } from './services/analytics.service';

@Injectable()
@WorkflowAction()
export class UserRegistrationActions {
  private readonly logger = new Logger(UserRegistrationActions.name);
  
  constructor(
    private readonly emailService: EmailService,
    private readonly analyticsService: AnalyticsService,
  ) {}
  
  @OnEvent({ event: UserEvent.REGISTER })
  async handleRegistration(params: { entity: User; payload: any }): Promise<User> {
    const { entity, payload } = params;
    this.logger.log(`Processing registration for user ${entity.email}`);
    
    // Generate email verification token
    entity.verification.emailVerificationToken = this.generateVerificationToken();
    
    // Set source and marketing info
    if (payload.source) entity.source = payload.source;
    if (payload.referralCode) entity.referralCode = payload.referralCode;
    if (payload.marketingCampaign) entity.marketingCampaign = payload.marketingCampaign;
    
    // Send welcome email with verification link
    await this.emailService.sendWelcomeEmail(entity);
    entity.welcomeEmailSent = true;
    
    // Track registration event
    await this.analyticsService.trackEvent('user_registered', {
      userId: entity.id,
      source: entity.source,
      referralCode: entity.referralCode,
    });
    
    return entity;
  }
  
  private generateVerificationToken(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

@Injectable()
@WorkflowAction()
export class UserVerificationActions {
  private readonly logger = new Logger(UserVerificationActions.name);
  
  constructor(
    private readonly emailService: EmailService,
    private readonly verificationService: VerificationService,
    private readonly analyticsService: AnalyticsService,
  ) {}
  
  @OnEvent({ event: UserEvent.VERIFY_EMAIL })
  async verifyEmail(params: { entity: User; payload: any }): Promise<User> {
    const { entity } = params;
    this.logger.log(`Verifying email for user ${entity.id}`);
    
    entity.verification.emailVerified = true;
    entity.verification.emailVerifiedAt = new Date();
    
    // Clear the verification token
    entity.verification.emailVerificationToken = undefined;
    
    // Send confirmation email
    await this.emailService.sendEmailVerifiedConfirmation(entity);
    
    // Track event
    await this.analyticsService.trackEvent('email_verified', {
      userId: entity.id,
      daysToVerify: entity.getDaysSinceRegistration(),
    });
    
    return entity;
  }
  
  @OnEvent({ event: UserEvent.START_IDENTITY_VERIFICATION })
  async startIdentityVerification(params: { entity: User; payload: any }): Promise<User> {
    const { entity, payload } = params;
    this.logger.log(`Starting identity verification for user ${entity.id}`);
    
    // Initiate KYC process
    const verificationSession = await this.verificationService.createVerificationSession({
      userId: entity.id,
      firstName: entity.profile.firstName,
      lastName: entity.profile.lastName,
      dateOfBirth: entity.profile.dateOfBirth,
      documents: payload.documents,
    });
    
    entity.verification.identityVerificationId = verificationSession.id;
    entity.verification.identityVerificationStatus = 'pending';
    entity.verification.documentsSubmitted = payload.documents;
    
    // Send notification
    await this.emailService.sendIdentityVerificationStarted(entity);
    
    return entity;
  }
  
  @OnEvent({ event: UserEvent.COMPLETE_IDENTITY_VERIFICATION })
  async completeIdentityVerification(params: { entity: User; payload: any }): Promise<User> {
    const { entity, payload } = params;
    this.logger.log(`Completing identity verification for user ${entity.id}`);
    
    entity.verification.identityVerificationStatus = 'completed';
    entity.verification.identityVerificationCompletedAt = new Date();
    
    // Perform risk assessment
    const riskScore = await this.verificationService.assessRisk(entity, payload.verificationResult);
    entity.riskAssessment = riskScore;
    
    // Track completion
    await this.analyticsService.trackEvent('identity_verified', {
      userId: entity.id,
      riskLevel: riskScore.level,
      verificationDuration: payload.duration,
    });
    
    return entity;
  }
}

@Injectable()
@WorkflowAction()
export class UserProfileActions {
  private readonly logger = new Logger(UserProfileActions.name);
  
  constructor(
    private readonly analyticsService: AnalyticsService,
  ) {}
  
  @OnEvent({ event: UserEvent.UPDATE_PROFILE })
  async updateProfile(params: { entity: User; payload: any }): Promise<User> {
    const { entity, payload } = params;
    this.logger.log(`Updating profile for user ${entity.id}`);
    
    // Update profile fields
    if (payload.firstName) entity.profile.firstName = payload.firstName;
    if (payload.lastName) entity.profile.lastName = payload.lastName;
    if (payload.dateOfBirth) entity.profile.dateOfBirth = new Date(payload.dateOfBirth);
    if (payload.phoneNumber) entity.profile.phoneNumber = payload.phoneNumber;
    if (payload.address) entity.profile.address = payload.address;
    if (payload.occupation) entity.profile.occupation = payload.occupation;
    if (payload.company) entity.profile.company = payload.company;
    if (payload.bio) entity.profile.bio = payload.bio;
    if (payload.preferences) entity.profile.preferences = payload.preferences;
    
    // Recalculate profile completeness
    const previousCompleteness = entity.profileCompleteness;
    entity.calculateProfileCompleteness();
    
    // Track progress
    if (entity.profileCompleteness > previousCompleteness) {
      await this.analyticsService.trackEvent('profile_progress', {
        userId: entity.id,
        previousCompleteness,
        currentCompleteness: entity.profileCompleteness,
      });
    }
    
    return entity;
  }
  
  @OnEvent({ event: UserEvent.COMPLETE_PROFILE })
  async completeProfile(params: { entity: User; payload: any }): Promise<User> {
    const { entity, payload } = params;
    this.logger.log(`Profile completed for user ${entity.id}`);
    
    // Final profile update if needed
    if (payload) {
      await this.updateProfile(params);
    }
    
    // Verify phone number if provided
    if (entity.profile.phoneNumber && !entity.verification.phoneVerified) {
      // In a real app, this would send an SMS
      entity.verification.phoneVerified = true;
      entity.verification.phoneVerifiedAt = new Date();
    }
    
    return entity;
  }
}

@Injectable()
@WorkflowAction()
export class UserActivationActions {
  private readonly logger = new Logger(UserActivationActions.name);
  
  constructor(
    private readonly emailService: EmailService,
    private readonly analyticsService: AnalyticsService,
    private readonly riskAssessmentService: RiskAssessmentService,
  ) {}
  
  @OnStatusChanged({ from: UserStatus.IDENTITY_VERIFIED, to: UserStatus.ACTIVE })
  async onUserActivated(params: { entity: User; payload: any }): Promise<User> {
    const { entity } = params;
    this.logger.log(`User ${entity.id} activated successfully`);
    
    // Send activation confirmation
    await this.emailService.sendAccountActivated(entity);
    
    // Send onboarding completion tips
    await this.emailService.sendOnboardingTips(entity);
    
    // Track successful onboarding
    const onboardingDuration = entity.onboardingCompletedAt ? 
      Math.floor((entity.onboardingCompletedAt.getTime() - entity.onboardingStartedAt.getTime()) / (1000 * 60 * 60 * 24)) : 
      0;
    
    await this.analyticsService.trackEvent('onboarding_completed', {
      userId: entity.id,
      durationDays: onboardingDuration,
      source: entity.source,
      referralCode: entity.referralCode,
    });
    
    return entity;
  }
  
  @OnStatusChanged({ from: UserStatus.IDENTITY_VERIFIED, to: UserStatus.SUSPENDED })
  async onHighRiskUserSuspended(params: { entity: User; payload: any }): Promise<User> {
    const { entity } = params;
    this.logger.log(`High risk user ${entity.id} suspended for manual review`);
    
    // Notify compliance team
    await this.emailService.notifyComplianceTeam(entity);
    
    // Send notification to user
    await this.emailService.sendAccountUnderReview(entity);
    
    return entity;
  }
  
  @OnEvent({ event: UserEvent.MARK_INACTIVE })
  async markUserInactive(params: { entity: User; payload: any }): Promise<User> {
    const { entity } = params;
    this.logger.log(`Marking user ${entity.id} as inactive`);
    
    // Track abandonment
    await this.analyticsService.trackEvent('onboarding_abandoned', {
      userId: entity.id,
      lastStatus: entity.status,
      daysSinceRegistration: entity.getDaysSinceRegistration(),
      profileCompleteness: entity.profileCompleteness,
    });
    
    // Send win-back email after a delay
    setTimeout(() => {
      this.emailService.sendWinBackEmail(entity);
    }, 7 * 24 * 60 * 60 * 1000); // 7 days
    
    return entity;
  }
  
  // Scheduled action to send reminders
  async sendOnboardingReminders(params: { entity: User; payload: any }): Promise<User> {
    const { entity } = params;
    
    if (entity.shouldSendReminder()) {
      await this.emailService.sendOnboardingReminder(entity);
      entity.remindersSent++;
      entity.lastReminderSentAt = new Date();
      
      await this.analyticsService.trackEvent('reminder_sent', {
        userId: entity.id,
        reminderNumber: entity.remindersSent,
        currentStatus: entity.status,
      });
    }
    
    return entity;
  }
}