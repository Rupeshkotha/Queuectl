# Testing Guide

This is a step-by-step guide for setup and test case validation of queuectl CLI tool

---

## Setup Instructions

### Making queuectl Command Work

#### 1. Install Dependencies

After cloning the repository, install the required packages:

```bash
npm install
```

#### 2. Link The CLI Globally

```bash
npm link
```

Now you can use `queuectl` as a normal command.

**Note:** If any problem occurs, run the commands with the file name directly:

```bash
src/cli/index.js --help
```

#### 3. Verify the CLI Works

```bash
queuectl --help
```

**Expected Output:**

```
╔═══════════════════════════════════════════════════╗
║                                                   ║
║    ___  _   _ _____ _   _ _____ ____ _____ _      ║
║   / _ \| | | | ____| | | | ____/ ___|_   _| |     ║
║  | | | | | | |  _| | | | |  _|| |     | | | |     ║
║  | |_| | |_| | |___| |_| | |__| |___  | | | |___  ║
║   \__\_\\___/|_____|\___/|_____\____| |_| |_____| ║
║                                                   ║
║                                                   ║
║                 CLI Version 1.0.0                 ║
║                                                   ║
╚═══════════════════════════════════════════════════╝

  CLI-based background job queue system

Usage: queuectl [options] [command]

Options:
-h, --help                       display help for command

Commands:
enqueue [options] <json-string>  Add a new job to the queue (e.g.,'{"id":"job1","command":"sleep 2"}')
config                           Manage configuration (e.g., max_retries,
backoff_base)
list [options]                   List jobs from the main queue by state
status                           Show a summary of all job states and active
workers
dlq                              Manage the Dead Letter Queue
worker                           Manage worker processes
help [command]                   display help for command
```

---

## Basic Commands

### 1. Enqueue Command

Add a new job to the queue for processing by workers.

**Syntax:**

```bash
queuectl enqueue '<json-string>' [options]
```

**Examples:**

```bash
queuectl enqueue '{"id":"job1","command":"echo Hello World"}'
queuectl enqueue '{"id":"job2","command":"sleep 5"}' --retries 5 --at "2025-11-12T10:30:00Z"
```

**Options:**

- `--retries <number>` - Custom retry limit for this job
- `--at <ISO time>` - Schedule job to start at a future time

Adds a job to the persistent database with:

- state: pending
- Retry and scheduling data
- Timestamps (created_at, available_at)

### 2. Worker Commands

Manage background workers that process queued jobs.

**Start Workers:**

```bash
queuectl worker start --count 3
```

Starts one or more workers to process jobs in parallel.

**Stop Workers:**

```bash
queuectl worker stop
```

Gracefully stops all running workers:

- Finishes any job in progress
- Cleans up PID files
- Shuts down safely

### 3. List Jobs

Display all jobs in a specific state.

**Syntax:**

```bash
queuectl list --state <state>
```

**Valid States:**

- `pending` - waiting to be picked up
- `processing` - currently running
- `completed` - successfully executed
- `Failed` - Failed by workers but retryable until backoff and max retries hit the limit

**Example:**

```bash
queuectl list --state pending
```

### 4. Status Command

Show an overview of the system's job and worker counts.

**Syntax:**

```bash
queuectl status
```

**Displays:**

- Total jobs by state (pending, processing, completed, Failed, dead)
- Number of active workers
- Used to monitor system health at a glance

### 5. Dead Letter Queue (DLQ)

The DLQ stores jobs that failed after all retries.

**List DLQ Jobs:**

```bash
queuectl dlq list
```

**Shows:**

- Job ID
- Command
- Attempts
- Error
- Failed at

**Retry a DLQ Job:**

```bash
queuectl dlq retry <job-id>
```

Moves a job from DLQ back to the main queue as pending and removes it from the DLQ. If it fails again, it returns to the DLQ.

### 6. Configuration Management

Change system-wide settings such as retry limits and exponential backoff base.

**Syntax:**

```bash
queuectl config set <key> <value>
```

**Examples:**

```bash
queuectl config set max_retries 5
queuectl config set backoff_base 2
```

**Keys:**

- `max_retries` - Default retry count for all jobs
- `backoff_base` - Base used for exponential retry delay (retry delay = base ^ attempts seconds)

