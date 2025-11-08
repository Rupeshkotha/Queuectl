const db = require('../../../src/db');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const ROOT_DIR = path.join(__dirname, '..', '..', '..');
const RUN_DIR = path.join(ROOT_DIR, '.queue_run');

const formatStatusLine = (label, count, color, totalJobs, boxWidth = 57, barWidth = 20) => {
  const labelText = `  • ${label}`;
  const labelColWidth = 20; 
  const labelPadding = ' '.repeat(Math.max(0, labelColWidth - labelText.length));
  const styledLabel = chalk.gray(labelText) + labelPadding;
  let bar = '';
  if (count > 0 && totalJobs > 0) {
    const barLength = Math.max(1, Math.floor((count / totalJobs) * barWidth));
    bar = '█'.repeat(barLength);
  }
  const barPadding = ' '.repeat(Math.max(0, barWidth - bar.length));
  const styledBar = color(bar + barPadding);
  const countText = String(count);
  const countColWidth = 5; 
  const countPadding = ' '.repeat(Math.max(0, countColWidth - countText.length));
  const styledCount = chalk.bold(color(countPadding + countText));
  const contentWidth = labelColWidth + barWidth + countColWidth + 2; 
  const remainingPadding = ' '.repeat(Math.max(0, boxWidth - 2 - contentWidth));
  return chalk.cyanBright('│') + 
         styledLabel + ' ' + 
         styledBar + ' ' + 
         remainingPadding + 
         styledCount + 
         chalk.cyanBright('│');

};
module.exports = function register(program) {
  program
    .command('status')
    .description('Show a summary of all job states and active workers')
    .action(async () => {
      const spinner = ora('Fetching queue status...').start();
      try {
        const counts = await db.getJobCounts();
        let workerCount = 0;
        if (fs.existsSync(RUN_DIR)) {
          workerCount = fs.readdirSync(RUN_DIR).filter(f => f.endsWith('.pid')).length;
        }
        spinner.succeed('Status retrieved');
        const boxWidth = 57;
        const totalJobs = counts.pending + counts.failed + counts.processing + counts.completed + counts.dead;
        const maxCount = Math.max(totalJobs, 1); 
        const formatLine = (label, value, valueColor = chalk.white, boxWidth = 57) => {
          const labelText = `  ${label}:`;
          const labelColWidth = 20; 
          const labelPadding = ' '.repeat(Math.max(0, labelColWidth - labelText.length));
          const styledLabel = chalk.gray(labelText) + labelPadding;
          const valueText = String(value);
          const countColWidth = 5; 
          const countPadding = ' '.repeat(Math.max(0, countColWidth - valueText.length));
          const styledCount = valueColor(countPadding + valueText);
          const contentWidth = labelColWidth + countColWidth + 1; 
          const remainingPadding = ' '.repeat(Math.max(0, boxWidth - 2 - contentWidth));
          return chalk.cyanBright('│') + 
                 styledLabel + ' ' + 
                 remainingPadding + 
                 styledCount + 
                 chalk.cyanBright('│');
        };
        console.log();
        const titleText = ' Queue Status ';
        const dashesNeeded = boxWidth - 2 - titleText.length - 1;
        const titleLine = '┌─' + titleText + '─'.repeat(dashesNeeded) + '┐';
        console.log(chalk.cyanBright(titleLine));
        console.log(chalk.cyanBright('│') + ' '.repeat(boxWidth - 2) + chalk.cyanBright('│'));
        console.log(chalk.cyanBright('│') + chalk.white.bold('  Job States:') + ' '.repeat(boxWidth - 15) + chalk.cyanBright('│'));
        console.log(chalk.cyanBright('│') + ' '.repeat(boxWidth - 2) + chalk.cyanBright('│'));
        console.log(formatStatusLine('Pending', counts.pending, chalk.yellowBright, maxCount, boxWidth));
        console.log(formatStatusLine('Processing', counts.processing, chalk.blueBright, maxCount, boxWidth));
        console.log(formatStatusLine('Failed Retryable', counts.failed, chalk.redBright, maxCount, boxWidth));
        console.log(formatStatusLine('Completed', counts.completed, chalk.greenBright, maxCount, boxWidth));
        console.log(formatStatusLine('Dead Letter', counts.dead, chalk.magentaBright, maxCount, boxWidth));
        console.log(chalk.cyanBright('│') + ' '.repeat(boxWidth - 2) + chalk.cyanBright('│'));
        const separatorLength = boxWidth - 6; 
        console.log(chalk.cyanBright('│') + chalk.gray('  ') + '─'.repeat(separatorLength) + chalk.gray('  ') + chalk.cyanBright('│'));
        console.log(chalk.cyanBright('│') + ' '.repeat(boxWidth - 2) + chalk.cyanBright('│'));
        const workerText = String(workerCount);
        const workerColor = workerCount > 0 ? chalk.greenBright.bold : chalk.gray;
        console.log(formatLine('Active Workers', workerText, workerColor));
        console.log(chalk.cyanBright('│') + ' '.repeat(boxWidth - 2) + chalk.cyanBright('│'));
        console.log(chalk.cyanBright('└') + '─'.repeat(boxWidth - 2) + chalk.cyanBright('┘'));
      } catch (err) {
        spinner.fail('Error fetching status');
        console.error(chalk.red(`  ${err.message}`));
        process.exit(1);
      }
    });

}