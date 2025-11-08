const db = require('../../../src/db');
const chalk = require('chalk');
const ora = require('ora');
const Table = require('cli-table3');

module.exports = function register(program) {
  program
    .command('list')
    .description('List jobs from the main queue by state')
    .option('-s, --state <string>', 'Filter by state (pending, failed, processing, completed)', 'pending')
    .action(async (options) => {
      const state = options.state;
      const spinner = ora(`Fetching ${chalk.cyan(state)} jobs...`).start();
      try {
        const jobs = await db.listJobs(state);
        if (jobs.length === 0) {
          spinner.warn(chalk.green(`No jobs found with state: ${chalk.white(state)}`));
          return;
        }
        spinner.succeed(chalk.green(`Found ${jobs.length} job(s) with state: ${chalk.white(state)}`));
        console.log()
        const formatTime = (s) => {
          try {
            const date = new Date(s);
            return date.toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            });
          } catch (_) { return s; }
        };
        
        const formatDate = (s) => {
          try {
            const date = new Date(s);
            return date.toISOString().split('T')[0];
          } catch (_) { return s; }
        };
        
        const formatAvailableAt = (s) => {
          try {
            const now = new Date();
            const date = new Date(s);
            const isSameDay = now.toDateString() === date.toDateString();
            
            return isSameDay 
              ? formatTime(s) 
              : `${formatDate(s)} ${formatTime(s)}`;
          } catch (_) { return s; }
        };
        const terminalWidth = process.stdout.columns || 100; 
        const idColWidth = 12;
        const attemptsColWidth = 10;
        const exitColWidth = 12;
        const timeColWidth = 20;
        const createdColWidth = 20;
        const commandColWidth = Math.max(20, terminalWidth - idColWidth - attemptsColWidth - exitColWidth - timeColWidth - createdColWidth - 15);
        
        const table = new Table({
            head: [
                chalk.cyan('ID'),
                chalk.cyan('Command'),
                chalk.cyan('Attempts'),
                chalk.cyan('Exit Code'),
                chalk.cyan('Created At'),
                chalk.cyan('Available At')
            ],
            colWidths: [
                idColWidth, 
                commandColWidth, 
                attemptsColWidth, 
                exitColWidth, 
                createdColWidth,
                timeColWidth
            ],
            wordWrap: true, 
            style: { head: [], border: ['grey'] } 
        });
        
        jobs.forEach(job => {
          const code = job.exit_code;
          const displayCode = (code === null || code === undefined) ? '' : (code === 0 ? chalk.green(0) : chalk.red(code));
          table.push([
            chalk.white(job.id.substring(0, 12)), 
            job.command, 
            chalk.yellow(job.attempts),
            displayCode,
`${formatDate(job.created_at)} ${formatTime(job.created_at)}`,
            formatAvailableAt(job.available_at)
          ]);
        });
        console.log(table.toString());
      } catch (err) {
        spinner.fail('Error listing jobs');
        console.error(chalk.red(`  ${err.message}`));
        process.exit(1);
      }
    });
}