Values are stored persistently in the config table of jobs.db.

---

## Important Test Cases

**Note:** For testing cases, delete the contents of the jobs.db before running new test case so that there will be no confusion for validating that test case.

---

### Test Case 1: Basic Job Completes Successfully

#### Goal

Verify that a simple job enqueued into the system is processed by a worker and moves from pending to completed.

#### Steps to Execute

**1. Enqueue a simple job:**

```bash
queuectl enqueue '{"id":"tc1-job","command":"echo Hello_TC1"}'
```

```
✓ Job enqueued successfully
┌─ Job Details ─────────────────────────────────┐
│                                               │
│  Job ID: tc1-job                              │
│  Command: echo Hello_TC1                      │
│  State: pending                               │
│                                               │
└───────────────────────────────────────────────┘
```

**2. Check queue status before starting worker:**

```bash
queuectl status
```

```
✓ Status retrieved
┌─ Queue Status ────────────────────────────────┐
│                                               │
│  Job States:                                  │
│                                               │
│  • Pending         ████████████████████      1│
│  • Processing                                0|
│  • Failed Retryable                          0│
│  • Completed                                 0│
│  • Dead Letter                               0│
│                                               │
│  ───────────────────────────────────────────  │
│                                               │
│  Active Workers:                             0│
│                                               │
└───────────────────────────────────────────────┘
```

**3. Start a worker:**

```bash
queuectl worker start --count 1
```

**4. Wait a few seconds and recheck status:**

```bash
queuectl status
```

```
✓ Status retrieved
┌─ Queue Status ────────────────────────────────┐
│                                               │
│  Job States:                                  │
│                                               │
│  • Pending                                   0│
│  • Processing                                0│
│  • Failed Retryable                          0│
│  • Completed        ████████████████████     1│
│  • Dead Letter                               0│
│                                               │
│  ───────────────────────────────────────────  │
│                                               │
│  Active Workers:                             1│
│                                               │
└───────────────────────────────────────────────┘
```



**5. List Completed Jobs:**

```bash
queuectl list --state completed
```

```
✔ Found 1 job(s) with state: completed

┌────────────┬────────────────────────────┬──────────┬────────────┬────────────────────┬────────────────────┐
│ ID         │ Command                    │ Attempts │ Exit Code  │ Created At         │ Available At       │        
├────────────┼────────────────────────────┼──────────┼────────────┼────────────────────┼────────────────────┤        
│ tc1-job    │ echo Hello_TC1             │ 1        │ 0          │ 2025-11-08         │ 20:26:26           │        
│            │                            │          │            │ 20:26:26           │                    │        
└────────────┴────────────────────────────┴──────────┴────────────┴────────────────────┴────────────────────┘  
```

**6. Stop the worker:**

```bash
queuectl worker stop
```



#### Pass Criteria

You can verify Basic job completes successfully when:

- The job tc1-job goes to completed within a few seconds
- There are no jobs in the DLQ
- Processing returns to 0 after job completion
- Completion becomes 1

---

### Test Case 2: Failed Job Retries with Backoff and Moves to DLQ

#### Goal

Verify that a job which fails to execute is retried automatically with exponential backoff, and after exceeding its maximum retries, it is moved to the Dead Letter Queue (DLQ).

#### Steps to Execute

**1. Set retry and backoff configuration:**

```bash
queuectl config set max_retries 3
queuectl config set backoff_base 2
```

```
✓ Configuration updated
┌─ Config Set ──────────────────────┐
│                                   │
│  Key: max_retries                 │
│  New Value: 3                     │
│                                   │
└───────────────────────────────────┘
✓ Configuration updated
┌─ Config Set ──────────────────────┐
│                                   │
│  Key: backoff_base                │
│  New Value: 2                     │
│                                   │
└───────────────────────────────────┘
```

This means the system will retry each failed job up to 3 times, with exponential backoff delays: 1s → 2s → 4s → 8s between attempts.

**2. Enqueue a job that will intentionally fail:**

```bash
queuectl enqueue '{"id":"tc2-job","command":"invalid_command_xyz"}'
```

**3. Start one worker:**

```bash
queuectl worker start --count 1
```

**4. Monitor job state over time:**

