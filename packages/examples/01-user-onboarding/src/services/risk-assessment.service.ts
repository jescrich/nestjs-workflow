import { Injectable, Logger } from '@nestjs/common';
import { User } from '../user.entity';

@Injectable()
export class RiskAssessmentService {
  private readonly logger = new Logger(RiskAssessmentService.name);
  
  async performEnhancedDueDiligence(user: User): Promise<{
    passed: boolean;
    findings: string[];
    recommendedAction: 'approve' | 'review' | 'reject';
  }> {
    this.logger.log(`Performing enhanced due diligence for user ${user.id}`);
    
    const findings: string[] = [];
    
    // Check various risk factors
    if (user.riskAssessment?.score && user.riskAssessment.score > 70) {
      findings.push('High risk score detected');
    }
    
    // Check PEP (Politically Exposed Person) status
    const isPEP = await this.checkPEPStatus(user);
    if (isPEP) {
      findings.push('User is a politically exposed person');
    }
    
    // Check adverse media
    const adverseMedia = await this.checkAdverseMedia(user);
    if (adverseMedia.found) {
      findings.push(`Adverse media found: ${adverseMedia.summary}`);
    }
    
    // Determine recommendation
    let recommendedAction: 'approve' | 'review' | 'reject';
    if (findings.length === 0) {
      recommendedAction = 'approve';
    } else if (findings.length <= 2 && !isPEP) {
      recommendedAction = 'review';
    } else {
      recommendedAction = 'reject';
    }
    
    return {
      passed: recommendedAction === 'approve',
      findings,
      recommendedAction,
    };
  }
  
  private async checkPEPStatus(user: User): Promise<boolean> {
    // Simulate PEP check
    // In production, integrate with PEP databases
    
    const commonPEPLastNames = ['Johnson', 'Smith', 'Williams']; // Example
    return commonPEPLastNames.includes(user.profile.lastName) && Math.random() < 0.05;
  }
  
  private async checkAdverseMedia(user: User): Promise<{
    found: boolean;
    summary?: string;
    sources?: string[];
  }> {
    // Simulate adverse media check
    // In production, integrate with news APIs and screening services
    
    if (Math.random() < 0.03) {
      return {
        found: true,
        summary: 'Financial misconduct allegations',
        sources: ['Financial Times', 'Reuters'],
      };
    }
    
    return { found: false };
  }
  
  async calculateFraudScore(user: User): Promise<number> {
    let score = 0;
    
    // Email analysis
    const emailScore = this.analyzeEmail(user.email);
    score += emailScore * 0.2;
    
    // Name analysis
    const nameScore = this.analyzeName(user.profile.firstName, user.profile.lastName);
    score += nameScore * 0.1;
    
    // Phone analysis
    if (user.profile.phoneNumber) {
      const phoneScore = this.analyzePhone(user.profile.phoneNumber);
      score += phoneScore * 0.15;
    }
    
    // Address analysis
    if (user.profile.address) {
      const addressScore = this.analyzeAddress(user.profile.address);
      score += addressScore * 0.15;
    }
    
    // Behavioral analysis
    const behaviorScore = this.analyzeBehavior(user);
    score += behaviorScore * 0.4;
    
    return Math.min(100, Math.max(0, score));
  }
  
  private analyzeEmail(email: string): number {
    let score = 0;
    
    // Check for suspicious patterns
    if (email.includes('test') || email.includes('temp')) score += 20;
    if (email.match(/\d{5,}/)) score += 15; // Many numbers
    if (email.split('@')[0].length < 3) score += 10; // Very short username
    
    // Check domain reputation
    const domain = email.split('@')[1];
    const suspiciousDomains = ['guerrillamail.com', 'tempmail.com', 'mailinator.com'];
    if (suspiciousDomains.includes(domain)) score += 50;
    
    return score;
  }
  
  private analyzeName(firstName: string, lastName: string): number {
    let score = 0;
    
    // Check for random characters
    if (!firstName || !lastName) score += 20;
    if (firstName.match(/[0-9]/) || lastName.match(/[0-9]/)) score += 30;
    if (firstName.length < 2 || lastName.length < 2) score += 15;
    
    // Check for keyboard patterns
    const keyboardPatterns = ['qwerty', 'asdf', 'zxcv'];
    const fullName = (firstName + lastName).toLowerCase();
    if (keyboardPatterns.some(pattern => fullName.includes(pattern))) score += 25;
    
    return score;
  }
  
  private analyzePhone(phone: string): number {
    let score = 0;
    
    // Check for VOIP numbers (simplified)
    if (phone.startsWith('+1555')) score += 20; // Example VOIP pattern
    
    // Check for sequential numbers
    if (phone.match(/(\d)\1{4,}/)) score += 15; // Repeated digits
    
    return score;
  }
  
  private analyzeAddress(address: any): number {
    let score = 0;
    
    // Check for PO Box
    if (address.street.toLowerCase().includes('po box')) score += 10;
    
    // Check for suspicious addresses
    if (address.street.toLowerCase().includes('test')) score += 20;
    
    // Check high-risk countries
    const highRiskCountries = ['XX', 'YY']; // Placeholder
    if (highRiskCountries.includes(address.country)) score += 30;
    
    return score;
  }
  
  private analyzeBehavior(user: User): number {
    let score = 0;
    
    // Quick registration to verification
    const hoursToVerify = user.verification.emailVerifiedAt ? 
      (user.verification.emailVerifiedAt.getTime() - user.registeredAt.getTime()) / (1000 * 60 * 60) : 
      999;
    
    if (hoursToVerify < 0.1) score += 15; // Very quick verification
    
    // Check time patterns
    const registrationHour = user.registeredAt.getHours();
    if (registrationHour >= 0 && registrationHour <= 4) score += 10; // Late night registration
    
    return score;
  }
}