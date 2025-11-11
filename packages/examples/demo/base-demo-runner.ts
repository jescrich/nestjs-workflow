import * as chalk from 'chalk';

export interface DemoScenarioStep<TEvent = any> {
  event: TEvent;
  payload?: any;
  delay?: number;
  description: string;
}

export interface DemoScenario<TEvent = any> {
  name: string;
  description: string;
  steps: DemoScenarioStep<TEvent>[];
}

export abstract class BaseDemoRunner<TEntity, TEvent, TStatus> {
  protected currentEntityId: string | null = null;

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected printHeader(text: string): void {
    console.log('\n' + chalk.bold.cyan('═'.repeat(80)));
    console.log(chalk.bold.cyan('║ ') + chalk.bold.white(text.padEnd(76)) + chalk.bold.cyan(' ║'));
    console.log(chalk.bold.cyan('═'.repeat(80)) + '\n');
  }

  protected printSubheader(text: string): void {
    console.log('\n' + chalk.bold.blue('─'.repeat(60)));
    console.log(chalk.bold.blue('│ ') + chalk.white(text));
    console.log(chalk.bold.blue('─'.repeat(60)));
  }

  protected printStep(step: number, total: number, description: string): void {
    const progress = `[${step}/${total}]`;
    console.log(
      chalk.bold.green(progress.padEnd(8)) +
      chalk.yellow('▶ ') +
      chalk.white(description)
    );
  }

  protected getProgressBar(percentage: number): string {
    const width = 20;
    const filled = Math.floor(width * percentage / 100);
    const empty = width - filled;
    
    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    const percentStr = `${percentage}%`.padStart(4);
    
    return `${bar} ${percentStr}`;
  }

  protected printTransition(from: string, to: string, event: string): void {
    console.log('\n' + chalk.bold.magenta('⚡ Transition:'));
    console.log('  ' + 
      this.getStatusColor(from) + 
      chalk.white(' → ') + 
      this.getStatusColor(to) +
      chalk.dim(' (via ' + event + ')')
    );
  }

  protected printActionExecuted(action: string, result: any): void {
    console.log(chalk.dim('  ⚙ Action: ') + chalk.cyan(action));
    if (result && Object.keys(result).length > 0) {
      console.log(chalk.dim('    Result: ') + chalk.gray(JSON.stringify(result, null, 2).substring(0, 100) + '...'));
    }
  }

  protected printError(message: string): void {
    console.log(chalk.bold.red('✗ Error: ') + chalk.red(message));
  }

  protected abstract getStatusColor(status: string): string;
  protected abstract printEntityState(entity: TEntity): void;
  protected abstract createEntity(data?: any): Promise<TEntity>;
  protected abstract processEvent(entityId: string, event: TEvent, payload?: any): Promise<TEntity>;

  async runScenario(scenario: DemoScenario<TEvent>): Promise<void> {
    this.printHeader(`Scenario: ${scenario.name}`);
    console.log(chalk.italic.gray(scenario.description));
    
    // Create a new entity for this scenario
    console.log('\n' + chalk.bold.green('📝 Creating new entity...'));
    const entity = await this.createEntity();
    this.currentEntityId = (entity as any).id;
    
    this.printEntityState(entity);
    
    // Execute each step
    for (let i = 0; i < scenario.steps.length; i++) {
      const step = scenario.steps[i];
      
      await this.delay(step.delay || 1000);
      
      this.printSubheader(`Step ${i + 1}: ${step.description}`);
      this.printStep(i + 1, scenario.steps.length, step.description);
      
      console.log(chalk.dim('  Event: ') + chalk.yellow(String(step.event)));
      if (step.payload && Object.keys(step.payload).length > 0) {
        console.log(chalk.dim('  Payload: ') + chalk.gray(JSON.stringify(step.payload, null, 2).substring(0, 150)));
      }
      
      try {
        const previousStatus = (entity as any).status;
        const updatedEntity = await this.processEvent(
          (entity as any).id,
          step.event,
          step.payload || {}
        );
        
        if ((updatedEntity as any).status !== previousStatus) {
          this.printTransition(previousStatus, (updatedEntity as any).status, String(step.event));
        }
        
        this.printEntityState(updatedEntity);
        
        // Update local entity reference
        Object.assign(entity, updatedEntity);
        
      } catch (error: any) {
        this.printError(error.message);
      }
    }
    
    this.printSubheader('Scenario Complete');
    console.log(chalk.bold.green('✓ ') + chalk.white('Final Status: ') + this.getStatusColor((entity as any).status));
  }

  async runAllScenarios(scenarios: DemoScenario<TEvent>[]): Promise<void> {
    console.clear();
    this.printHeader('Workflow Demo');
    console.log(chalk.white('This demo showcases different workflow scenarios.\n'));
    
    for (const scenario of scenarios) {
      await this.runScenario(scenario);
      await this.delay(3000); // Pause between scenarios
    }
    
    this.printHeader('Demo Complete');
    console.log(chalk.bold.green('✓ All scenarios have been executed successfully!\n'));
  }

  async runInteractive(scenarios: DemoScenario<TEvent>[]): Promise<void> {
    console.clear();
    this.printHeader('Interactive Workflow Demo');
    
    console.log(chalk.white('Select a scenario to run:\n'));
    
    scenarios.forEach((scenario, index) => {
      console.log(
        chalk.bold.cyan(`  ${index + 1}. `) +
        chalk.white(scenario.name) +
        chalk.dim(' - ' + scenario.description)
      );
    });
    
    console.log(chalk.bold.cyan(`  ${scenarios.length + 1}. `) + chalk.white('Run all scenarios'));
    console.log(chalk.bold.cyan(`  0. `) + chalk.white('Exit'));
    
    // In a real implementation, you would use readline or inquirer for user input
    // For now, we'll just run all scenarios
    await this.runAllScenarios(scenarios);
  }
}