The movement will be very fast it would be better if you observe this in web interface:

```bash
queuectl status
```

```
✓ Status retrieved
┌─ Queue Status ────────────────────────────────┐
│                                               │
│  Job States:                                  │
│                                               │
│  • Pending                                   0│
│  • Processing                                0│
│  • Failed Retryable ████████████████████     1│
│  • Completed                                 0│
│  • Dead Letter                               0│
│                                               │
│  ───────────────────────────────────────────  │
│                                               │
│  Active Workers:                             1│
│                                               │
└───────────────────────────────────────────────┘

✓ Status retrieved
┌─ Queue Status ────────────────────────────────┐
│                                               │
│  Job States:                                  │
│                                               │
│  • Pending                                   0│
│  • Processing       ████████████████████     1│
│  • Failed Retryable                          0│
│  • Completed                                 0│
│  • Dead Letter                               0│
│                                               │
│  ───────────────────────────────────────────  │
│                                               │
│  Active Workers:                             1│
│                                               │
└───────────────────────────────────────────────┘
```
Final State
```
✓ Status retrieved
┌─ Queue Status ────────────────────────────────┐
│                                               │
│  Job States:                                  │
│                                               │
│  • Pending                                   0│
│  • Processing                                0│
│  • Failed Retryable                          0│
│  • Completed                                 0│
│  • Dead Letter      ████████████████████     1│
│                                               │
│  ───────────────────────────────────────────  │
│                                               │
│  Active Workers:                             1│
│                                               │
└───────────────────────────────────────────────┘
```

You should observe:

- The job moving between processing and pending as retries occur (if in terminal)
- Eventually, it disappears from main jobs and appears in DLQ

**5. View DLQ contents:**

```bash
queuectl dlq list
```

```
✓ Found 1 job(s) in the DLQ.
┌───────────────┬────────────────────┬──────────┬──────────────────────────────┬──────────────────────┐
│ ID            │ Command            │ Attempts │ Error                        │ Failed At            │
├───────────────┼────────────────────┼──────────┼──────────────────────────────┼──────────────────────┤
│ tc2-job       │ invalid_command_x… │ 4        │ Command failed:              │ 2025-11-07T15:35:38Z │
│               │                    │          │ 'invalid_command_xyz' is not │                      │
│               │                    │          │ recognized as an internal or │                      │
│               │                    │          │ external command, operable   │                      │
│               │                    │          │ program or batch file.       │                      │
└───────────────┴────────────────────┴──────────┴──────────────────────────────┴──────────────────────┘
```


**6. Stop all workers:**

```bash
queuectl worker stop
```


#### Pass Criteria

- The job fails and is retried automatically 3 times (4 total attempts)
- Retry delays follow the exponential pattern
- After the final failure, job is moved to the DLQ
- DLQ shows total attempts 4

---

### Test Case 3: Multiple Workers Process Jobs Without Overlap

#### Goal

Verify that multiple workers can run in parallel and that no job is processed more than once (no duplicate execution).

#### Steps to Execute

**1. Enqueue 5 jobs (3 seconds each):**

```bash
queuectl enqueue '{"id":"job-A","command":"sleep 3"}'
queuectl enqueue '{"id":"job-B","command":"sleep 3"}'
queuectl enqueue '{"id":"job-C","command":"sleep 3"}'
queuectl enqueue '{"id":"job-D","command":"sleep 3"}'
queuectl enqueue '{"id":"job-E","command":"sleep 3"}'
```

**2. Start 3 workers simultaneously:**

```bash
queuectl worker start --count 3
```

#### Expected Output

**At first you will get status like this:**

```
✓ Status retrieved
┌─ Queue Status ────────────────────────────────┐
│                                               │
│  Job States:                                  │
│                                               │
│  • Pending                                   0│
│  • Processing       ████████                 2│
│  • Failed Retryable                          0│
│  • Completed        ████████████             3│
│  • Dead Letter                               0│
│                                               │
│  ───────────────────────────────────────────  │
│                                               │
│  Active Workers:                             3│
│                                               │
└───────────────────────────────────────────────┘
```

- Processing: 3 (Proof of Parallelism)
- Pending: 2 (Proof of Locking; no worker grabbed a duplicate job, and 3 unique jobs are running)

