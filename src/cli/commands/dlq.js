const db = require('../../../src/db');
const chalk = require('chalk');
const ora = require('ora');
const Table = require('cli-table3');

module.exports = function register(program) {
  const dlq = program.command('dlq').description('Manage the Dead Letter Queue');
  dlq.command('list')
    .description('List all jobs in the Dead Letter Queue')
    .action(async () => {
      const spinner = ora('Fetching Dead Letter Queue jobs...').start();
      try {
        const jobs = await db.listDlqJobs();
        if (jobs.length === 0) {
          spinner.warn(chalk.yellow('The Dead Letter Queue is empty.'));
          return;
        }
        spinner.succeed(chalk.green(`Found ${jobs.length} job(s) in the DLQ.`));
        const formatIso = (s) => {

          try { return new Date(s).toISOString().replace(/\.\d{3}Z$/, 'Z'); } catch (_) { return s; }

        };
        const terminalWidth = process.stdout.columns || 120;
        const idColWidth = 15;
        const attemptsColWidth = 10;
        const timeColWidth = 22;
        const remainingWidth = terminalWidth - idColWidth - attemptsColWidth - timeColWidth - 12; 
        const commandColWidth = Math.max(20, Math.floor(remainingWidth * 0.4));
        const errorColWidth = Math.max(30, Math.floor(remainingWidth * 0.6));
        const table = new Table({
            head: [
                chalk.cyan('ID'),
                chalk.cyan('Command'),
                chalk.cyan('Attempts'),
                chalk.cyan('Error'),
                chalk.cyan('Failed At')
            ],

            colWidths: [idColWidth, commandColWidth, attemptsColWidth, errorColWidth, timeColWidth],
            wordWrap: true, 
            style: { head: [], border: ['grey'] }

        });
        jobs.forEach(job => {
          const cleanError = job.error ? 
            job.error.replace(/(\r\n|\n|\r)/gm, ' ').trim() : 
            'N/A';
          table.push([
            chalk.white(job.id.substring(0, 12)),
            job.command, // This will wrap
            chalk.yellow(job.attempts),
            chalk.red(cleanError), // This will wrap
            chalk.grey(formatIso(job.updated_at))
          ]);

        });

        console.log(table.toString());

      } catch (err) {
        spinner.fail('Error listing DLQ jobs');
        console.error(chalk.red(`  ${err.message}`));
        process.exit(1);
      }

    });

dlq.command('retry <job-id>')
    .description('Retry a job from the DLQ by moving it back to the main queue')
    .action(async (jobId) => {
      const spinner = ora(`Retrying job ${chalk.cyan(jobId)}...`).start();
      try {
        const retriedJobId = await db.retryDlqJob(jobId);
        if (retriedJobId) {
          spinner.succeed(chalk.green(`Job ${chalk.cyan(retriedJobId)} has been moved back to the 'pending' queue.`));
        } else {
          spinner.fail(chalk.red(`Error: Job with ID "${chalk.cyan(jobId)}" not found in the Dead Letter Queue.`));
        }
      } catch (err) {
        spinner.fail('Error retrying job');
        console.error(chalk.red(`  ${err.message}`));
        process.exit(1);
      }
    });
}