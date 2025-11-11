export enum UserStatus {
  REGISTERED = 'registered',
  EMAIL_VERIFIED = 'email_verified',
  PROFILE_INCOMPLETE = 'profile_incomplete',
  PROFILE_COMPLETE = 'profile_complete',
  IDENTITY_VERIFICATION_PENDING = 'identity_verification_pending',
  IDENTITY_VERIFIED = 'identity_verified',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  INACTIVE = 'inactive',
}

export enum UserEvent {
  REGISTER = 'user.register',
  VERIFY_EMAIL = 'user.verify.email',
  UPDATE_PROFILE = 'user.update.profile',
  COMPLETE_PROFILE = 'user.complete.profile',
  START_IDENTITY_VERIFICATION = 'user.identity.start',
  COMPLETE_IDENTITY_VERIFICATION = 'user.identity.complete',
  FAIL_IDENTITY_VERIFICATION = 'user.identity.fail',
  ACTIVATE = 'user.activate',
  SUSPEND = 'user.suspend',
  REACTIVATE = 'user.reactivate',
  MARK_INACTIVE = 'user.mark.inactive',
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
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

export interface VerificationData {
  emailVerified: boolean;
  emailVerifiedAt?: Date;
  emailVerificationToken?: string;
  phoneVerified: boolean;
  phoneVerifiedAt?: Date;
  identityVerificationStatus?: 'pending' | 'completed' | 'failed' | 'manual_review';
  identityVerificationId?: string;
  identityVerificationCompletedAt?: Date;
  documentsSubmitted?: string[];
}

export interface RiskAssessment {
  score: number; // 0-100
  level: 'low' | 'medium' | 'high';
  factors: string[];
  requiresManualReview: boolean;
  assessedAt: Date;
}

export class User {
  id: string;
  email: string;
  username: string;
  status: UserStatus;
  
  // Profile
  profile: UserProfile;
  profileCompleteness: number; // 0-100
  
  // Verification
  verification: VerificationData;
  
  // Risk & Compliance
  riskAssessment?: RiskAssessment;
  complianceNotes?: string[];
  
  // Tracking
  registeredAt: Date;
  lastActivityAt: Date;
  onboardingStartedAt: Date;
  onboardingCompletedAt?: Date;
  
  // Communications
  welcomeEmailSent: boolean;
  remindersSent: number;
  lastReminderSentAt?: Date;
  
  // Metadata
  source: 'web' | 'mobile' | 'api' | 'partner';
  referralCode?: string;
  marketingCampaign?: string;
  
  constructor() {
    this.id = '';
    this.email = '';
    this.username = '';
    this.status = UserStatus.REGISTERED;
    this.profile = {} as UserProfile;
    this.profileCompleteness = 0;
    this.verification = {
      emailVerified: false,
      phoneVerified: false,
    };
    this.welcomeEmailSent = false;
    this.remindersSent = 0;
    this.registeredAt = new Date();
    this.lastActivityAt = new Date();
    this.onboardingStartedAt = new Date();
    this.source = 'web';
  }
  
  calculateProfileCompleteness(): number {
    let score = 0;
    const weights = {
      firstName: 10,
      lastName: 10,
      dateOfBirth: 10,
      phoneNumber: 15,
      address: 20,
      occupation: 10,
      company: 10,
      bio: 5,
      preferences: 10,
    };
    
    if (this.profile.firstName) score += weights.firstName;
    if (this.profile.lastName) score += weights.lastName;
    if (this.profile.dateOfBirth) score += weights.dateOfBirth;
    if (this.profile.phoneNumber) score += weights.phoneNumber;
    if (this.profile.address?.street) score += weights.address;
    if (this.profile.occupation) score += weights.occupation;
    if (this.profile.company) score += weights.company;
    if (this.profile.bio) score += weights.bio;
    if (this.profile.preferences) score += weights.preferences;
    
    this.profileCompleteness = score;
    return score;
  }
  
  isHighRisk(): boolean {
    return this.riskAssessment?.level === 'high' || 
           this.riskAssessment?.requiresManualReview === true;
  }
  
  getDaysSinceRegistration(): number {
    return Math.floor((new Date().getTime() - this.registeredAt.getTime()) / (1000 * 60 * 60 * 24));
  }
  
  shouldSendReminder(): boolean {
    // Send reminders at 1, 3, 7, and 14 days if not completed
    const daysSinceRegistration = this.getDaysSinceRegistration();
    const reminderDays = [1, 3, 7, 14];
    
    return reminderDays.includes(daysSinceRegistration) && 
           this.remindersSent < 4 &&
           this.status !== UserStatus.ACTIVE;
  }
}