**After waiting a few seconds the output will be like this:**

```
✓ Status retrieved
┌─ Queue Status ────────────────────────────────┐
│                                               │
│  Job States:                                  │
│                                               │
│  • Pending                                   0│
│  • Processing                                0│
│  • Failed Retryable                          0│
│  • Completed        ████████████████████     5│
│  • Dead Letter                               0│
│                                               │
│  ───────────────────────────────────────────  │
│                                               │
│  Active Workers:                             3│
│                                               │
└───────────────────────────────────────────────┘
```

**3. Stop Workers:**

```bash
queuectl worker stop
```

---

### Test Case 4: Graceful Shutdown

#### Goal

This suite validates the mandatory requirement: the worker must finish its currently running job before the process exits, even if a stop signal is received.

#### Steps to Execute

**1. Enqueue a long-running job (15 seconds):**

```bash
queuectl enqueue '{"id":"job-grace-15s","command":"sleep 15"}'
```

**2. Start one worker:**

```bash
queuectl worker start
```

**3. Verify Job is Running (Wait 1-2 seconds):**

```bash
queuectl status
```

**Expected Result:**

```
✓ Status retrieved
┌─ Queue Status ────────────────────────────────┐
│                                               │
│  Job States:                                  │
│                                               │
│  • Pending                                   0│
│  • Processing       ████████████████████     1│
│  • Failed Retryable                          0│
│  • Completed                                 0│
│  • Dead Letter                               0│
│                                               │
│  ───────────────────────────────────────────  │
│                                               │
│  Active Workers:                             1│
│                                               │
└───────────────────────────────────────────────┘
```

**4. Issue the Stop Command:**

```bash
queuectl worker stop
```

Run the stop command. This command should pause for the remaining 10 to 12 seconds and then it will stop the worker.

**5. Check Final Status:**

```bash
queuectl status
```

**Expected Result:**

```
✓ Status retrieved
┌─ Queue Status ────────────────────────────────┐
│                                               │
│  Job States:                                  │
│                                               │
│  • Pending                                   0│
│  • Processing                                0│
│  • Failed Retryable                          0│
│  • Completed        ████████████████████     1│
│  • Dead Letter                               0│
│                                               │
│  ───────────────────────────────────────────  │
│                                               │
│  Active Workers:                             0│
│                                               │
└───────────────────────────────────────────────┘
```

#### Pass Criteria

This successful result confirms that the worker did not die when it received the signal; it completed the entire 15-second process, updated the database, and then exited, fulfilling the mandatory requirement.

---

### Test Case 5: Persistence

#### Goal

This suite validates that job data survives application shutdown and system restarts, ensuring data is correctly written to the persistent jobs.db file.

#### Steps to Execute

**1. Enqueue a job that will remain in the pending state:**

```bash
queuectl enqueue '{"id":"job-persist-test","command":"echo I survived the restart"}'
```

**2. Verify Initial Status:**

```bash
queuectl status
```

```
✓ Status retrieved
┌─ Queue Status ────────────────────────────────┐
│                                               │
│  Job States:                                  │
│                                               │
│  • Pending          ████████████████████     1│
│  • Processing                                0│
│  • Failed Retryable                          0│
│  • Completed                                 0│
│  • Dead Letter                               0│
│                                               │
│  ───────────────────────────────────────────  │
│                                               │
│  Active Workers:                             0│
│                                               │
└───────────────────────────────────────────────┘
```

**3. Simulate System Restart:**

Close the current terminal window entirely. (This is the most effective way to prove all application processes are dead.)

**4. Open a brand new terminal and again check the status:**

```bash
queuectl status
```

**Expected Result:**

```
✓ Status retrieved
┌─ Queue Status ────────────────────────────────┐
│                                               │
│  Job States:                                  │
│                                               │
│  • Pending          ████████████████████     1│
│  • Processing                                0│
│  • Failed Retryable                          0│
│  • Completed                                 0│
│  • Dead Letter                               0│
│                                               │
│  ───────────────────────────────────────────  │
│                                               │
│  Active Workers:                             0│
│                                               │
└───────────────────────────────────────────────┘
```

#### Pass Criteria

A brand new instance of queuectl successfully read the job from the database hence persistence is achieved.
