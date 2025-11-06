#!/usr/bin/env bun

/**
 * Manual Process Discovered Jobs Script
 * Triggers the ProcessDiscoveredJobs schedule or workflow manually
 *
 * Usage:
 *   bun scripts/process-discovered-jobs.ts                    # Trigger workflow with defaults
 *   bun scripts/process-discovered-jobs.ts --schedule hourly   # Trigger hourly schedule
 *   bun scripts/process-discovered-jobs.ts --schedule daily    # Trigger daily schedule
 *   bun scripts/process-discovered-jobs.ts --batch-size 100    # Trigger workflow with custom batch size
 */

import { Connection, Client } from '@temporalio/client';
import { env } from '@acme/shared/env';
import type { ProcessDiscoveredJobsWorkflowInput } from '../apps/workers/src/workflows/process-discovered-jobs.workflow';

async function triggerSchedule(scheduleId: string) {
  // Parse Temporal address
  let temporalAddress = env.TEMPORAL_ADDRESS;
  try {
    const url = new URL(temporalAddress);
    temporalAddress = `${url.hostname}:${url.port || '7233'}`;
  } catch {
    // Already in hostname:port format
  }

  console.log('🔗 Connecting to Temporal server...');
  console.log(`   Address: ${temporalAddress}`);
  console.log(`   Namespace: ${env.TEMPORAL_NAMESPACE}\n`);

  const connection = await Connection.connect({
    address: temporalAddress,
  });

  const client = new Client({
    connection,
    namespace: env.TEMPORAL_NAMESPACE,
  });

  try {
    console.log(`🚀 Triggering schedule: ${scheduleId}\n`);

    const handle = client.schedule.getHandle(scheduleId);

    // Trigger the schedule immediately
    await handle.trigger();

    console.log('✅ Schedule triggered successfully!');
    console.log('   The workflow will start immediately.\n');

    // Get schedule info
    const description = await handle.describe();
    console.log('📊 Schedule Info:');
    console.log(`   Status: ${description.state.paused ? 'Paused' : 'Active'}`);
    console.log(
      `   Next scheduled run: ${description.info.nextActionTimes[0]?.toISOString() || 'N/A'}\n`
    );

    await connection.close();
  } catch (error) {
    console.error(
      '❌ Failed to trigger schedule:',
      error instanceof Error ? error.message : String(error)
    );
    if (error instanceof Error && error.stack) {
      console.error(`   Stack: ${error.stack}`);
    }
    await connection.close();
    process.exit(1);
  }
}

