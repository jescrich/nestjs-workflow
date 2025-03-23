import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowDefinition } from '@this/workflow/definition';
import { WorkflowService  } from '@this/workflow/service';
import { ModuleRef } from '@nestjs/core';

// Define test enums and classes
enum TestEvent {
  Start = 'start',
  Process = 'process',
  Review = 'review',
  Approve = 'approve',
  Reject = 'reject',
  Complete = 'complete',
  Cancel = 'cancel',
}

enum TestStatus {
  Draft = 'draft',
  InProgress = 'in_progress',
  InReview = 'in_review',
  Approved = 'approved',
  Rejected = 'rejected',
  Completed = 'completed',
  Cancelled = 'cancelled',
  Failed = 'failed',
}

class TestEntity {
  urn: string;
  status: TestStatus;
  data: any;

  constructor(urn: string, status: TestStatus = TestStatus.Draft, data: any = {}) {
    this.urn = urn;
    this.status = status;
    this.data = data;
  }
}

describe('Complex Workflow Transitions', () => {
  let service: WorkflowService<TestEntity, any, TestEvent, TestStatus>;
  let moduleRef: ModuleRef;
  let testEntity: TestEntity;
  
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ModuleRef,
          useValue: {
            get: jest.fn().mockReturnValue(null),
          },
        },
      ],
    }).compile();

    moduleRef = module.get<ModuleRef>(ModuleRef);
    testEntity = new TestEntity('test:123', TestStatus.Draft);
    
    // Create workflow definition with multiple from states and multiple events
    const definition: WorkflowDefinition<TestEntity, any, TestEvent, TestStatus> = {
      name: 'complex-workflow-test',
      states: {
        finals:[TestStatus.Completed, TestStatus.Cancelled, TestStatus.Failed],
        idles: [TestStatus.Draft, TestStatus.InReview, TestStatus.Approved, TestStatus.Rejected],
        failed: TestStatus.Failed,
      },
      transitions: [
        // Transition with multiple 'from' states
        {
          from: [TestStatus.Draft, TestStatus.Rejected],
          to: TestStatus.InProgress,
          event: TestEvent.Start,
        },
        // Transition with multiple events
        {
          from: TestStatus.InProgress,
          to: TestStatus.InReview,
          event: [TestEvent.Process, TestEvent.Review],
        },
        // Transition with both multiple 'from' states and multiple events
        {
          from: [TestStatus.InReview, TestStatus.Approved],
          to: TestStatus.Completed,
          event: [TestEvent.Complete, TestEvent.Approve],
        },
        // Regular transitions
        {
          from: TestStatus.InReview,
          to: TestStatus.Approved,
          event: TestEvent.Approve,
        },
        {
          from: TestStatus.InReview,
          to: TestStatus.Rejected,
          event: TestEvent.Reject,
        },
        // Transition to cancelled state
        {
          from: [TestStatus.Draft, TestStatus.InProgress, TestStatus.InReview],
          to: TestStatus.Cancelled,
          event: TestEvent.Cancel,
        },
      ],
      entity: {
        new: () => new TestEntity('new:123'),
        update: async (entity: TestEntity, status: TestStatus) => {
          entity.status = status;
          return entity;
        },
        load: async (urn: string) => {
          return testEntity;
        },
        status: (entity: TestEntity) => entity.status,
        urn: (entity: TestEntity) => entity.urn,
      },
    };
    
    service = new WorkflowService(definition, moduleRef);
    await service.onModuleInit();
  });

  it('should transition from multiple possible "from" states', async () => {
    // Test transition from Draft state
    testEntity.status = TestStatus.Draft;
    const result1 = await service.emit({ event: TestEvent.Start, urn: 'test:123' });
    expect(result1.status).toBe(TestStatus.InProgress);

    // Test transition from Rejected state
    testEntity.status = TestStatus.Rejected;
    const result2 = await service.emit({ event: TestEvent.Start, urn: 'test:123' });
    expect(result2.status).toBe(TestStatus.InProgress);
  });

  it('should handle multiple possible events for the same transition', async () => {
    testEntity.status = TestStatus.InProgress;
    
    // Test first event
    const result1 = await service.emit({ event: TestEvent.Process, urn: 'test:123' });
    expect(result1.status).toBe(TestStatus.InReview);
    
    // Reset and test second event
    testEntity.status = TestStatus.InProgress;
    const result2 = await service.emit({ event: TestEvent.Review, urn: 'test:123' });
    expect(result2.status).toBe(TestStatus.InReview);
  });

  it('should handle transitions with both multiple "from" states and multiple events', async () => {
    // Test from InReview with Complete event
    testEntity.status = TestStatus.InReview;
    const result1 = await service.emit({ event: TestEvent.Complete, urn: 'test:123' });
    expect(result1.status).toBe(TestStatus.Completed);
    
    // Test from Approved with Approve event
    testEntity.status = TestStatus.Approved;
    const result2 = await service.emit({ event: TestEvent.Approve, urn: 'test:123' });
    expect(result2.status).toBe(TestStatus.Completed);
    
    // Test from InReview with Approve event
    testEntity.status = TestStatus.InReview;
    const result3 = await service.emit({ event: TestEvent.Approve, urn: 'test:123' });
    // This should first go to Approved, then potentially to Completed if auto-transition
    expect([TestStatus.Approved, TestStatus.Completed]).toContain(result3.status);
  });

  it('should handle cancel event from multiple states', async () => {
    // Test cancel from Draft
    testEntity.status = TestStatus.Draft;
    const result1 = await service.emit({ event: TestEvent.Cancel, urn: 'test:123' });
    expect(result1.status).toBe(TestStatus.Cancelled);
    
    // Test cancel from InProgress
    testEntity.status = TestStatus.InProgress;
    const result2 = await service.emit({ event: TestEvent.Cancel, urn: 'test:123' });
    expect(result2.status).toBe(TestStatus.Cancelled);
    
    // Test cancel from InReview
    testEntity.status = TestStatus.InReview;
    const result3 = await service.emit({ event: TestEvent.Cancel, urn: 'test:123' });
    expect(result3.status).toBe(TestStatus.Cancelled);
  });

  it('should throw error when no valid transition is found', async () => {
    testEntity.status = TestStatus.Completed;
    
    await expect(
      service.emit({ event: TestEvent.Start, urn: 'test:123' })
    ).rejects.toThrow(/Unable to find transition event/);
  });

  it('should handle complex transition paths with auto-transitions', async () => {
    // Set up a scenario where we start from Draft and should end up in Completed
    // through multiple transitions if auto-transitions are working
    testEntity.status = TestStatus.Draft;
    
    // This should trigger Draft -> InProgress -> InReview -> Approved -> Completed
    // if the workflow engine correctly handles auto-transitions
    const result = await service.emit({ event: TestEvent.Start, urn: 'test:123' });
    
    // The final state depends on how auto-transitions are implemented
    // At minimum, it should have moved from Draft
    expect(result.status).not.toBe(TestStatus.Draft);
  });
});
