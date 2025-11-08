const db = require('../../../src/db');
const chalk = require('chalk');
const ora = require('ora');

module.exports = function register(program) {
  program
    .command('enqueue <json-string>')
    .description('Add a new job to the queue (e.g., \'{"id":"job1","command":"sleep 2"}\')')
    .option('-r, --retries <number>', 'Set a custom max retry count for this job')
    .option('-a, --at <string>', 'Schedule the job to be available at a future time (ISO 8601 format)')
    .action(async (jsonString, options) => {
      const spinner = ora('Enqueuing job...').start();
      try {
        let jobData;
        try {
          jobData = JSON.parse(jsonString);
        } catch (e) {
          spinner.fail('Invalid JSON string provided');
          console.error(chalk.red(`  ${e.message}`));
          process.exit(1);
        }
        
        if (!jobData.id || !jobData.command) {
          spinner.fail('Missing required fields');
          console.error(chalk.red('  The JSON string must include both "id" and "command" fields.'));
          process.exit(1);
        }
        
        const jobOptions = {};
        if (options.retries) {
          jobOptions.maxRetries = parseInt(options.retries, 10);
        }
        if (options.at) {
          jobOptions.availableAt = new Date(options.at).toISOString();
        }
        
        const jobId = await db.addJob(jobData.id, jobData.command, jobOptions);
        spinner.succeed('Job enqueued successfully');
        
        const availableAt = jobOptions.availableAt || new Date().toISOString();
        const formattedTime = new Date(availableAt).toLocaleString();
        
        
        const boxWidth = 57;
        const formatLine = (label, value, valueColor = chalk.white) => {
          const labelText = `  ${label}:`;
          const valueText = String(value);
          const contentWidth = boxWidth - 2; 
          const usedWidth = labelText.length + 1 + valueText.length; 
          const padding = Math.max(1, contentWidth - usedWidth);
          return chalk.cyanBright('│') + chalk.gray(labelText) + ' ' + valueColor(valueText) + ' '.repeat(padding) + chalk.cyanBright('│');
        };
        
        
        console.log();
        const titleText = ' Job Details ';
        
        const dashesNeeded = boxWidth - 2 - titleText.length - 1; 
        const titleLine = '┌─' + titleText + '─'.repeat(dashesNeeded) + '┐';
        console.log(chalk.cyanBright(titleLine));
        console.log(chalk.cyanBright('│') + ' '.repeat(boxWidth - 2) + chalk.cyanBright('│'));
        console.log(formatLine('Job ID', jobId, chalk.white.bold));
        console.log(formatLine('Command', jobData.command));
        console.log(formatLine('State', 'pending', chalk.yellowBright));
        if (options.retries) {
          console.log(formatLine('Max Retries', jobOptions.maxRetries));
        }
        if (options.at) {
          console.log(formatLine('Scheduled For', formattedTime));
        }
        console.log(chalk.cyanBright('│') + ' '.repeat(boxWidth - 2) + chalk.cyanBright('│'));
        console.log(chalk.cyanBright('└') + '─'.repeat(boxWidth - 2) + chalk.cyanBright('┘'));
        
      } catch (err) {
        spinner.fail('Error adding job');
        console.error(chalk.red(`  ${err.message}`));
        process.exit(1);
      }
    });
}