async function processDiscoveredJobs(
  input: ProcessDiscoveredJobsWorkflowInput = {}
) {
  // Parse Temporal address - Connection.connect expects hostname:port, not URL
  let temporalAddress = env.TEMPORAL_ADDRESS;
  try {
    const url = new URL(temporalAddress);
    temporalAddress = `${url.hostname}:${url.port || '7233'}`;
  } catch {
    // Already in hostname:port format or invalid, use as-is
  }

  console.log('🔗 Connecting to Temporal server...');
  console.log(`   Address: ${temporalAddress}`);
  console.log(`   Namespace: ${env.TEMPORAL_NAMESPACE}`);
  console.log(`   Task Queue: ${env.TEMPORAL_TASK_QUEUE}\n`);

  const connection = await Connection.connect({
    address: temporalAddress,
  });

  const client = new Client({
    connection,
    namespace: env.TEMPORAL_NAMESPACE,
  });

  const workflowId = `process-discovered-jobs-manual-${Date.now()}`;
  const workflowInput: ProcessDiscoveredJobsWorkflowInput = {
    batchSize: input.batchSize ?? 50,
    limit: input.limit,
    priority: input.priority ?? true,
    triggerExtraction: input.triggerExtraction ?? false,
    triggerEmbedding: input.triggerEmbedding ?? false,
  };

  console.log('🚀 Starting ProcessDiscoveredJobs workflow...');
  console.log(`   Workflow ID: ${workflowId}`);
  console.log(`   Batch Size: ${workflowInput.batchSize}`);
  if (workflowInput.limit) {
    console.log(
      `   Limit: ${workflowInput.limit} (will process up to this many)`
    );
  }
  console.log(`   Priority: ${workflowInput.priority}`);
  console.log(`   Trigger Extraction: ${workflowInput.triggerExtraction}`);
  console.log(`   Trigger Embedding: ${workflowInput.triggerEmbedding}\n`);

  try {
    const handle = await client.workflow.start('ProcessDiscoveredJobs', {
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      workflowId,
      args: [workflowInput],
    });

    console.log('✅ Workflow started successfully!');
    console.log(`   Workflow ID: ${handle.workflowId}`);
    console.log(`   Run ID: ${handle.firstExecutionRunId}\n`);

    console.log('⏳ Waiting for workflow to complete...\n');

    // Wait for result
    const result = await handle.result();

    console.log('📊 Workflow completed!');
    console.log(`   Processed: ${result.processed}`);
    console.log(`   Failed: ${result.failed}`);
    console.log(`   Skipped: ${result.skipped}`);
    console.log(`   Total: ${result.total}`);
    
    if (result.processedJobIds && result.processedJobIds.length > 0) {
      console.log(`   Processed Job IDs: ${result.processedJobIds.join(', ')}`);
    }
    
    if (result.failedJobIds && result.failedJobIds.length > 0) {
      console.log(`   Failed Job IDs: ${result.failedJobIds.join(', ')}`);
    }
    
    // Also output as JSON for programmatic access
    console.log('\n📋 Result (JSON):');
    console.log(JSON.stringify(result, null, 2));
    console.log('');

    await connection.close();
  } catch (error) {
    console.error('❌ Failed to start workflow:', error);
    if (error instanceof Error) {
      console.error(`   Message: ${error.message}`);
      if (error.stack) {
        console.error(`   Stack: ${error.stack}`);
      }
    }
    await connection.close();
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== '--');

  // Check if user wants to trigger a schedule
  let scheduleToTrigger: string | null = null;
  const input: ProcessDiscoveredJobsWorkflowInput = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--schedule':
      case '-s':
        if (nextArg && !nextArg.startsWith('--')) {
          if (nextArg === 'hourly' || nextArg === 'daily') {
            scheduleToTrigger = `process-discovered-jobs-${nextArg}`;
            i++;
          } else {
            console.error(`❌ Invalid schedule: ${nextArg}`);
            console.error('   Valid options: hourly, daily');
            process.exit(1);
          }
        } else {
          console.error('❌ --schedule requires a value (hourly or daily)');
          process.exit(1);
        }
        break;

      case '--batch-size':
      case '-b':
        if (nextArg && !nextArg.startsWith('--')) {
          input.batchSize = parseInt(nextArg, 10);
          if (isNaN(input.batchSize)) {
            console.error(`❌ Invalid batch size: ${nextArg}`);
            process.exit(1);
          }
          i++;
        } else {
          console.error('❌ --batch-size requires a number');
          process.exit(1);
        }
        break;

      case '--limit':
      case '-l':
        if (nextArg && !nextArg.startsWith('--')) {
          input.limit = parseInt(nextArg, 10);
          if (isNaN(input.limit) || input.limit < 1) {
            console.error(
              `❌ Invalid limit: ${nextArg} (must be a positive number)`
            );
            process.exit(1);
          }
          i++;
        } else {
          console.error('❌ --limit requires a number');
          process.exit(1);
        }
        break;

      case '--no-priority':
        input.priority = false;
        break;

      case '--priority':
        input.priority = true;
        break;

      case '--trigger-extraction':
        input.triggerExtraction = true;
        break;

      case '--trigger-embedding':
        input.triggerEmbedding = true;
        break;

      case '--help':
      case '-h':
        console.log(`
Usage: bun scripts/process-discovered-jobs.ts [options]

Options:
  --schedule, -s <type>        Trigger a schedule instead of workflow
                               Options: hourly, daily
  --batch-size, -b <number>    Number of jobs to fetch from database (default: 50)
  --limit, -l <number>         Maximum number of jobs to process (stops early)
  --priority                    Process jobs by priority score (default: true)
  --no-priority                 Process jobs in discovery order
  --trigger-extraction          Trigger extraction workflow after processing
  --trigger-embedding           Trigger embedding workflow after processing
  --help, -h                    Show this help message

Examples:
  # Trigger hourly schedule
  bun scripts/process-discovered-jobs.ts --schedule hourly

  # Trigger daily schedule
  bun scripts/process-discovered-jobs.ts --schedule daily

  # Process 50 jobs with priority (workflow)
  bun scripts/process-discovered-jobs.ts

  # Process only 10 jobs (limit)
  bun scripts/process-discovered-jobs.ts --limit 10

  # Fetch 100 jobs but only process 25
  bun scripts/process-discovered-jobs.ts --batch-size 100 --limit 25

  # Process 100 jobs without priority (workflow)
  bun scripts/process-discovered-jobs.ts --batch-size 100 --no-priority

  # Process 25 jobs and trigger extraction/embedding (workflow)
  bun scripts/process-discovered-jobs.ts --batch-size 25 --trigger-extraction --trigger-embedding
`);
        process.exit(0);
        break;

      default:
        console.error(`❌ Unknown argument: ${arg}`);
        console.error('   Use --help for usage information');
        process.exit(1);
    }
  }

  // If schedule is specified, trigger it instead of the workflow
  if (scheduleToTrigger) {
    await triggerSchedule(scheduleToTrigger);
  } else {
    await processDiscoveredJobs(input);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}
