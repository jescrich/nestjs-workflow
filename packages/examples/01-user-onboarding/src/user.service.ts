import { Injectable, Inject, Logger, BadRequestException } from '@nestjs/common';
import { WorkflowService } from '@jescrich/nestjs-workflow';
import { User, UserEvent, UserStatus, UserProfile } from './user.entity';
import { UserEntityService } from './user.entity.service';
import { Cron } from '@nestjs/schedule';

interface RegisterUserDto {
  email: string;
  username: string;
  password: string; // In production, this would be hashed
  source?: 'web' | 'mobile' | 'api' | 'partner';
  referralCode?: string;
  marketingCampaign?: string;
}

interface UpdateProfileDto {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  phoneNumber?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  occupation?: string;
  company?: string;
  bio?: string;
  preferences?: {
    language: string;
    timezone: string;
    newsletter: boolean;
    notifications: boolean;
  };
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  
  constructor(
    @Inject('UserOnboardingWorkflow')
    private readonly workflowService: WorkflowService<User, any, UserEvent, UserStatus>,
    private readonly userEntityService: UserEntityService,
  ) {}
  
  async registerUser(dto: RegisterUserDto): Promise<User> {
    this.logger.log(`Registering new user: ${dto.email}`);
    
    // Check if email already exists
    const existingUser = await this.userEntityService.findByEmail(dto.email);
    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }
    
    // Create new user
    const user = await this.userEntityService.new();
    user.email = dto.email;
    user.username = dto.username;
    user.source = dto.source || 'web';
    
    // Save initial user data
    await this.userEntityService.save(user);
    
    // Trigger registration workflow
    const registeredUser = await this.workflowService.emit({
      urn: user.id,
      event: UserEvent.REGISTER,
      payload: {
        source: dto.source,
        referralCode: dto.referralCode,
        marketingCampaign: dto.marketingCampaign,
      },
    });
    
