import { Injectable, Logger } from '@nestjs/common';
import { User } from '../user.entity';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  
  async sendWelcomeEmail(user: User): Promise<void> {
    const verificationUrl = `https://example.com/verify-email?token=${user.verification.emailVerificationToken}`;
    
    await this.sendEmail(user.email, {
      subject: 'Welcome! Please verify your email',
      body: `
Hi ${user.profile.firstName || 'there'},

Welcome to our platform! We're excited to have you on board.

To get started, please verify your email address by clicking the link below:
${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account, please ignore this email.

Best regards,
The Team
      `,
    });
  }
  
  async sendEmailVerifiedConfirmation(user: User): Promise<void> {
    await this.sendEmail(user.email, {
      subject: 'Email verified successfully!',
      body: `
Hi ${user.profile.firstName},

Great! Your email has been verified successfully.

Next steps:
1. Complete your profile to unlock all features
2. Verify your identity for enhanced security
3. Explore our platform

Continue your onboarding: https://example.com/onboarding

Best regards,
The Team
      `,
    });
  }
  
  async sendIdentityVerificationStarted(user: User): Promise<void> {
    await this.sendEmail(user.email, {
      subject: 'Identity verification in progress',
      body: `
Hi ${user.profile.firstName},

We've received your identity verification documents and are reviewing them.

This process typically takes 1-2 business days. We'll notify you as soon as it's complete.

If we need any additional information, we'll reach out to you.

Best regards,
The Team
      `,
    });
  }
  
  async sendAccountActivated(user: User): Promise<void> {
    await this.sendEmail(user.email, {
      subject: 'Your account is now active! 🎉',
      body: `
Hi ${user.profile.firstName},

Congratulations! Your account is now fully activated.

You now have access to all features:
- Full platform access
- Premium features
- Priority support

Get started: https://example.com/dashboard

Best regards,
The Team
      `,
    });
  }
  
  async sendOnboardingTips(user: User): Promise<void> {
    await this.sendEmail(user.email, {
      subject: 'Getting started tips',
      body: `
Hi ${user.profile.firstName},

Here are some tips to help you get the most out of our platform:

1. Set up your preferences in Settings
2. Connect with other users in the Community
3. Check out our tutorial videos
4. Join our upcoming webinar

Resources: https://example.com/resources

Best regards,
The Team
      `,
    });
  }
  
  async sendAccountUnderReview(user: User): Promise<void> {
    await this.sendEmail(user.email, {
      subject: 'Your account is under review',
      body: `
Hi ${user.profile.firstName},

Your account is currently under review by our compliance team.

This is a routine process to ensure the safety and security of all users. We'll complete the review within 2-3 business days.

If you have any questions, please contact support@example.com.

Best regards,
The Team
      `,
    });
  }
  
  async sendOnboardingReminder(user: User): Promise<void> {
    const reminderMessages = [
      {
        subject: 'Complete your profile - you\'re almost there!',
        body: `Hi ${user.profile.firstName || 'there'}, You're just a few steps away from activating your account.`,
      },
      {
        subject: 'Don\'t forget to complete your registration',
        body: `Hi ${user.profile.firstName || 'there'}, We noticed you haven't finished setting up your account yet.`,
      },
      {
        subject: 'We miss you! Complete your account setup',
        body: `Hi ${user.profile.firstName || 'there'}, It's been a week since you started. Let us help you finish setting up.`,
      },
      {
        subject: 'Last chance to activate your account',
        body: `Hi ${user.profile.firstName || 'there'}, Your incomplete account will be marked as inactive soon.`,
      },
    ];
    
    const reminder = reminderMessages[Math.min(user.remindersSent, reminderMessages.length - 1)];
    
    await this.sendEmail(user.email, {
      subject: reminder.subject,
      body: `
${reminder.body}

Current progress: ${user.profileCompleteness}% complete

Continue where you left off: https://example.com/onboarding

Need help? Reply to this email and we'll assist you.

Best regards,
The Team
      `,
    });
  }
  
  async sendWinBackEmail(user: User): Promise<void> {
    await this.sendEmail(user.email, {
      subject: 'We\'d love to have you back!',
      body: `
Hi ${user.profile.firstName || 'there'},

We noticed you didn't complete your account setup. We'd love to have you as part of our community!

As a special offer, complete your registration in the next 48 hours and receive:
- 30 days of premium features free
- Priority support
- Exclusive onboarding assistance

Reactivate your account: https://example.com/reactivate?user=${user.id}

Best regards,
The Team
      `,
    });
  }
  
  async notifyComplianceTeam(user: User): Promise<void> {
    await this.sendEmail('compliance@example.com', {
      subject: `Manual review required - User ${user.id}`,
      body: `
A new user requires manual compliance review:

User ID: ${user.id}
Email: ${user.email}
Name: ${user.profile.firstName} ${user.profile.lastName}
Risk Level: ${user.riskAssessment?.level}
Risk Score: ${user.riskAssessment?.score}

Risk Factors:
${user.riskAssessment?.factors.join('\n')}

Review in admin panel: https://admin.example.com/users/${user.id}
      `,
    });
  }
  
  private async sendEmail(to: string, content: { subject: string; body: string }): Promise<void> {
    this.logger.log(`Sending email to ${to}: ${content.subject}`);
    // In production, integrate with email service provider
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}