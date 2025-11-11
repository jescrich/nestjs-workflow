import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './user.entity';

@Controller('users')
export class UserController {
  private readonly logger = new Logger(UserController.name);
  
  constructor(private readonly userService: UserService) {}
  
  @Post('register')
  async register(@Body() registerDto: any): Promise<{
    user: User;
    message: string;
  }> {
    try {
      const user = await this.userService.registerUser(registerDto);
      return {
        user,
        message: 'Registration successful. Please check your email to verify your account.',
      };
    } catch (error) {
      this.logger.error(`Registration failed: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
  
  @Get('verify-email')
  async verifyEmail(
    @Query('userId') userId: string,
    @Query('token') token: string,
  ): Promise<{
    user: User;
    message: string;
  }> {
    try {
      const user = await this.userService.verifyEmail(userId, token);
      return {
        user,
        message: 'Email verified successfully! Please complete your profile.',
      };
    } catch (error) {
      this.logger.error(`Email verification failed: ${error.message}`);
      throw new HttpException('Invalid or expired verification link', HttpStatus.BAD_REQUEST);
    }
  }
  
  @Put(':id/profile')
  async updateProfile(
    @Param('id') id: string,
    @Body() updateProfileDto: any,
  ): Promise<User> {
    try {
      return await this.userService.updateProfile(id, updateProfileDto);
    } catch (error) {
      this.logger.error(`Profile update failed: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
  
  @Post(':id/verify-identity')
  async startIdentityVerification(
    @Param('id') id: string,
    @Body('documents') documents: string[],
  ): Promise<{
    user: User;
    message: string;
  }> {
    try {
      const user = await this.userService.startIdentityVerification(id, documents);
      return {
        user,
        message: 'Identity verification started. This process typically takes 1-2 business days.',
      };
    } catch (error) {
      this.logger.error(`Identity verification failed: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
  
  @Get(':id')
  async getUser(@Param('id') id: string): Promise<User> {
    const user = await this.userService.getUser(id);
    
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    
    return user;
  }
  
  @Get('email/:email')
  async getUserByEmail(@Param('email') email: string): Promise<User> {
    const user = await this.userService.getUserByEmail(email);
    
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    
    return user;
  }
  
  @Put(':id/suspend')
  async suspendUser(
    @Param('id') id: string,
    @Body('reason') reason: string,
  ): Promise<User> {
    try {
      return await this.userService.suspendUser(id, reason);
    } catch (error) {
      this.logger.error(`Failed to suspend user: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
  
  @Put(':id/reactivate')
  async reactivateUser(
    @Param('id') id: string,
    @Body('approvedBy') approvedBy: string,
  ): Promise<User> {
    try {
      return await this.userService.reactivateUser(id, approvedBy);
    } catch (error) {
      this.logger.error(`Failed to reactivate user: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
  
  @Get('metrics/onboarding')
  async getOnboardingMetrics(): Promise<any> {
    return await this.userService.getOnboardingMetrics();
  }
  
  // Admin endpoints
  
  @Post('admin/process-inactive')
  async processInactiveUsers(): Promise<{
    message: string;
  }> {
    try {
      await this.userService.markInactiveUsers();
      return {
        message: 'Inactive user processing completed',
      };
    } catch (error) {
      this.logger.error(`Failed to process inactive users: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  
  @Post('admin/send-reminders')
  async sendReminders(): Promise<{
    message: string;
  }> {
    try {
      await this.userService.sendOnboardingReminders();
      return {
        message: 'Reminders sent successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to send reminders: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}