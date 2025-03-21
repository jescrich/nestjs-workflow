import Stripe from 'stripe';
import { EntityService, WorkflowDefinition, WorkflowModule } from '@this/index';
import { Global, Injectable, Module } from '@nestjs/common';
import { WorkflowAction } from '@this/workflow/action.class.decorator';
import { OnEvent } from '@this/workflow/action.event.method.decorator';
import { Test, TestingModule } from '@nestjs/testing';
import { ModuleRef } from '@nestjs/core';

export class Subscription {
  email: string;
  stripeCustomerId: string;
  subscriptionId: string;
  subscriptionStatus: string;
  subscriptionPlan: string;
  subscriptionPriceId: string;
  trialActive: boolean;
  trialStart: Date;
  trialEnd: Date;
  apiCallsUsed: number;
  storageUsed: number;
  phoneNumber: string;
  status: string;
}

const repository: Subscription[] = [];

@Injectable()
class SubscriptionsRepository extends EntityService<Subscription, SubscriptionStatus> {
  async new(): Promise<Subscription> {
    return {
      email: '',
      stripeCustomerId: '',
      subscriptionId: '',
      subscriptionStatus: SubscriptionStatus.Pending,
      subscriptionPlan: '',
      subscriptionPriceId: '',
      trialActive: false,
      trialStart: new Date(),
      trialEnd: new Date(),
      apiCallsUsed: 0,
      storageUsed: 0,
      phoneNumber: '',
      status: '',
    };
  }
  update(entity: Subscription, status: SubscriptionStatus): Promise<Subscription> {
    const e = repository.find((s) => s.subscriptionId === entity.subscriptionId);
    if (!e) {
      throw new Error('Subscription not found');
    }
    e.subscriptionStatus = status;
    return Promise.resolve(e);
  }
  load(urn: string): Promise<Subscription | null> {
    return Promise.resolve(repository.find((s) => s.subscriptionId === urn) ?? null);
  }
  status(entity: Subscription): SubscriptionStatus {
    return entity.subscriptionStatus as SubscriptionStatus;
  }

  urn(entity: Subscription): string {
    return entity.subscriptionId;
  }
}
enum SubscriptionEvent {
  Create = 'subscription.create',
  Activate = 'subscription.activate',
  Cancel = 'subscriptions.cancel',
  Deactivate = 'subscription.deactivate',
}

enum StripeSubscriptionEvent {
  Created = 'customer.subscription.created',
  Updated = 'customer.subscription.updated',
  Deleted = 'customer.subscription.deleted',
  PaymentSucceeded = 'invoice.payment_succeeded',
  PaymentFailed = 'invoice.payment_failed',
  TrialWillEnd = 'customer.subscription.trial_will_end',
  PendingUpdateApplied = 'customer.subscription.pending_update_applied',
  PendingUpdateExpired = 'customer.subscription.pending_update_expired',
  Paused = 'customer.subscription.paused',
  Resumed = 'customer.subscription.resumed',
  InvoiceCreated = 'invoice.created',
  InvoiceFinalized = 'invoice.finalized',
  InvoiceVoided = 'invoice.voided',
  InvoicePaid = 'invoice.paid',
  InvoiceUpcoming = 'invoice.upcoming',
  InvoiceMarkedUncollectible = 'invoice.marked_uncollectible',
  InvoicePaymentActionRequired = 'invoice.payment_action_required',
  InvoiceSent = 'invoice.sent',
}

enum SubscriptionStatus {
  Pending = 'pending',
  Created = 'created',
  Active = 'active',
  Inactive = 'inactive',
  Overdue = 'overdue',
  Failed = 'failed',
  Expired = 'expired',
  Canceled = 'canceled',
}

@WorkflowAction()
@Injectable()
export class StripeSubscriptionsActions {
  constructor() {}

  @OnEvent({ event: StripeSubscriptionEvent.Created, order: 1 })
  async onSubscriptionCreated(event: string, data: Stripe.Subscription): Promise<void> {}

  @OnEvent({ event: StripeSubscriptionEvent.Updated, order: 1 })
  async onSubscriptionUpdated(event: string, data: Stripe.Subscription): Promise<void> {}

  @OnEvent({ event: StripeSubscriptionEvent.Deleted, order: 1 })
  async onSubscriptionDeleted(event: string, data: Stripe.Subscription): Promise<void> {}

  @OnEvent({ event: StripeSubscriptionEvent.PaymentSucceeded, order: 1 })
  async onSubscriptionPaymentSucceeded(event: string, data: Stripe.Subscription): Promise<void> {}

  @OnEvent({ event: StripeSubscriptionEvent.PaymentFailed, order: 1 })
  async onSubscriptionPaymentFailed(event: string, data: Stripe.Subscription): Promise<void> {}
}

const SubscriptionWorkflowDefinition: WorkflowDefinition<
  Subscription,
  Stripe.Subscription | Stripe.Invoice | any,
  SubscriptionEvent | StripeSubscriptionEvent,
  SubscriptionStatus
> = {
  FinalStates: [SubscriptionStatus.Active, SubscriptionStatus.Canceled, SubscriptionStatus.Expired],
  IdleStates: [SubscriptionStatus.Pending],
  FailedState: SubscriptionStatus.Failed,
  Entity: SubscriptionsRepository,
  Actions: [StripeSubscriptionsActions],
  Transitions: [
    {
      from: SubscriptionStatus.Pending,
      to: SubscriptionStatus.Created,
      event: SubscriptionEvent.Create,
    },
    {
      from: SubscriptionStatus.Created,
      to: SubscriptionStatus.Active,
      event: SubscriptionEvent.Activate,
    },
    {
      from: SubscriptionStatus.Active,
      to: SubscriptionStatus.Inactive,
      event: SubscriptionEvent.Deactivate,
    },
    {
      from: SubscriptionStatus.Active,
      to: SubscriptionStatus.Overdue,
      event: StripeSubscriptionEvent.PaymentFailed,
    },
    {
      from: SubscriptionStatus.Overdue,
      to: SubscriptionStatus.Active,
      event: StripeSubscriptionEvent.PaymentSucceeded,
    },
    {
      from: SubscriptionStatus.Overdue,
      to: SubscriptionStatus.Failed,
      event: StripeSubscriptionEvent.PaymentFailed,
    },
    {
      from: [SubscriptionStatus.Active, SubscriptionStatus.Overdue, SubscriptionStatus.Inactive],
      to: SubscriptionStatus.Canceled,
      event: SubscriptionEvent.Cancel,
    },
    {
      from: SubscriptionStatus.Failed,
      to: SubscriptionStatus.Expired,
      event: SubscriptionEvent.Deactivate,
    },
  ],
};

@Global()
@Module({
  imports: [
    WorkflowModule.register({
      name: 'SubscriptionsWorkflow',
      definition: SubscriptionWorkflowDefinition,
    }),
  ],
  providers: [StripeSubscriptionsActions],
  exports: [StripeSubscriptionsActions],
})
export class CustomModel {}

describe('Stripe Subscription Workflow', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [CustomModel],
    }).compile();
  });

  it('should instantiate then resolve workflow instance.', async () => {
    const orderWorkflow = module.get('SubscriptionsWorkflow');
    expect(orderWorkflow).toBeDefined();
  });
});
