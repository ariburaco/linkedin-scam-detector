/**
 * Temporal Schedules Setup
 * Configures CRON schedules for automated workflows
 */

import { Connection, Client } from '@temporalio/client';
import { Logger } from '@acme/shared/Logger';
import { env } from '@acme/shared/env';

const logger = new Logger('TemporalSchedules');

export interface ScheduleConfig {
  scheduleId: string;
  cronExpression: string;
  workflowType: string;
  workflowArgs: any[];
  description: string;
  paused?: boolean;
}

/**
 * Schedule Configurations
 */
export const schedules: ScheduleConfig[] = [
  {
    scheduleId: 'bulk-refresh-daily',
    cronExpression: '0 2 * * *', // 2 AM daily
    workflowType: 'bulkRefreshWorkflow',
    workflowArgs: [{}], // All tracked products
    description: 'Daily refresh of all tracked products',
    paused: false,
  },
  {
    scheduleId: 'bulk-refresh-high-priority',
    cronExpression: '0 */6 * * *', // Every 6 hours
    workflowType: 'bulkRefreshWorkflow',
    workflowArgs: [
      {
        // productIds: ['high-priority-1', 'high-priority-2'], // TODO: Add high-priority product IDs
      },
    ],
    description: 'Frequent refresh for high-priority products',
    paused: true, // Start paused until we define priority products
  },
  {
    scheduleId: 'bulk-refresh-hourly-testing',
    cronExpression: '0 * * * *', // Every hour
    workflowType: 'bulkRefreshWorkflow',
    workflowArgs: [
      {
        // productIds: ['test-1', 'test-2'], // TODO: Add test product IDs
      },
    ],
    description: 'Hourly refresh for testing (can be paused)',
    paused: true, // Start paused, enable for testing
  },
  // 10 seconds interval
  {
    scheduleId: 'bulk-refresh-1-seconds',
    cronExpression: '*/1 * * * * *', // Every 10 seconds
    workflowType: 'bulkRefreshWorkflow',
    workflowArgs: [{}],
    description: '1 seconds interval refresh',
    paused: false, // Start paused, enable for testing
  },
];

/**
 * Create or update a schedule
 */
