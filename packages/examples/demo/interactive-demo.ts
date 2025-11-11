import * as chalk from 'chalk';
import * as readline from 'readline';

export abstract class BaseInteractiveDemo<TEntity, TEvent, TStatus> {
  protected currentEntity: TEntity | null = null;
  protected history: TStatus[] = [];
  protected rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  protected question(prompt: string): Promise<string> {
    return new Promise(resolve => {
      this.rl.question(prompt, resolve);
    });
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected clearScreen(): void {
    console.clear();
    process.stdout.write('\x1Bc');
  }

  protected printHeader(title: string = 'Interactive Workflow Demo'): void {
    console.log(chalk.bold.cyan('═'.repeat(80)));
    console.log(chalk.bold.cyan('║') + chalk.bold.white(` ${title}`.padEnd(78)) + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('═'.repeat(80)));
  }

  protected getProgressBar(percentage: number): string {
    const width = 20;
    const filled = Math.floor(width * percentage / 100);
    const empty = width - filled;
    
    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    return `${bar} ${percentage}%`;
  }

  protected abstract getStatusColor(status: string): string;
  protected abstract printEntityInfo(): void;
  protected abstract getAvailableEvents(): TEvent[];
  protected abstract getEventDescription(event: TEvent): string;
  protected abstract processEvent(event: TEvent): Promise<void>;
  protected abstract createNewEntity(): Promise<void>;
  protected abstract showVisualization(): Promise<void>;

  protected async showMenu(): Promise<string> {
    console.log('\n' + chalk.bold.white('Available Actions:'));
    console.log(chalk.dim('─'.repeat(40)));
    
    const availableEvents = this.getAvailableEvents();
    
    if (availableEvents.length === 0) {
      console.log(chalk.dim('  No actions available from current state'));
    } else {
      availableEvents.forEach((event, index) => {
        console.log(chalk.cyan(`  ${index + 1}. `) + chalk.white(this.getEventDescription(event)));
      });
    }
    
    console.log(chalk.dim('─'.repeat(40)));
    console.log(chalk.cyan('  v. ') + chalk.white('View workflow visualization'));
    console.log(chalk.cyan('  n. ') + chalk.white('Create new entity'));
    console.log(chalk.cyan('  r. ') + chalk.white('Run automated scenario'));
    console.log(chalk.cyan('  h. ') + chalk.white('Show transition history'));
    console.log(chalk.cyan('  q. ') + chalk.white('Quit'));
    
    return await this.question(chalk.bold.yellow('\nSelect an option: '));
  }

  protected showHistory(): void {
    console.log('\n' + chalk.bold.white('Transition History:'));
    console.log(chalk.dim('─'.repeat(40)));
    
    if (this.history.length === 0) {
      console.log(chalk.dim('  No transitions yet'));
    } else {
      this.history.forEach((status, index) => {
        const arrow = index < this.history.length - 1 ? ' → ' : '';
        process.stdout.write(this.getStatusColor(String(status)) + chalk.white(arrow));
      });
      console.log();
    }
    
    console.log(chalk.dim('─'.repeat(40)));
  }

  protected abstract runAutomatedScenario(): Promise<void>;

  async run(): Promise<void> {
    this.clearScreen();
    this.printHeader();
    
    console.log(chalk.white('\nWelcome to the Interactive Workflow Demo!'));
    console.log(chalk.dim('This demo allows you to explore workflow states and transitions.\n'));
    
    // Create initial entity
    await this.createNewEntity();
    
    let running = true;
    while (running) {
      await this.showVisualization();
      const choice = await this.showMenu();
      
      if (choice === 'q') {
        running = false;
      } else if (choice === 'v') {
        // Already showing visualization
        continue;
      } else if (choice === 'n') {
        await this.createNewEntity();
      } else if (choice === 'r') {
        await this.runAutomatedScenario();
      } else if (choice === 'h') {
        this.showHistory();
        await this.question(chalk.dim('\nPress Enter to continue...'));
      } else {
        const eventIndex = parseInt(choice) - 1;
        const availableEvents = this.getAvailableEvents();
        
        if (eventIndex >= 0 && eventIndex < availableEvents.length) {
          await this.processEvent(availableEvents[eventIndex]);
        } else {
          console.log(chalk.red('Invalid option. Please try again.'));
          await this.delay(1500);
        }
      }
    }
    
    console.log('\n' + chalk.bold.green('Thank you for using the demo!'));
    this.rl.close();
  }

  cleanup(): void {
    if (this.rl) {
      this.rl.close();
    }
  }
}