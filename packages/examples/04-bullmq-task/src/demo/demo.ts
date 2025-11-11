import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TaskService } from '../task.service';
import { TaskProducerService } from '../task.producer.service';
import { TaskEntityService } from '../task.entity.service';
import { DemoVisualizer } from './demo.visualizer';
import { TaskStatus, TaskEvent } from '../task.entity';
import chalk from 'chalk';

async function runDemo() {
  DemoVisualizer.displayHeader();
  
  console.log(chalk.bold('Starting BullMQ Task Workflow Demo...\n'));
  console.log(chalk.gray('This demo showcases:'));
  console.log(chalk.gray('  • BullMQ integration with NestJS Workflow'));
  console.log(chalk.gray('  • Asynchronous event-driven workflow transitions'));
  console.log(chalk.gray('  • Job retry logic with exponential backoff'));
  console.log(chalk.gray('  • Dead letter queue for failed jobs'));
  console.log(chalk.gray('  • Health monitoring\n'));

  // Create NestJS application
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  await app.init();

  const taskService = app.get(TaskService);
  const producerService = app.get(TaskProducerService);
  const entityService = app.get(TaskEntityService);

  try {
    // Display workflow diagram
    DemoVisualizer.displayWorkflowDiagram();
    await DemoVisualizer.wait(2000);

    // Health check
    DemoVisualizer.displayInfo('Checking BullMQ connection health...');
    const isHealthy = await producerService.checkHealth();
    DemoVisualizer.displayHealthCheck(isHealthy);
    
    if (!isHealthy) {
      DemoVisualizer.displayWarning('Redis connection is not healthy. Make sure Redis is running.');
      DemoVisualizer.displayInfo('Start Redis with: docker run -d -p 6379:6379 redis:alpine');
      await app.close();
      return;
    }

    await DemoVisualizer.wait(2000);
    DemoVisualizer.displaySeparator();

    // ===== SCENARIO 1: Happy Path - Complete Task =====
    console.log(chalk.bold.cyan('\n📝 SCENARIO 1: Happy Path - Complete Task via BullMQ\n'));

    // Create task
    DemoVisualizer.displayInfo('Creating a new task...');
    const task1 = await taskService.createTask(
      'Implement BullMQ Integration',
      'Add BullMQ support to the workflow library'
    );
    DemoVisualizer.displayTask(task1);
    await DemoVisualizer.wait(1500);

    // Start task via BullMQ
    DemoVisualizer.displayInfo('\nEmitting START event via BullMQ...');
    await producerService.emitStartEvent(task1.id, 'Alice');
    DemoVisualizer.displayInfo('Job added to queue. Waiting for worker to process...');
    await DemoVisualizer.wait(3000); // Wait for BullMQ worker to process

    let updatedTask = await entityService.findById(task1.id);
    if (updatedTask) {
      DemoVisualizer.displayTransition(TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskEvent.START);
      DemoVisualizer.displayTask(updatedTask);
    }
    await DemoVisualizer.wait(1500);

    // Submit for review via BullMQ
    DemoVisualizer.displayInfo('\nEmitting SUBMIT_FOR_REVIEW event via BullMQ...');
    await producerService.emitSubmitForReviewEvent(task1.id, 'Bob');
    DemoVisualizer.displayInfo('Job added to queue. Waiting for worker to process...');
    await DemoVisualizer.wait(3000);

    updatedTask = await entityService.findById(task1.id);
    if (updatedTask) {
      DemoVisualizer.displayTransition(TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW, TaskEvent.SUBMIT_FOR_REVIEW);
      DemoVisualizer.displayTask(updatedTask);
    }
    await DemoVisualizer.wait(1500);

    // Approve task via BullMQ
    DemoVisualizer.displayInfo('\nEmitting APPROVE event via BullMQ...');
    await producerService.emitApproveEvent(task1.id, 'Bob');
    DemoVisualizer.displayInfo('Job added to queue. Waiting for worker to process...');
    await DemoVisualizer.wait(3000);

    updatedTask = await entityService.findById(task1.id);
    if (updatedTask) {
      DemoVisualizer.displayTransition(TaskStatus.IN_REVIEW, TaskStatus.COMPLETED, TaskEvent.APPROVE);
      DemoVisualizer.displayTask(updatedTask);
      DemoVisualizer.displaySuccess('Task completed successfully! ✨');
    }

    await DemoVisualizer.wait(2000);
    DemoVisualizer.displaySeparator();

    // ===== SCENARIO 2: Rejection Flow =====
    console.log(chalk.bold.cyan('\n📝 SCENARIO 2: Task Rejection and Rework\n'));

    DemoVisualizer.displayInfo('Creating another task...');
    const task2 = await taskService.createTask(
      'Write Documentation',
      'Document the BullMQ integration'
    );
    DemoVisualizer.displayTask(task2);
    await DemoVisualizer.wait(1500);

    // Start task
    DemoVisualizer.displayInfo('\nEmitting START event via BullMQ...');
    await producerService.emitStartEvent(task2.id, 'Charlie');
    await DemoVisualizer.wait(3000);

    updatedTask = await entityService.findById(task2.id);
    if (updatedTask) {
      DemoVisualizer.displayTransition(TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskEvent.START);
      DemoVisualizer.displayTask(updatedTask);
    }
    await DemoVisualizer.wait(1500);

    // Submit for review
    DemoVisualizer.displayInfo('\nEmitting SUBMIT_FOR_REVIEW event via BullMQ...');
    await producerService.emitSubmitForReviewEvent(task2.id, 'Diana');
    await DemoVisualizer.wait(3000);

    updatedTask = await entityService.findById(task2.id);
    if (updatedTask) {
      DemoVisualizer.displayTransition(TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW, TaskEvent.SUBMIT_FOR_REVIEW);
      DemoVisualizer.displayTask(updatedTask);
    }
    await DemoVisualizer.wait(1500);

    // Reject task
    DemoVisualizer.displayInfo('\nEmitting REJECT event via BullMQ...');
    await producerService.emitRejectEvent(task2.id, 'Needs more examples and better formatting');
    await DemoVisualizer.wait(3000);

    updatedTask = await entityService.findById(task2.id);
    if (updatedTask) {
      DemoVisualizer.displayTransition(TaskStatus.IN_REVIEW, TaskStatus.IN_PROGRESS, TaskEvent.REJECT);
      DemoVisualizer.displayTask(updatedTask);
      DemoVisualizer.displayWarning('Task rejected and sent back for rework');
    }

    await DemoVisualizer.wait(2000);
    DemoVisualizer.displaySeparator();

    // ===== SCENARIO 3: Cancellation =====
    console.log(chalk.bold.cyan('\n📝 SCENARIO 3: Task Cancellation\n'));

    DemoVisualizer.displayInfo('Creating a task to cancel...');
    const task3 = await taskService.createTask(
      'Refactor Legacy Code',
      'Clean up old implementation'
    );
    DemoVisualizer.displayTask(task3);
    await DemoVisualizer.wait(1500);

    // Start task
    DemoVisualizer.displayInfo('\nEmitting START event via BullMQ...');
    await producerService.emitStartEvent(task3.id, 'Eve');
    await DemoVisualizer.wait(3000);

    updatedTask = await entityService.findById(task3.id);
    if (updatedTask) {
      DemoVisualizer.displayTransition(TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskEvent.START);
      DemoVisualizer.displayTask(updatedTask);
    }
    await DemoVisualizer.wait(1500);

    // Cancel task
    DemoVisualizer.displayInfo('\nEmitting CANCEL event via BullMQ...');
    await producerService.emitCancelEvent(task3.id, 'Requirements changed - no longer needed');
    await DemoVisualizer.wait(3000);

    updatedTask = await entityService.findById(task3.id);
    if (updatedTask) {
      DemoVisualizer.displayTransition(TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED, TaskEvent.CANCEL);
      DemoVisualizer.displayTask(updatedTask);
      DemoVisualizer.displayWarning('Task cancelled');
    }

    await DemoVisualizer.wait(2000);
    DemoVisualizer.displaySeparator();

    // ===== SCENARIO 4: Batch Operations =====
    console.log(chalk.bold.cyan('\n📝 SCENARIO 4: Batch Event Emission\n'));

    DemoVisualizer.displayInfo('Creating multiple tasks...');
    const batchTasks = await Promise.all([
      taskService.createTask('Task A', 'First batch task'),
      taskService.createTask('Task B', 'Second batch task'),
      taskService.createTask('Task C', 'Third batch task'),
    ]);

    console.log(chalk.gray(`\nCreated ${batchTasks.length} tasks`));
    await DemoVisualizer.wait(1500);

    DemoVisualizer.displayInfo('\nEmitting batch START events via BullMQ...');
    await producerService.emitBatchEvents(
      batchTasks.map((task, index) => ({
        taskId: task.id,
        event: TaskEvent.START,
        payload: { assignee: `Worker-${index + 1}` }
      }))
    );
    DemoVisualizer.displaySuccess(`Emitted ${batchTasks.length} events in batch`);
    await DemoVisualizer.wait(3000);

    console.log(chalk.gray('\nBatch processing complete. All tasks started.'));

    await DemoVisualizer.wait(2000);
    DemoVisualizer.displaySeparator();

    // Final summary
    console.log(chalk.bold.cyan('\n📊 Demo Summary\n'));
    const allTasks = await entityService.findAll();
    console.log(chalk.gray(`Total tasks created: ${allTasks.length}`));
    
    const statusCounts = allTasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${DemoVisualizer.formatStatus(status as TaskStatus)}: ${count}`);
    });

    DemoVisualizer.displaySeparator();
    DemoVisualizer.displaySuccess('Demo completed successfully!');
    
    console.log(chalk.gray('\nKey Takeaways:'));
    console.log(chalk.gray('  ✓ BullMQ queues trigger workflow transitions asynchronously'));
    console.log(chalk.gray('  ✓ Jobs are processed by workers with automatic retry'));
    console.log(chalk.gray('  ✓ Failed jobs move to dead letter queue after max retries'));
    console.log(chalk.gray('  ✓ Health checks ensure Redis connectivity'));
    console.log(chalk.gray('  ✓ Batch operations enable efficient event processing\n'));

  } catch (error) {
    DemoVisualizer.displayError(error as Error);
  } finally {
    await app.close();
    console.log(chalk.gray('\nApplication closed.\n'));
  }
}

// Run the demo
runDemo().catch(console.error);
