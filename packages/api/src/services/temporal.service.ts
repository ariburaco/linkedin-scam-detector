/**
 * Temporal Service
 * Handles workflow triggering and status checking for async AI operations
 */

import { env } from "@acme/shared/env";
import { Logger } from "@acme/shared/Logger";
import { Client, Connection } from "@temporalio/client";

const logger = new Logger("TemporalService");

export class TemporalService {
  private static client: Client | null = null;

  /**
   * Get or create Temporal client
   */
  private static async getClient(): Promise<Client> {
    if (!this.client) {
      // Parse Temporal address - Connection.connect expects hostname:port, not URL
      // Handle both formats: "http://localhost:7234" -> "localhost:7234" or "localhost:7234"
      let temporalAddress = env.TEMPORAL_ADDRESS;
      try {
        const url = new URL(temporalAddress);
        temporalAddress = `${url.hostname}:${url.port || "7233"}`;
      } catch {
        // Already in hostname:port format or invalid, use as-is
      }

      logger.info("Connecting to Temporal server", {
        originalAddress: env.TEMPORAL_ADDRESS,
        parsedAddress: temporalAddress,
        namespace: env.TEMPORAL_NAMESPACE,
      });

      const connection = await Connection.connect({
        address: temporalAddress,
      });

      this.client = new Client({
        connection,
        namespace: env.TEMPORAL_NAMESPACE,
      });

      logger.info("Temporal client connected successfully");
    }

    return this.client;
  }

  /**
   * Start Job Embedding Generation workflow
   */
  static async startJobEmbeddingWorkflow(params: {
    jobId: string;
    title: string;
    company: string;
    description: string;
  }): Promise<{
    workflowId: string;
    runId: string;
  }> {
    const client = await this.getClient();
    const workflowId = `job-embedding-${params.jobId}-${Date.now()}`;

    logger.info("Starting job embedding workflow", {
      workflowId,
      jobId: params.jobId,
    });

    const handle = await client.workflow.start("GenerateJobEmbedding", {
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      workflowId,
      args: [
        {
          jobId: params.jobId,
          title: params.title,
          company: params.company,
          description: params.description,
        },
      ],
    });

    logger.info("Job embedding workflow started", {
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId,
    });

    return {
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId,
    };
  }

  /**
   * Start Job Data Extraction workflow
   */
  static async startJobExtractionWorkflow(params: {
    jobId: string;
    jobText: string;
    jobTitle?: string;
    companyName?: string;
  }): Promise<{
    workflowId: string;
    runId: string;
  }> {
    const client = await this.getClient();
    const workflowId = `job-extraction-${params.jobId}-${Date.now()}`;

    logger.info("Starting job extraction workflow", {
      workflowId,
      jobId: params.jobId,
    });

    const handle = await client.workflow.start("ExtractJobData", {
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      workflowId,
      args: [
        {
          jobId: params.jobId,
          jobText: params.jobText,
          jobTitle: params.jobTitle,
          companyName: params.companyName,
        },
      ],
    });

    logger.info("Job extraction workflow started", {
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId,
    });

    return {
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId,
    };
  }

  /**
   * Get workflow status
   */
  static async getWorkflowStatus(workflowId: string): Promise<{
    workflowId: string;
    runId: string;
    status: string;
    result?: unknown;
  }> {
    const client = await this.getClient();
    const handle = client.workflow.getHandle(workflowId);

    const description = await handle.describe();

    return {
      workflowId: handle.workflowId,
      runId: description.runId,
      status: description.status.name,
      result:
        description.status.name === "COMPLETED"
          ? await handle.result()
          : undefined,
    };
  }

  /**
   * Cancel workflow
   */
  static async cancelWorkflow(workflowId: string): Promise<void> {
    const client = await this.getClient();
    const handle = client.workflow.getHandle(workflowId);

    await handle.cancel();

    logger.info("Workflow cancelled", { workflowId });
  }

  /**
   * Close Temporal client connection
   */
  static async close(): Promise<void> {
    if (this.client) {
      await this.client.connection.close();
      this.client = null;
      logger.info("Temporal client connection closed");
    }
  }
}
