import { Injectable, Logger } from '@nestjs/common';
import { Order, PaymentMethod } from '../order.entity';

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  async processPayment(order: Order): Promise<PaymentResult> {
    this.logger.log(`Processing payment of $${order.total} for order ${order.orderNumber}`);
    
    // Simulate payment processing with different success rates based on method
    const successRate = this.getPaymentSuccessRate(order.payment?.method);
    const success = Math.random() < successRate;
    
    // Simulate processing delay
    await this.delay(1000 + Math.random() * 2000);
    
    if (success) {
      return {
        success: true,
        transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
    } else {
      return {
        success: false,
        error: this.getRandomPaymentError()
      };
    }
  }

  async refund(order: Order, amount?: number): Promise<PaymentResult> {
    const refundAmount = amount || order.total;
    this.logger.log(`Processing refund of $${refundAmount} for order ${order.orderNumber}`);
    
    // Simulate refund processing
    await this.delay(1000 + Math.random() * 1000);
    
    return {
      success: true,
      transactionId: `REF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  }

  private getPaymentSuccessRate(method?: PaymentMethod): number {
    switch (method) {
      case PaymentMethod.CREDIT_CARD:
        return 0.85; // 85% success rate
      case PaymentMethod.DEBIT_CARD:
        return 0.90; // 90% success rate
      case PaymentMethod.PAYPAL:
        return 0.95; // 95% success rate
      case PaymentMethod.BANK_TRANSFER:
        return 0.98; // 98% success rate
      case PaymentMethod.CASH_ON_DELIVERY:
        return 1.0; // Always succeeds (payment later)
      default:
        return 0.8;
    }
  }

  private getRandomPaymentError(): string {
    const errors = [
      'Insufficient funds',
      'Card declined',
      'Invalid card number',
      'Card expired',
      'Transaction limit exceeded',
      'Bank connection timeout',
      'Fraud detection triggered',
      'Invalid CVV'
    ];
    
    return errors[Math.floor(Math.random() * errors.length)];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}