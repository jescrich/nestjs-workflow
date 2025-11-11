import * as chalk from 'chalk';

export class DemoUtils {
  static getStatusColorMap(): { [key: string]: chalk.Chalk } {
    return {
      'registered': chalk.gray,
      'email_verified': chalk.blue,
      'profile_incomplete': chalk.yellow,
      'profile_complete': chalk.yellowBright,
      'identity_verification_pending': chalk.magenta,
      'identity_verified': chalk.greenBright,
      'active': chalk.bold.green,
      'suspended': chalk.bold.red,
      'inactive': chalk.dim.gray,
      'pending': chalk.yellow,
      'completed': chalk.green,
      'failed': chalk.red,
      'manual_review': chalk.magenta,
      'low': chalk.green,
      'medium': chalk.yellow,
      'high': chalk.red
    };
  }

  static getStatusColor(status: string, colorMap?: { [key: string]: chalk.Chalk }): string {
    const map = colorMap || this.getStatusColorMap();
    const statusLower = status.toLowerCase().replace(/ /g, '_');
    const colorFn = map[statusLower] || chalk.white;
    return colorFn(status.toUpperCase().replace(/_/g, ' '));
  }

  static getVerificationStatusColor(status: string): string {
    const colors: { [key: string]: chalk.Chalk } = {
      'pending': chalk.yellow,
      'completed': chalk.green,
      'failed': chalk.red,
      'manual_review': chalk.magenta
    };
    
    return (colors[status] || chalk.white)(status);
  }

  static getRiskLevelColor(level: string): string {
    const colors: { [key: string]: chalk.Chalk } = {
      'low': chalk.green,
      'medium': chalk.yellow,
      'high': chalk.red
    };
    
    return (colors[level] || chalk.white)(level.toUpperCase());
  }

  static printDivider(char: string = '─', length: number = 60, color: chalk.Chalk = chalk.dim): void {
    console.log(color(char.repeat(length)));
  }

  static printBox(content: string[], borderColor: chalk.Chalk = chalk.dim): void {
    const maxLength = Math.max(...content.map(line => line.length));
    
    console.log(borderColor('┌' + '─'.repeat(maxLength + 2) + '┐'));
    content.forEach(line => {
      console.log(borderColor('│ ') + line.padEnd(maxLength) + borderColor(' │'));
    });
    console.log(borderColor('└' + '─'.repeat(maxLength + 2) + '┘'));
  }

  static formatJson(obj: any, maxLength: number = 150): string {
    const formatted = JSON.stringify(obj, null, 2);
    if (formatted.length > maxLength) {
      return formatted.substring(0, maxLength) + '...';
    }
    return formatted;
  }

  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}