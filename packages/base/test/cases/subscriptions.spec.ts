import Stripe from 'stripe';
import { EntityService, WorkflowDefinition, WorkflowModule, WorkflowService  } from '@this/index';
import { Global, Injectable, Module } from '@nestjs/common';
import { WorkflowAction } from '@this/workflow/action.class.decorator';
import { OnEvent } from '@this/workflow/action.event.method.decorator';
import { Test, TestingModule } from '@nestjs/testing';

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

let repository: Subscription[] = [];

@Injectable()
class SubscriptionsRepository extends EntityService<Subscription, SubscriptionStatus> {

  clear() {
    repository = [];
  }

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
    let e = repository.find((s) => s.subscriptionId === entity.subscriptionId);
    if (!e) {
      e = entity;
      repository.push(e);
    } else {
      Object.assign(e, entity);
      e.subscriptionStatus = status;
    }
    return Promise.resolve(e);
  }
  load(urn: string): Promise<Subscription | null> {
   const e = repository.find((s) => s.subscriptionId === urn);
   if (!e) {
    throw new Error(`Subscription not found: ${urn}`);
   }
   return Promise.resolve(e);
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
  constructor() { }

  @OnEvent({ event: StripeSubscriptionEvent.Created, order: 1 })
  async onSubscriptionCreated(params: { entity: Subscription; payload: Stripe.Subscription }): Promise<Subscription> {
    const { entity, payload } = params;
    entity.subscriptionId = payload.id;
    entity.subscriptionStatus = payload.status;
    return entity;
  }

  @OnEvent({ event: StripeSubscriptionEvent.Updated, order: 1 })
  async onSubscriptionUpdated(params: { entity: Subscription; payload: Stripe.Subscription }): Promise<Subscription> {
    const { entity, payload } = params;
    entity.subscriptionStatus = payload.status;
    return entity;
  }

  @OnEvent({ event: StripeSubscriptionEvent.Deleted, order: 1 })
  async onSubscriptionDeleted(params: { entity: Subscription; payload: Stripe.Subscription }): Promise<Subscription> {
    const { entity, payload } = params;
    entity.subscriptionStatus = SubscriptionStatus.Canceled;
    return entity;
  }

  @OnEvent({ event: StripeSubscriptionEvent.PaymentSucceeded, order: 1 })
  async onSubscriptionPaymentSucceeded(params: { entity: Subscription; payload: Stripe.Invoice }): Promise<Subscription> {
    const { entity, payload } = params;
    // Logic for successful payment
    return entity;
  }

  @OnEvent({ event: StripeSubscriptionEvent.PaymentFailed, order: 1 })
  async onSubscriptionPaymentFailed(params: { entity: Subscription; payload: Stripe.Invoice }): Promise<Subscription> {
    const { entity, payload } = params;
    // Logic for failed payment
    return entity;
  }
}

const SubscriptionWorkflowDefinition: WorkflowDefinition<
  Subscription,
  Stripe.Subscription | Stripe.Invoice | any,
  SubscriptionEvent | StripeSubscriptionEvent,
  SubscriptionStatus
> = {
  states: {
    finals:[SubscriptionStatus.Active, SubscriptionStatus.Canceled, SubscriptionStatus.Expired],
    idles: [SubscriptionStatus.Pending, SubscriptionStatus.Created, SubscriptionStatus.Active, SubscriptionStatus.Overdue, SubscriptionStatus.Canceled, SubscriptionStatus.Failed],
    failed: SubscriptionStatus.Failed,
  },
  entity: SubscriptionsRepository,
  actions: [StripeSubscriptionsActions],
  transitions: [
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
      from: SubscriptionStatus.Pending,
      to: SubscriptionStatus.Active,
      event: StripeSubscriptionEvent.Created,
    },
    {
      from: SubscriptionStatus.Active,
      to: SubscriptionStatus.Overdue,
      event: StripeSubscriptionEvent.Updated,
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
      providers: [
        {
          provide: SubscriptionsRepository,
          useClass: SubscriptionsRepository,
        },
        {
          provide: EntityService,
          useExisting: SubscriptionsRepository,
        },
      ],
    }),
  ],
  providers: [StripeSubscriptionsActions, {
    provide: EntityService<Subscription, SubscriptionStatus>,
    useClass: SubscriptionsRepository,
  },],
  exports: [StripeSubscriptionsActions, 
    {
      provide: EntityService<Subscription, SubscriptionStatus>,
      useClass: SubscriptionsRepository,
    },
  ],
})
export class CustomModule { }

