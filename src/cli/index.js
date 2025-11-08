#!/usr/bin/env node
const { program } = require('commander');
const figlet = require('figlet');
const pkg = require('../../package.json');
const chalk = require('chalk');

program.name('queuectl')

require('./commands/enqueue')(program);
require('./commands/config')(program);
require('./commands/list')(program);
require('./commands/status')(program);
require('./commands/dlq')(program);
require('./commands/worker')(program);

program.configureHelp({
  helpWidth: 80
});

const args = process.argv.slice(2);
const hasCommand = args.length > 0 && !args[0].startsWith('-');

if (!hasCommand) {

  const bannerText = figlet.textSync('QUEUECTL', {
    font: 'Standard',
    horizontalLayout: 'default',
    verticalLayout: 'default'
  });
  

  const bannerLines = bannerText.split('\n');
  const maxWidth = Math.max(...bannerLines.map(line => line.length));
  const boxWidth = maxWidth + 4; 
  

  const topBorder = '╔' + '═'.repeat(boxWidth - 2) + '╗';

  const bottomBorder = '╚' + '═'.repeat(boxWidth - 2) + '╝';
  

  console.log(chalk.cyanBright(topBorder));
  console.log(chalk.cyanBright('║' + ' '.repeat(boxWidth - 2) + '║'));
  
  
  bannerLines.forEach(line => {
    const padding = Math.floor((boxWidth - 2 - line.length) / 2);
    const leftPad = ' '.repeat(padding);
    const rightPad = ' '.repeat(boxWidth - 2 - line.length - padding);
    console.log(chalk.cyanBright('║' + leftPad + line + rightPad + '║'));
  });
  

  const versionText = `CLI Version ${pkg.version}`;
  const versionPadding = Math.floor((boxWidth - 2 - versionText.length) / 2);
  const versionLeftPad = ' '.repeat(versionPadding);
  const versionRightPad = ' '.repeat(boxWidth - 2 - versionText.length - versionPadding);
  console.log(chalk.cyanBright('║' + ' '.repeat(boxWidth - 2) + '║'));
  console.log(chalk.cyanBright('║' + versionLeftPad + versionText + versionRightPad + '║'));
  console.log(chalk.cyanBright('║' + ' '.repeat(boxWidth - 2) + '║'));
  console.log(chalk.cyanBright(bottomBorder));
  
  console.log();
  console.log(chalk.gray('  CLI-based background job queue system'));
  console.log();
  program.outputHelp();
  process.exit(0);
}

program.parse(process.argv);