async function createOrUpdateSchedule(
  client: Client,
  config: ScheduleConfig
): Promise<void> {
  try {
    logger.info('Creating/updating schedule in scheduled namespace', {
      scheduleId: config.scheduleId,
      cronExpression: config.cronExpression,
      namespace: env.TEMPORAL_NAMESPACE,
    });

    const handle = client.schedule.getHandle(config.scheduleId);

    // Try to describe the schedule (check if it exists)
    try {
      await handle.describe();
      logger.info('Schedule exists, checking if update needed', {
        scheduleId: config.scheduleId,
      });

      // For simplicity, we'll delete and recreate instead of updating
      // Temporal schedule updates are complex and often easier to recreate
      logger.info('Deleting existing schedule to recreate', {
        scheduleId: config.scheduleId,
      });
      await handle.delete();

      // Fall through to creation logic below
      throw new Error('Schedule deleted, will recreate');
    } catch (error) {
      // Schedule doesn't exist, create it
      logger.info('Creating schedule in scheduled namespace', {
        scheduleId: config.scheduleId,
        namespace: env.TEMPORAL_NAMESPACE,
      });

      await client.schedule.create({
        scheduleId: config.scheduleId,
        spec: {
          cronExpressions: [config.cronExpression],
        },
        action: {
          type: 'startWorkflow',
          workflowType: config.workflowType,
          args: config.workflowArgs,
          taskQueue: env.TEMPORAL_TASK_QUEUE,
          workflowId: `${config.scheduleId}-${Date.now()}`,
        },
        policies: {
          overlap: 'BUFFER_ONE', // Buffer one execution if previous is still running
          catchupWindow: '1 day', // Catch up missed executions within 1 day
        },
        state: {
          paused: config.paused || false,
          note: config.description,
        },
      });

      logger.info('Schedule created successfully in scheduled namespace', {
        scheduleId: config.scheduleId,
        namespace: env.TEMPORAL_NAMESPACE,
      });
    }
  } catch (error) {
    logger.error('Failed to create/update schedule', {
      scheduleId: config.scheduleId,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Setup all schedules
 */
export async function setupSchedules(): Promise<void> {
  try {
    logger.info('Setting up Temporal schedules in scheduled namespace...', {
      count: schedules.length,
      namespace: env.TEMPORAL_NAMESPACE,
    });

    // Connect to Temporal
    const connection = await Connection.connect({
      address: env.TEMPORAL_ADDRESS,
    });

    const client = new Client({
      connection,
      namespace: env.TEMPORAL_NAMESPACE, // Use scheduled namespace
    });

    logger.info('Connected to Temporal for schedule setup', {
      namespace: env.TEMPORAL_NAMESPACE,
    });

    // Create/update all schedules
    for (const schedule of schedules) {
      await createOrUpdateSchedule(client, schedule);
    }

    logger.info('All schedules set up successfully in scheduled namespace', {
      namespace: env.TEMPORAL_NAMESPACE,
      total: schedules.length,
      active: schedules.filter((s) => !s.paused).length,
      paused: schedules.filter((s) => s.paused).length,
    });

    // Close connection
    await connection.close();
  } catch (error) {
    logger.error('Failed to setup schedules', error as Error);
    throw error;
  }
}

/**
 * List all schedules
 */
export async function listSchedules(): Promise<void> {
  try {
    const connection = await Connection.connect({
      address: env.TEMPORAL_ADDRESS,
    });

    const client = new Client({
      connection,
      namespace: env.TEMPORAL_NAMESPACE,
    });

    logger.info('Listing all schedules in scheduled namespace...', {
      namespace: env.TEMPORAL_NAMESPACE,
    });

    const schedules = client.schedule.list();

    for await (const schedule of schedules) {
      logger.info('Schedule', {
        scheduleId: schedule.scheduleId,
        spec: schedule.spec,
        info: schedule.info,
      });
    }

    await connection.close();
  } catch (error) {
    logger.error('Failed to list schedules', error as Error);
    throw error;
  }
}

/**
 * Pause a schedule
 */
export async function pauseSchedule(scheduleId: string): Promise<void> {
  try {
    const connection = await Connection.connect({
      address: env.TEMPORAL_ADDRESS,
    });

    const client = new Client({
      connection,
      namespace: env.TEMPORAL_NAMESPACE,
    });

    const handle = client.schedule.getHandle(scheduleId);
    await handle.pause('Paused via CLI');

    logger.info('Schedule paused', {
      scheduleId,
      namespace: env.TEMPORAL_NAMESPACE,
    });

    await connection.close();
  } catch (error) {
    logger.error('Failed to pause schedule', {
      scheduleId,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Unpause a schedule
 */
export async function unpauseSchedule(scheduleId: string): Promise<void> {
  try {
    const connection = await Connection.connect({
      address: env.TEMPORAL_ADDRESS,
    });

    const client = new Client({
      connection,
      namespace: env.TEMPORAL_NAMESPACE,
    });

    const handle = client.schedule.getHandle(scheduleId);
    await handle.unpause('Unpaused via CLI');

    logger.info('Schedule unpaused', {
      scheduleId,
      namespace: env.TEMPORAL_NAMESPACE,
    });

    await connection.close();
  } catch (error) {
    logger.error('Failed to unpause schedule', {
      scheduleId,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Delete a schedule
 */
export async function deleteSchedule(scheduleId: string): Promise<void> {
  try {
    const connection = await Connection.connect({
      address: env.TEMPORAL_ADDRESS,
    });

    const client = new Client({
      connection,
      namespace: env.TEMPORAL_NAMESPACE,
    });

    const handle = client.schedule.getHandle(scheduleId);
    await handle.delete();

    logger.info('Schedule deleted', {
      scheduleId,
      namespace: env.TEMPORAL_NAMESPACE,
    });

    await connection.close();
  } catch (error) {
    logger.error('Failed to delete schedule', {
      scheduleId,
      error: (error as Error).message,
    });
    throw error;
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const scheduleId = process.argv[3];

  switch (command) {
    case 'setup':
      setupSchedules()
        .then(() => {
          logger.info('Schedules setup complete');
          process.exit(0);
        })
        .catch((err) => {
          logger.error('Setup failed', err);
          process.exit(1);
        });
      break;

    case 'list':
      listSchedules()
        .then(() => process.exit(0))
        .catch((err) => {
          logger.error('List failed', err);
          process.exit(1);
        });
      break;

    case 'pause':
      if (!scheduleId) {
        logger.error('Schedule ID required');
        process.exit(1);
      }
      pauseSchedule(scheduleId)
        .then(() => process.exit(0))
        .catch((err) => {
          logger.error('Pause failed', err);
          process.exit(1);
        });
      break;

    case 'unpause':
      if (!scheduleId) {
        logger.error('Schedule ID required');
        process.exit(1);
      }
      unpauseSchedule(scheduleId)
        .then(() => process.exit(0))
        .catch((err) => {
          logger.error('Unpause failed', err);
          process.exit(1);
        });
      break;

    case 'delete':
      if (!scheduleId) {
        logger.error('Schedule ID required');
        process.exit(1);
      }
      deleteSchedule(scheduleId)
        .then(() => process.exit(0))
        .catch((err) => {
          logger.error('Delete failed', err);
          process.exit(1);
        });
      break;

    default:
      console.log(`
Usage:
  bun run schedules.ts setup              - Create/update all schedules
  bun run schedules.ts list               - List all schedules
  bun run schedules.ts pause <scheduleId> - Pause a schedule
  bun run schedules.ts unpause <scheduleId> - Unpause a schedule
  bun run schedules.ts delete <scheduleId> - Delete a schedule
      `);
      process.exit(1);
  }
}