describe('Stripe Subscription Workflow', () => {
  let module: TestingModule;
  let workflowService: WorkflowService<Subscription, any, SubscriptionEvent | StripeSubscriptionEvent, SubscriptionStatus>;
  let subscriptionsActions: StripeSubscriptionsActions;
  let repository: SubscriptionsRepository;
  let testSubscription: Subscription;

  beforeEach(async () => {
    
    
    module = await Test.createTestingModule({
      imports: [CustomModule],
    }).compile();

    workflowService = module.get('SubscriptionsWorkflow');
    subscriptionsActions = module.get(StripeSubscriptionsActions);
    repository = module.get(EntityService<Subscription, SubscriptionStatus>);
    
    // Initialize the workflow service
    await workflowService.onModuleInit();
    
    // Clear repository before each test
    repository.clear();

    // Create a test subscription
    testSubscription = {
      email: 'test@example.com',
      stripeCustomerId: 'cus_123456',
      subscriptionId: 'sub_123456',
      subscriptionStatus: SubscriptionStatus.Pending,
      subscriptionPlan: 'basic',
      subscriptionPriceId: 'price_123456',
      trialActive: false,
      trialStart: new Date(),
      trialEnd: new Date(),
      apiCallsUsed: 0,
      storageUsed: 0,
      phoneNumber: '1234567890',
      status: '',
    };
    
    // Add to repository
    repository.update(testSubscription, SubscriptionStatus.Pending);
  });

  it('should instantiate the workflow instance', () => {
    expect(workflowService).toBeDefined();
    expect(subscriptionsActions).toBeDefined();
  });

  // Test StripeSubscriptionsActions methods
  describe('StripeSubscriptionsActions', () => {
    it('should handle subscription created event', async () => {
      const stripeSubscription = { id: 'sub_new123', status: 'active' } as Stripe.Subscription;
      const result = await subscriptionsActions.onSubscriptionCreated({ 
        entity: testSubscription, 
        payload: stripeSubscription 
      });
      
      expect(result.subscriptionId).toBe('sub_new123');
      expect(result.subscriptionStatus).toBe('active');
    });

    it('should handle subscription updated event', async () => {
      const stripeSubscription = { id: 'sub_123456', status: 'past_due' } as Stripe.Subscription;
      const result = await subscriptionsActions.onSubscriptionUpdated({ 
        entity: testSubscription, 
        payload: stripeSubscription 
      });
      
      expect(result.subscriptionStatus).toBe('past_due');
    });

    it('should handle subscription deleted event', async () => {
      const stripeSubscription = { id: 'sub_123456' } as Stripe.Subscription;
      const result = await subscriptionsActions.onSubscriptionDeleted({ 
        entity: testSubscription, 
        payload: stripeSubscription 
      });
      
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.Canceled);
    });

    it('should handle payment succeeded event', async () => {
      const stripeInvoice = { id: 'inv_123' } as Stripe.Invoice;
      const result = await subscriptionsActions.onSubscriptionPaymentSucceeded({ 
        entity: testSubscription, 
        payload: stripeInvoice 
      });
      
      expect(result).toBeDefined();
    });

    it('should handle payment failed event', async () => {
      const stripeInvoice = { id: 'inv_123' } as Stripe.Invoice;
      const result = await subscriptionsActions.onSubscriptionPaymentFailed({ 
        entity: testSubscription, 
        payload: stripeInvoice 
      });
      
      expect(result).toBeDefined();
    });
  });

  // Test valid transitions
  describe('Valid Workflow Transitions', () => {
    it('should transition from Pending to Created', async () => {
      const result = await workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: SubscriptionEvent.Create
      });
      
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.Created);
    });

    it('should transition from Created to Active', async () => {
      // First transition to Created
      testSubscription.subscriptionStatus = SubscriptionStatus.Created;
      
      const result = await workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: SubscriptionEvent.Activate
      });
      
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.Active);
    });

    it('should transition from Active to Canceled due to deactivation', async () => {
      testSubscription.subscriptionStatus = SubscriptionStatus.Active;
      
      const result = await workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: SubscriptionEvent.Deactivate
      });
      
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.Canceled);
    });

    it('should transition from Active to Overdue on payment failure', async () => {
      testSubscription.subscriptionStatus = SubscriptionStatus.Active;
      
      const result = await workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: StripeSubscriptionEvent.PaymentFailed
      });
      
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.Overdue);
    });

    it('should transition from Overdue to Active on payment success', async () => {
      testSubscription.subscriptionStatus = SubscriptionStatus.Overdue;
      
      const result = await workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: StripeSubscriptionEvent.PaymentSucceeded
      });
      
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.Active);
    });

    it('should transition from Overdue to Failed on repeated payment failure', async () => {
      testSubscription.subscriptionStatus = SubscriptionStatus.Overdue;
      
      const result = await workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: StripeSubscriptionEvent.PaymentFailed
      });
      
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.Failed);
    });

    it('should transition from Active to Canceled', async () => {
      testSubscription.subscriptionStatus = SubscriptionStatus.Active;
      
      const result = await workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: SubscriptionEvent.Cancel
      });
      
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.Canceled);
    });

    it('should transition from Overdue to Canceled', async () => {
      testSubscription.subscriptionStatus = SubscriptionStatus.Overdue;
      
      const result = await workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: SubscriptionEvent.Cancel
      });
      
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.Canceled);
    });

    it('should transition from Inactive to Canceled', async () => {
      testSubscription.subscriptionStatus = SubscriptionStatus.Inactive;
      
      const result = await workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: SubscriptionEvent.Cancel
      });
      
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.Canceled);
    });

    it('should transition from Failed to Expired', async () => {
      testSubscription.subscriptionStatus = SubscriptionStatus.Failed;
      
      const result = await workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: SubscriptionEvent.Deactivate
      });
      
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.Expired);
    });
  });

  // Test invalid transitions
  describe('Invalid Workflow Transitions', () => {
    it('should not transition from Pending to Active directly', async () => {
      testSubscription.subscriptionStatus = SubscriptionStatus.Pending;
      
      await expect(workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: SubscriptionEvent.Activate
      })).rejects.toThrow();
      
      expect(testSubscription.subscriptionStatus).toBe(SubscriptionStatus.Pending);
    });

    it('should not transition from Pending to Canceled directly', async () => {
      testSubscription.subscriptionStatus = SubscriptionStatus.Pending;
      
      await expect(workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: SubscriptionEvent.Cancel
      })).rejects.toThrow();
      
      expect(testSubscription.subscriptionStatus).toBe(SubscriptionStatus.Pending);
    });

    it('should not transition from Created to Overdue directly', async () => {
      testSubscription.subscriptionStatus = SubscriptionStatus.Created;
      
      await expect(workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: StripeSubscriptionEvent.PaymentFailed
      })).rejects.toThrow();
      
      expect(testSubscription.subscriptionStatus).toBe(SubscriptionStatus.Created);
    });

    it('should not transition from Canceled to any other state', async () => {
      testSubscription.subscriptionStatus = SubscriptionStatus.Canceled;
      
      await expect(workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: SubscriptionEvent.Activate
      })).rejects.toThrow();
      
      expect(testSubscription.subscriptionStatus).toBe(SubscriptionStatus.Canceled);
    });

    it('should not transition from Expired to any other state', async () => {
      testSubscription.subscriptionStatus = SubscriptionStatus.Expired;
      
      await expect(workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: SubscriptionEvent.Activate
      })).rejects.toThrow();
      
      expect(testSubscription.subscriptionStatus).toBe(SubscriptionStatus.Expired);
    });
  });

  // Test complex transition sequences
  describe('Complex Transition Sequences', () => {
    it('should handle full subscription lifecycle: Pending -> Created -> Active -> Overdue -> Active -> Canceled', async () => {
      testSubscription.subscriptionStatus = SubscriptionStatus.Pending;
      
      // Pending to Created
      let result = await workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: SubscriptionEvent.Create
      });
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.Created);
      
      // Created to Active
      result = await workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: SubscriptionEvent.Activate
      });
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.Active);
      
      // Active to Overdue
      result = await workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: StripeSubscriptionEvent.PaymentFailed
      });
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.Overdue);
      
      // Overdue to Active
      result = await workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: StripeSubscriptionEvent.PaymentSucceeded
      });
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.Active);
      
      // Active to Canceled
      result = await workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: SubscriptionEvent.Cancel
      });
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.Canceled);
    });

    it('should handle failed subscription lifecycle: Pending -> Created -> Active -> Overdue -> Failed -> Expired', async () => {
      testSubscription.subscriptionStatus = SubscriptionStatus.Pending;
      
      // Pending to Created
      let result = await workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: SubscriptionEvent.Create
      });
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.Created);
      
      // Created to Active
      result = await workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: SubscriptionEvent.Activate
      });
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.Active);
      
      // Active to Overdue
      result = await workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: StripeSubscriptionEvent.PaymentFailed
      });
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.Overdue);
      
      // Overdue to Failed
      result = await workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: StripeSubscriptionEvent.PaymentFailed
      });
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.Failed);
      
      // Failed to Expired
      result = await workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: SubscriptionEvent.Deactivate
      });
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.Expired);
    });
  });

  // Test Stripe webhook event handling
  describe('Stripe Webhook Event Handling', () => {
    it('should handle Stripe subscription.created webhook event', async () => {
      const stripeEvent = {
        type: StripeSubscriptionEvent.Created,
        data: {
          object: {
            id: 'sub_webhook123',
            status: 'active',
            customer: 'cus_webhook123'
          }
        }
      } as any;
      
      // Create a new subscription for this test
      const newSubscription = await repository.new();
      newSubscription.subscriptionId = 'sub_webhook123';
      repository.update(newSubscription, SubscriptionStatus.Pending);
      
      // Process the webhook
      const result = await workflowService.emit({
        urn: 'sub_webhook123',
        event: StripeSubscriptionEvent.Created,
        payload: stripeEvent.data.object
      });
      
      expect(result.subscriptionId).toBe('sub_webhook123');
      expect(result.subscriptionStatus).toBe('active');
    });

    it('should handle Stripe subscription.updated webhook event', async () => {
      const stripeEvent = {
        type: StripeSubscriptionEvent.Updated,
        data: {
          object: {
            id: testSubscription.subscriptionId,
            status: 'past_due'
          }
        }
      } as any;
      
      testSubscription.subscriptionStatus = SubscriptionStatus.Active;
      
      // Process the webhook
      const result = await workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: StripeSubscriptionEvent.Updated,
        payload: stripeEvent.data.object
      });
      
      expect(result.subscriptionStatus).toBe('overdue');
    });

    it('should handle Stripe invoice.payment_failed webhook event', async () => {
      const stripeEvent = {
        type: StripeSubscriptionEvent.PaymentFailed,
        data: {
          object: {
            id: 'inv_failed123',
            subscription: testSubscription.subscriptionId
          }
        }
      } as any;
      
      testSubscription.subscriptionStatus = SubscriptionStatus.Active;
      
      // Process the webhook
      const result = await workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: StripeSubscriptionEvent.PaymentFailed,
        payload: stripeEvent.data.object
      });
      
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.Overdue);
    });
  });

  // Test error handling
  describe('Error Handling', () => {
    it('should handle non-existent subscription', async () => {
      await expect(workflowService.emit({
        urn: 'non-existent-id',
        event: SubscriptionEvent.Activate
      })).rejects.toThrow('Subscription not found: non-existent-id');
    });

    it('should handle repository errors', async () => {
      // Mock repository update to throw an error
      jest.spyOn(repository, 'update').mockImplementationOnce(() => {
        throw new Error('Database error');
      });
      
      testSubscription.subscriptionStatus = SubscriptionStatus.Pending;
      
      await expect(workflowService.emit({
        urn: testSubscription.subscriptionId,
        event: SubscriptionEvent.Create
      })).rejects.toThrow('Database error');
    });
  });

  // Test final states
  describe('Final States', () => {
    it('should recognize Active as a final state', () => {
      testSubscription.subscriptionStatus = SubscriptionStatus.Active;
      
      const isFinal = SubscriptionWorkflowDefinition.states.finals.includes(
        testSubscription.subscriptionStatus as SubscriptionStatus
      );
      
      expect(isFinal).toBe(true);
    });

    it('should recognize Canceled as a final state', () => {
      testSubscription.subscriptionStatus = SubscriptionStatus.Canceled;
      
      const isFinal = SubscriptionWorkflowDefinition.states.finals.includes(
        testSubscription.subscriptionStatus as SubscriptionStatus
      );
      
      expect(isFinal).toBe(true);
    });

    it('should recognize Expired as a final state', () => {
      testSubscription.subscriptionStatus = SubscriptionStatus.Expired;
      
      const isFinal = SubscriptionWorkflowDefinition.states.finals.includes(
        testSubscription.subscriptionStatus as SubscriptionStatus
      );
      
      expect(isFinal).toBe(true);
    });

    it('should not recognize Pending as a final state', () => {
      testSubscription.subscriptionStatus = SubscriptionStatus.Pending;
      
      const isFinal = SubscriptionWorkflowDefinition.states.finals.includes(
        testSubscription.subscriptionStatus as SubscriptionStatus
      );
      
      expect(isFinal).toBe(false);
    });
  });
});

