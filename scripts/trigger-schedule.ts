#!/usr/bin/env bun

/**
 * Trigger Temporal Schedule Script
 * Allows triggering scheduled workflows immediately without waiting for the schedule
 * 
 * Usage:
 *   bun scripts/trigger-schedule.ts list                    # List all schedules
 *   bun scripts/trigger-schedule.ts trigger <schedule-id>   # Trigger a specific schedule
 *   bun scripts/trigger-schedule.ts workflow <workflow-type> # Trigger a workflow directly
 */

import { Connection, Client } from '@temporalio/client';
import { env } from '@acme/shared/env';
import { Logger } from '@acme/shared/Logger';
import { schedules } from '../apps/workers/src/schedules';

const logger = new Logger('TriggerSchedule');

async function getClient(): Promise<Client> {
  // Parse Temporal address
  let temporalAddress = env.TEMPORAL_ADDRESS;
  try {
    const url = new URL(temporalAddress);
    temporalAddress = `${url.hostname}:${url.port || '7233'}`;
  } catch {
    // Already in hostname:port format
  }

  const connection = await Connection.connect({
    address: temporalAddress,
  });

  return new Client({
    connection,
    namespace: env.TEMPORAL_NAMESPACE,
  });
}

async function listSchedules() {
  const client = await getClient();
  
  console.log('📋 Available Schedules:\n');
  
  for (const scheduleConfig of schedules) {
    try {
      const handle = client.schedule.getHandle(scheduleConfig.scheduleId);
      const description = await handle.describe();
      
      console.log(`  📅 ${scheduleConfig.scheduleId}`);
      console.log(`     Description: ${scheduleConfig.description}`);
      console.log(`     Cron: ${scheduleConfig.cronExpression}`);
      console.log(`     Workflow: ${scheduleConfig.workflowType}`);
      console.log(`     Status: ${description.state.paused ? '⏸️  Paused' : '▶️  Active'}`);
      console.log(`     Next Run: ${description.info.nextActionTimes[0]?.toISOString() || 'N/A'}`);
      console.log('');
    } catch (error) {
      console.log(`  ❌ ${scheduleConfig.scheduleId} (not found)`);
      console.log(`     Description: ${scheduleConfig.description}`);
      console.log(`     Workflow: ${scheduleConfig.workflowType}`);
      console.log('');
    }
  }
}

async function triggerSchedule(scheduleId: string) {
  const client = await getClient();
  
  // Find schedule config
  const scheduleConfig = schedules.find((s) => s.scheduleId === scheduleId);
  if (!scheduleConfig) {
    console.error(`❌ Schedule not found: ${scheduleId}`);
    console.log('\nAvailable schedules:');
    schedules.forEach((s) => console.log(`  - ${s.scheduleId}`));
    process.exit(1);
  }

  try {
    console.log(`🚀 Triggering schedule: ${scheduleId}`);
    console.log(`   Workflow: ${scheduleConfig.workflowType}`);
    console.log(`   Description: ${scheduleConfig.description}\n`);

    const handle = client.schedule.getHandle(scheduleId);
    
    // Trigger the schedule immediately
    await handle.trigger();
    
    console.log('✅ Schedule triggered successfully!');
    console.log('   The workflow will start immediately.\n');
    
    // Get schedule info to show next run
    const description = await handle.describe();
    console.log('📊 Schedule Info:');
    console.log(`   Status: ${description.state.paused ? 'Paused' : 'Active'}`);
    console.log(`   Next scheduled run: ${description.info.nextActionTimes[0]?.toISOString() || 'N/A'}`);
    
  } catch (error) {
    console.error('❌ Failed to trigger schedule:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('\nStack:', error.stack);
    }
    process.exit(1);
  }
}

async function triggerWorkflow(workflowType: string, customArgs?: string) {
  const client = await getClient();
  
  // Find schedule config for this workflow type to get default args
  const scheduleConfig = schedules.find((s) => s.workflowType === workflowType);
  
  let workflowArgs: any[];
  
  if (customArgs) {
    try {
      workflowArgs = JSON.parse(customArgs);
      if (!Array.isArray(workflowArgs)) {
        workflowArgs = [workflowArgs];
      }
    } catch (error) {
      console.error('❌ Invalid JSON for workflow args:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  } else if (scheduleConfig) {
    workflowArgs = scheduleConfig.workflowArgs;
    console.log(`📋 Using default args from schedule: ${scheduleConfig.scheduleId}`);
  } else {
    console.error(`❌ Workflow type not found: ${workflowType}`);
    console.log('\nAvailable workflow types:');
    const uniqueTypes = [...new Set(schedules.map((s) => s.workflowType))];
    uniqueTypes.forEach((t) => console.log(`  - ${t}`));
    process.exit(1);
  }

  try {
    const workflowId = `${workflowType.toLowerCase()}-manual-${Date.now()}`;
    
    console.log(`🚀 Starting workflow: ${workflowType}`);
    console.log(`   Workflow ID: ${workflowId}`);
    console.log(`   Args: ${JSON.stringify(workflowArgs, null, 2)}\n`);

    const handle = await client.workflow.start(workflowType, {
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      workflowId,
      args: workflowArgs,
    });
    
    console.log('✅ Workflow started successfully!');
    console.log(`   Workflow ID: ${handle.workflowId}`);
    console.log(`   Run ID: ${handle.firstExecutionRunId}`);
    console.log(`\n💡 Monitor progress in Temporal UI or use:`);
    console.log(`   bun scripts/check-workflow.ts ${handle.workflowId}`);
    
  } catch (error) {
    console.error('❌ Failed to start workflow:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('\nStack:', error.stack);
    }
    process.exit(1);
  }
}

async function main() {
  // Filter out '--' which is used as a separator in npm/bun scripts
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  const command = args[0];

  if (!command) {
    console.log('📋 Temporal Schedule Trigger\n');
    console.log('Usage:');
    console.log('  bun scripts/trigger-schedule.ts list');
    console.log('  bun scripts/trigger-schedule.ts trigger <schedule-id>');
    console.log('  bun scripts/trigger-schedule.ts workflow <workflow-type> [args-json]\n');
    console.log('Examples:');
    console.log('  bun scripts/trigger-schedule.ts list');
    console.log('  bun scripts/trigger-schedule.ts trigger scrape-linkedin-jobs-daily');
    console.log('  bun scripts/trigger-schedule.ts workflow ScrapeLinkedInJobs');
    console.log('  bun scripts/trigger-schedule.ts workflow ScrapeLinkedInJobs \'{"searchParams":{"keywords":"developer","location":"Remote","maxResults":10},"scrapeDetails":false}\'');
    process.exit(0);
  }

  try {
    switch (command) {
      case 'list':
        await listSchedules();
        break;
        
      case 'trigger':
        if (!args[1]) {
          console.error('❌ Please provide a schedule ID');
          console.log('\nUsage: bun scripts/trigger-schedule.ts trigger <schedule-id>');
          process.exit(1);
        }
        await triggerSchedule(args[1]);
        break;
        
      case 'workflow':
        if (!args[1]) {
          console.error('❌ Please provide a workflow type');
          console.log('\nUsage: bun scripts/trigger-schedule.ts workflow <workflow-type> [args-json]');
          process.exit(1);
        }
        await triggerWorkflow(args[1], args[2]);
        break;
        
      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log('\nAvailable commands: list, trigger, workflow');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('\nStack:', error.stack);
    }
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}

