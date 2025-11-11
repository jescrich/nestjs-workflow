import { Injectable, Logger } from '@nestjs/common';
import { EntityService } from '@jescrich/nestjs-workflow';
import { User, UserStatus } from './user.entity';

// Simulated database
const userDatabase = new Map<string, User>();

@Injectable()
export class UserEntityService extends EntityService<User, UserStatus> {
  private readonly logger = new Logger(UserEntityService.name);
  
  async new(): Promise<User> {
    const user = new User();
    user.id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.logger.log(`Created new user with ID: ${user.id}`);
    return user;
  }
  
  async update(entity: User, status: UserStatus): Promise<User> {
    entity.status = status;
    entity.lastActivityAt = new Date();
    
    // Track onboarding completion
    if (status === UserStatus.ACTIVE && !entity.onboardingCompletedAt) {
      entity.onboardingCompletedAt = new Date();
      const durationDays = Math.floor(
        (entity.onboardingCompletedAt.getTime() - entity.onboardingStartedAt.getTime()) / 
        (1000 * 60 * 60 * 24)
      );
      this.logger.log(`User ${entity.id} completed onboarding in ${durationDays} days`);
    }
    
    // Save to database
    userDatabase.set(entity.id, entity);
    
    this.logger.log(`Updated user ${entity.id} status to: ${status}`);
    return entity;
  }
  
  async load(urn: string): Promise<User | null> {
    const user = userDatabase.get(urn);
    
    if (!user) {
      this.logger.warn(`User not found: ${urn}`);
      return null;
    }
    
    this.logger.log(`Loaded user: ${urn}`);
    return user;
  }
  
  status(entity: User): UserStatus {
    return entity.status;
  }
  
  urn(entity: User): string {
    return entity.id;
  }
  
  // Additional helper methods
  
  async save(user: User): Promise<User> {
    user.lastActivityAt = new Date();
    userDatabase.set(user.id, user);
    this.logger.log(`Saved user: ${user.id}`);
    return user;
  }
  
  async findByEmail(email: string): Promise<User | null> {
    for (const user of userDatabase.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }
  
  async findByStatus(status: UserStatus): Promise<User[]> {
    const users: User[] = [];
    userDatabase.forEach(user => {
      if (user.status === status) {
        users.push(user);
      }
    });
    return users;
  }
  
  async findInactiveUsers(daysSinceLastActivity: number): Promise<User[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceLastActivity);
    
    const inactiveUsers: User[] = [];
    userDatabase.forEach(user => {
      if (user.lastActivityAt < cutoffDate && user.status !== UserStatus.ACTIVE) {
        inactiveUsers.push(user);
      }
    });
    
    return inactiveUsers;
  }
  
  async getOnboardingMetrics(): Promise<any> {
    const metrics = {
      total: 0,
      byStatus: {} as Record<UserStatus, number>,
      completed: 0,
      abandoned: 0,
      averageCompletionTimeDays: 0,
      conversionRate: 0,
    };
    
    const completionTimes: number[] = [];
    
    userDatabase.forEach(user => {
      metrics.total++;
      
      // Count by status
      metrics.byStatus[user.status] = (metrics.byStatus[user.status] || 0) + 1;
      
      // Count completed
      if (user.status === UserStatus.ACTIVE) {
        metrics.completed++;
        
        if (user.onboardingCompletedAt) {
          const days = Math.floor(
            (user.onboardingCompletedAt.getTime() - user.onboardingStartedAt.getTime()) /
            (1000 * 60 * 60 * 24)
          );
          completionTimes.push(days);
        }
      }
      
      // Count abandoned
      if (user.status === UserStatus.INACTIVE) {
        metrics.abandoned++;
      }
    });
    
    // Calculate averages
    if (completionTimes.length > 0) {
      metrics.averageCompletionTimeDays = 
        completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length;
    }
    
    if (metrics.total > 0) {
      metrics.conversionRate = (metrics.completed / metrics.total) * 100;
    }
    
    return metrics;
  }
}