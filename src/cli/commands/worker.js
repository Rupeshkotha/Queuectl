const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const ROOT_DIR = path.join(__dirname, '..', '..', '..');
const RUN_DIR = path.join(ROOT_DIR, '.queue_run');

module.exports = function register(program) {
  const worker = program.command('worker').description('Manage worker processes');
  worker.command('start')
    .description('Start one or more worker processes in the background')
    .option('-c, --count <number>', 'Number of workers to start', '1')
    .action(async (options) => {
      const spinner = ora('Starting workers...').start();
      
      try {
        if (!fs.existsSync(RUN_DIR)) { fs.mkdirSync(RUN_DIR); }
        const count = parseInt(options.count, 10);
        
        if (count <= 0) {
          spinner.fail('Invalid worker count');
          console.error(chalk.red('  Worker count must be greater than 0.'));
          process.exit(1);
        }
        
        spinner.text = `Starting ${count} worker(s)...`;
        const startedPids = [];
        
        for (let i = 0; i < count; i++) {
          const workerProcess = spawn(
            process.execPath,
            [path.join(ROOT_DIR, 'workers.js')],
            { detached: true, stdio: 'ignore', windowsHide: true }
          );
          workerProcess.unref();
          const pid = workerProcess.pid;
          const pidFile = path.join(RUN_DIR, `worker.${pid}.pid`);
          fs.writeFileSync(pidFile, pid.toString());
          startedPids.push(pid);
        }
        
        spinner.succeed(`Started ${count} worker(s)`);
        const boxWidth = 57;
        console.log();
        const titleText = ` Workers Started `;
        const dashesNeeded = boxWidth - 2 - titleText.length - 1;
        const titleLine = '┌─' + titleText + '─'.repeat(dashesNeeded) + '┐';
        console.log(chalk.cyanBright(titleLine));
        console.log(chalk.cyanBright('│') + ' '.repeat(boxWidth - 2) + chalk.cyanBright('│'));
        
        startedPids.forEach((pid, index) => {
          const labelText = `  Worker ${index + 1}:`;
          const pidText = String(pid);
          const contentWidth = boxWidth - 2;
          const usedWidth = labelText.length + 1 + pidText.length;
          const padding = Math.max(1, contentWidth - usedWidth);
          console.log(chalk.cyanBright('│') + chalk.gray(labelText) + ' ' + chalk.greenBright.bold(pidText) + ' '.repeat(padding) + chalk.cyanBright('│'));
        });
        
        console.log(chalk.cyanBright('│') + ' '.repeat(boxWidth - 2) + chalk.cyanBright('│'));
        console.log(chalk.cyanBright('└') + '─'.repeat(boxWidth - 2) + chalk.cyanBright('┘'));
        console.log();
        console.log(chalk.gray(`  ${count} worker(s) running in background.`));
        
      } catch (err) {
        spinner.fail('Error starting workers');
        console.error(chalk.red(`  ${err.message}`));
        process.exit(1);
      }
    });

  worker.command('stop')
    .description('Stop all running worker processes gracefully')
    .action(async () => {
      const spinner = ora('Checking for running workers...').start();
      
      try {
        if (!fs.existsSync(RUN_DIR)) {
          spinner.info('No workers running');
          console.log(chalk.gray('  Runtime directory not found.'));
          return;
        }
        
        const files = fs.readdirSync(RUN_DIR).filter(f => f.endsWith('.pid'));
        if (files.length === 0) {
          spinner.info('No workers running');
          console.log(chalk.gray('  No PID files found.'));
          return;
        }
        
        spinner.text = `Stopping ${files.length} worker(s)...`;
        const isWin = process.platform === 'win32';
        
        if (isWin) {
          spinner.text = `Creating stop files for ${files.length} worker(s) (Graceful stop)...`;
        } else {
          spinner.text = `Sending SIGTERM to ${files.length} worker(s)...`;
        }
        
        const stoppedPids = [];
        const failedPids = [];
        
        for (const file of files) {
          const pidFile = path.join(RUN_DIR, file);
          let pid;
          try {
            pid = parseInt(fs.readFileSync(pidFile, 'utf-8'), 10);
          } catch (err) {
            failedPids.push({ pid: file, error: err.message });
            continue;
          }
          
          if (isWin) {
            try {
              const stopFile = path.join(RUN_DIR, `worker.${pid}.stop`);
              fs.writeFileSync(stopFile, 'stop');
            } catch (err) {
              failedPids.push({ pid, error: err.message });
              continue;
            }
          } else {
            try {
              process.kill(pid, 'SIGTERM');
            } catch (err) {
              if (err.code !== 'ESRCH') {
                failedPids.push({ pid, error: err.message });
                continue;
              }
            }
          }
          const waitMs = (ms) => new Promise(r => setTimeout(r, ms));
          while (true) {
            try {
              process.kill(pid, 0);
              await waitMs(500);
            } catch (_) {
              break;
            }
          }
          try {
            process.kill(pid, 0);
            failedPids.push({ pid, error: 'Process still alive after timeout' });
          } catch (_) {
            try {
              fs.unlinkSync(pidFile);
            } catch (_) {}
            try {
              const stopFile = path.join(RUN_DIR, `worker.${pid}.stop`);
              if (fs.existsSync(stopFile)) fs.unlinkSync(stopFile);
            } catch (_) {}
            stoppedPids.push(pid);
          }
        }
        
        if (stoppedPids.length > 0) {
          spinner.succeed(`Stopped ${stoppedPids.length} worker(s)`);
        } else if (failedPids.length > 0) {
          spinner.fail('Failed to stop workers');
        } else {
          spinner.info('No workers to stop');
        }

        if (stoppedPids.length > 0 || failedPids.length > 0) {
          const boxWidth = 57;
          console.log();
          const titleText = ` Workers Stopped `;
          const dashesNeeded = boxWidth - 2 - titleText.length - 1;
          const titleLine = '┌─' + titleText + '─'.repeat(dashesNeeded) + '┐';
          console.log(chalk.cyanBright(titleLine));
          console.log(chalk.cyanBright('│') + ' '.repeat(boxWidth - 2) + chalk.cyanBright('│'));
          
          if (stoppedPids.length > 0) {
            stoppedPids.forEach((pid) => {
              const labelText = `  • Stopped:`;
              const pidText = String(pid);
              const contentWidth = boxWidth - 2;
              const usedWidth = labelText.length + 1 + pidText.length;
              const padding = Math.max(1, contentWidth - usedWidth);
              console.log(chalk.cyanBright('│') + chalk.gray(labelText) + ' ' + chalk.greenBright(pidText) + ' '.repeat(padding) + chalk.cyanBright('│'));
            });
          }
          
          if (failedPids.length > 0) {
            if (stoppedPids.length > 0) {
              console.log(chalk.cyanBright('│') + ' '.repeat(boxWidth - 2) + chalk.cyanBright('│'));
            }
            failedPids.forEach(({ pid, error }) => {
              const labelText = `  • Failed:`;
              const pidText = String(pid);
              const contentWidth = boxWidth - 2;
              const usedWidth = labelText.length + 1 + pidText.length;
              const padding = Math.max(1, contentWidth - usedWidth);
              console.log(chalk.cyanBright('│') + chalk.gray(labelText) + ' ' + chalk.redBright(pidText) + ' '.repeat(padding) + chalk.cyanBright('│'));
              if (error) {
                const errorText = `    ${error}`;
                const errorPadding = Math.max(1, boxWidth - 2 - errorText.length);
                console.log(chalk.cyanBright('│') + chalk.red(errorText) + ' '.repeat(errorPadding) + chalk.cyanBright('│'));
              }
            });
          }
          
          console.log(chalk.cyanBright('│') + ' '.repeat(boxWidth - 2) + chalk.cyanBright('│'));
          console.log(chalk.cyanBright('└') + '─'.repeat(boxWidth - 2) + chalk.cyanBright('┘'));
        }
        
        if (fs.existsSync(RUN_DIR) && fs.readdirSync(RUN_DIR).length === 0) {
          fs.rmdirSync(RUN_DIR);
        }
        
        if (failedPids.length > 0) {
          process.exit(1);
        }
        
      } catch (err) {
        spinner.fail('Error stopping workers');
        console.error(chalk.red(`  ${err.message}`));
        process.exit(1);
      }
    });
}