    return registeredUser;
  }
  
  async verifyEmail(userId: string, token: string): Promise<User> {
    this.logger.log(`Verifying email for user: ${userId}`);
    
    const user = await this.userEntityService.load(userId);
    if (!user) {
      throw new BadRequestException('Invalid verification link');
    }
    
    const result = await this.workflowService.emit({
      urn: userId,
      event: UserEvent.VERIFY_EMAIL,
      payload: { token },
    });
    
    return result;
  }
  
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    this.logger.log(`Updating profile for user: ${userId}`);
    
    const result = await this.workflowService.emit({
      urn: userId,
      event: UserEvent.UPDATE_PROFILE,
      payload: dto,
    });
    
    // Check if profile is now complete
    if (result.profileCompleteness >= 100 && result.status === UserStatus.PROFILE_INCOMPLETE) {
      return await this.completeProfile(userId);
    }
    
    return result;
  }
  
  async completeProfile(userId: string): Promise<User> {
    this.logger.log(`Completing profile for user: ${userId}`);
    
    const result = await this.workflowService.emit({
      urn: userId,
      event: UserEvent.COMPLETE_PROFILE,
    });
    
    return result;
  }
  
  async startIdentityVerification(userId: string, documents: string[], autoComplete: boolean = true): Promise<User> {
    this.logger.log(`Starting identity verification for user: ${userId}`);
    
    const result = await this.workflowService.emit({
      urn: userId,
      event: UserEvent.START_IDENTITY_VERIFICATION,
      payload: { documents },
    });
    
    // Simulate async verification completion (optional)
    if (autoComplete) {
      setTimeout(async () => {
        await this.completeIdentityVerification(userId);
      }, 5000);
    }
    
    return result;
  }
  
  private async completeIdentityVerification(userId: string): Promise<void> {
    try {
      // First check if user is still in the correct state
      const user = await this.userEntityService.load(userId);
      if (!user) {
        this.logger.warn(`User ${userId} not found for identity verification completion`);
        return;
      }
      
      // Only complete verification if user is in pending state
      if (user.status !== UserStatus.IDENTITY_VERIFICATION_PENDING) {
        this.logger.warn(`User ${userId} is not in identity verification pending state (current: ${user.status})`);
        return;
      }
      
      const verificationResult = {
        verificationStatus: 'completed',
        confidence: 95,
        duration: 5000,
      };
      
      await this.workflowService.emit({
        urn: userId,
        event: UserEvent.COMPLETE_IDENTITY_VERIFICATION,
        payload: { verificationResult },
      });
      
      // Automatically activate if not high risk
      const updatedUser = await this.userEntityService.load(userId);
      if (updatedUser && updatedUser.status === UserStatus.IDENTITY_VERIFIED && !updatedUser.isHighRisk()) {
        await this.activateUser(userId);
      }
    } catch (error) {
      this.logger.error(`Failed to complete identity verification: ${error.message}`);
      
      // Only fail if user is still in pending state
      const user = await this.userEntityService.load(userId);
      if (user && user.status === UserStatus.IDENTITY_VERIFICATION_PENDING) {
        await this.workflowService.emit({
          urn: userId,
          event: UserEvent.FAIL_IDENTITY_VERIFICATION,
          payload: { reason: error.message },
        });
      }
    }
  }
  
  async activateUser(userId: string): Promise<User> {
    this.logger.log(`Activating user: ${userId}`);
    
    const result = await this.workflowService.emit({
      urn: userId,
      event: UserEvent.ACTIVATE,
    });
    
    return result;
  }
  
  async suspendUser(userId: string, reason: string): Promise<User> {
    this.logger.log(`Suspending user: ${userId}. Reason: ${reason}`);
    
    const result = await this.workflowService.emit({
      urn: userId,
      event: UserEvent.SUSPEND,
      payload: { reason },
    });
    
    return result;
  }
  
  async reactivateUser(userId: string, approvedBy: string): Promise<User> {
    this.logger.log(`Reactivating user: ${userId}`);
    
    const result = await this.workflowService.emit({
      urn: userId,
      event: UserEvent.REACTIVATE,
      payload: { approvedBy },
    });
    
    return result;
  }
  
  async getUser(userId: string): Promise<User | null> {
    return this.userEntityService.load(userId);
  }
  
  async getUserByEmail(email: string): Promise<User | null> {
    return this.userEntityService.findByEmail(email);
  }
  
  async getOnboardingMetrics(): Promise<any> {
    return this.userEntityService.getOnboardingMetrics();
  }
  
  // Helper methods for demos
  async createUser(data: { email: string; username: string; source: 'web' | 'mobile' | 'api' | 'partner' }): Promise<User> {
    const user = await this.userEntityService.new();
    user.email = data.email;
    user.username = data.username;
    user.source = data.source;
    user.verification.emailVerificationToken = 'test-token-123';
    await this.userEntityService.save(user);
    return user;
  }
  
  async processWorkflowEvent(userId: string, event: UserEvent, payload: any = {}): Promise<User> {
    // Handle START_IDENTITY_VERIFICATION specially to avoid auto-completion in demos
    if (event === UserEvent.START_IDENTITY_VERIFICATION) {
      return await this.startIdentityVerification(userId, payload.documents || [], false);
    }
    
    const result = await this.workflowService.emit({
      urn: userId,
      event,
      payload
    });
    
    // Check if profile is now complete after UPDATE_PROFILE event
    if (event === UserEvent.UPDATE_PROFILE && 
        result.profileCompleteness >= 100 && 
        result.status === UserStatus.PROFILE_INCOMPLETE) {
      return await this.completeProfile(userId);
    }
    
    return result;
  }
  
  // Scheduled job to mark inactive users
  @Cron('0 0 * * *') // Run daily at midnight
  async markInactiveUsers(): Promise<void> {
    this.logger.log('Running inactive user check');
    
    const inactiveUsers = await this.userEntityService.findInactiveUsers(30);
    
    for (const user of inactiveUsers) {
      try {
        await this.workflowService.emit({
          urn: user.id,
          event: UserEvent.MARK_INACTIVE,
        });
      } catch (error) {
        this.logger.error(`Failed to mark user ${user.id} as inactive: ${error.message}`);
      }
    }
    
    this.logger.log(`Marked ${inactiveUsers.length} users as inactive`);
  }
  
  // Scheduled job to send reminders
  @Cron('0 10 * * *') // Run daily at 10 AM
  async sendOnboardingReminders(): Promise<void> {
    this.logger.log('Sending onboarding reminders');
    
    const incompleteUsers = await this.userEntityService.findByStatus(UserStatus.REGISTERED);
    incompleteUsers.push(...await this.userEntityService.findByStatus(UserStatus.EMAIL_VERIFIED));
    incompleteUsers.push(...await this.userEntityService.findByStatus(UserStatus.PROFILE_INCOMPLETE));
    
    let remindersSent = 0;
    
    for (const user of incompleteUsers) {
      if (user.shouldSendReminder()) {
        // This would trigger a reminder action in the workflow
        this.logger.log(`Sending reminder to user ${user.id}`);
        remindersSent++;
      }
    }
    
    this.logger.log(`Sent ${remindersSent} onboarding reminders`);
  }
}