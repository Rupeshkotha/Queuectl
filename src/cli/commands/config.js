const db = require('../../../src/db');
const chalk = require('chalk');
const ora = require('ora');

const formatBoxLine = (label, value, valueColor = chalk.white, boxWidth = 40) => {
  const labelText = `  ${label}:`;
  const valueText = String(value);
  const contentWidth = boxWidth - 2;
  const usedWidth = labelText.length + 1 + valueText.length; 
  const padding = Math.max(1, contentWidth - usedWidth);
  return chalk.cyanBright('│') + chalk.gray(labelText) + ' ' + valueColor(valueText) + ' '.repeat(padding) + chalk.cyanBright('│');
};

const printConfigBox = (key, value, boxWidth = 40) => {
  const titleText = ' Config Set ';
  const dashesNeeded = boxWidth - 2 - titleText.length - 1;
  const titleLine = '┌─' + titleText + '─'.repeat(dashesNeeded) + '┐';
  console.log(); 
  console.log(chalk.cyanBright(titleLine));
  console.log(chalk.cyanBright('│') + ' '.repeat(boxWidth - 2) + chalk.cyanBright('│'));
  console.log(formatBoxLine('Key', key, chalk.white.bold, boxWidth));
  console.log(formatBoxLine('New Value', value, chalk.cyan.bold, boxWidth));
  console.log(chalk.cyanBright('│') + ' '.repeat(boxWidth - 2) + chalk.cyanBright('│'));
  console.log(chalk.cyanBright('└') + '─'.repeat(boxWidth - 2) + chalk.cyanBright('┘'));
};

module.exports = function register(program) {
  program
    .command('config')
    .description('Manage configuration (e.g., max_retries, backoff_base)')
    .command('set <key> <value>')
    .description('Set a configuration value')
    .action(async (key, value) => {
      
      const spinner = ora(`Updating config for ${chalk.cyan(key)}...`).start();
      try {
        // 1. Validate the key
        if (key !== 'max_retries' && key !== 'backoff_base') {
          spinner.fail('Invalid Configuration Key');
          console.error(chalk.red(`  Error: Invalid key "${key}". Must be 'max_retries' or 'backoff_base'.`));
          process.exit(1);
        }

        await db.setConfigValue(key, value);
        spinner.succeed('Configuration updated');
      
        printConfigBox(key, value);
        
      } catch (err) {
        spinner.fail('Error setting config');
        console.error(chalk.red(`  ${err.message}`));
        process.exit(1);
      }
    });
}