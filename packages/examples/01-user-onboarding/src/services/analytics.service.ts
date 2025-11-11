import { Injectable, Logger } from '@nestjs/common';

interface AnalyticsEvent {
  name: string;
  properties: Record<string, any>;
  timestamp: Date;
  userId?: string;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private events: AnalyticsEvent[] = [];
  
  async trackEvent(name: string, properties: Record<string, any>): Promise<void> {
    const event: AnalyticsEvent = {
      name,
      properties,
      timestamp: new Date(),
      userId: properties.userId,
    };
    
    this.events.push(event);
    this.logger.log(`Analytics event: ${name}`, properties);
    
    // In production, send to analytics services like:
    // - Mixpanel
    // - Amplitude
    // - Segment
    // - Google Analytics
  }
  
  async getOnboardingFunnel(startDate?: Date, endDate?: Date): Promise<{
    stage: string;
    count: number;
    percentage: number;
  }[]> {
    const stages = [
      'user_registered',
      'email_verified',
      'profile_started',
      'profile_completed',
      'identity_verification_started',
      'identity_verified',
      'onboarding_completed',
    ];
    
    const funnel = stages.map((stage, index) => {
      const count = this.events.filter(e => e.name === stage).length;
      const percentage = index === 0 ? 100 : (count / this.events.filter(e => e.name === stages[0]).length) * 100;
      
      return { stage, count, percentage };
    });
    
    return funnel;
  }
  
  async getAverageTimeToComplete(): Promise<{
    stage: string;
    averageHours: number;
  }[]> {
    const stageTimings = [
      { from: 'user_registered', to: 'email_verified' },
      { from: 'email_verified', to: 'profile_completed' },
      { from: 'profile_completed', to: 'identity_verified' },
      { from: 'identity_verified', to: 'onboarding_completed' },
    ];
    
    return stageTimings.map(({ from, to }) => {
      const fromEvents = this.events.filter(e => e.name === from);
      const toEvents = this.events.filter(e => e.name === to);
      
      let totalHours = 0;
      let count = 0;
      
      fromEvents.forEach(fromEvent => {
        const toEvent = toEvents.find(e => 
          e.userId === fromEvent.userId && 
          e.timestamp > fromEvent.timestamp
        );
        
        if (toEvent) {
          const hours = (toEvent.timestamp.getTime() - fromEvent.timestamp.getTime()) / (1000 * 60 * 60);
          totalHours += hours;
          count++;
        }
      });
      
      return {
        stage: `${from} → ${to}`,
        averageHours: count > 0 ? totalHours / count : 0,
      };
    });
  }
  
  async getDropoffReasons(): Promise<{
    reason: string;
    count: number;
  }[]> {
    const abandonedEvents = this.events.filter(e => e.name === 'onboarding_abandoned');
    
    const reasons = new Map<string, number>();
    
    abandonedEvents.forEach(event => {
      const lastStatus = event.properties.lastStatus;
      const completeness = event.properties.profileCompleteness;
      
      let reason = 'Unknown';
      if (lastStatus === 'registered') {
        reason = 'Never verified email';
      } else if (lastStatus === 'email_verified' && completeness < 50) {
        reason = 'Abandoned during profile creation';
      } else if (lastStatus === 'profile_incomplete') {
        reason = 'Did not complete profile';
      } else if (lastStatus === 'profile_complete') {
        reason = 'Did not start identity verification';
      }
      
      reasons.set(reason, (reasons.get(reason) || 0) + 1);
    });
    
    return Array.from(reasons.entries()).map(([reason, count]) => ({ reason, count }));
  }
  
  async getUserSourceMetrics(): Promise<{
    source: string;
    registrations: number;
    completions: number;
    conversionRate: number;
  }[]> {
    const sources = ['web', 'mobile', 'api', 'partner'];
    
    return sources.map(source => {
      const registrations = this.events.filter(e => 
        e.name === 'user_registered' && 
        e.properties.source === source
      ).length;
      
      const completions = this.events.filter(e => 
        e.name === 'onboarding_completed' && 
        e.properties.source === source
      ).length;
      
      return {
        source,
        registrations,
        completions,
        conversionRate: registrations > 0 ? (completions / registrations) * 100 : 0,
      };
    });
  }
  
  async getRiskDistribution(): Promise<{
    level: string;
    count: number;
    percentage: number;
  }[]> {
    const riskEvents = this.events.filter(e => e.name === 'identity_verified');
    const total = riskEvents.length;
    
    const distribution = ['low', 'medium', 'high'].map(level => {
      const count = riskEvents.filter(e => e.properties.riskLevel === level).length;
      
      return {
        level,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      };
    });
    
    return distribution;
  }
}