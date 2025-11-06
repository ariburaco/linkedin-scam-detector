import prisma, { type InputJsonValue } from "@acme/db";

import { embeddingService } from "./embedding.service";
import { JobExtractionService } from "./job-extraction.service";
import { JobService } from "./job.service";

/**
 * Batch Embedding Service
 * Generates embeddings for existing jobs that don't have embeddings yet
 */
export class BatchEmbeddingService {
  private readonly batchSize: number;
  private readonly delayBetweenBatches: number;

  constructor() {
    this.batchSize = 10; // Process 10 jobs at a time
    this.delayBetweenBatches = 2000; // 2 second delay between batches to avoid rate limits
  }

  /**
   * Generate embeddings for jobs that don't have them
   */
  async generateMissingEmbeddings(options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ processed: number; success: number; failed: number }> {
    const { limit = 100, offset = 0 } = options || {};

    let processed = 0;
    let success = 0;
    let failed = 0;

    try {
      // Find jobs without embeddings
      const jobsWithoutEmbeddings = await prisma.$queryRaw<
        Array<{
          id: string;
          title: string;
          company: string;
          description: string;
        }>
      >`
        SELECT id, title, company, description
        FROM scam_detector_job
        WHERE embedding IS NULL
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      console.log(
        `[BatchEmbeddingService] Found ${jobsWithoutEmbeddings.length} jobs without embeddings`
      );

      // Process in batches
      for (let i = 0; i < jobsWithoutEmbeddings.length; i += this.batchSize) {
        const batch = jobsWithoutEmbeddings.slice(i, i + this.batchSize);

        // Process batch in parallel
        await Promise.all(
          batch.map(async (job) => {
            try {
              // Generate embedding
              const result = await embeddingService.embedJob({
                title: job.title,
                company: job.company,
                description: job.description,
              });

              // Update job with embedding and cost metadata using service
              await JobService.updateEmbeddingAndMetadata(
                job.id,
                result.embedding,
                result.costMetadata
                  ? (result.costMetadata as unknown as Record<string, unknown>)
                  : undefined
              );

              success++;
              processed++;
            } catch (error) {
              failed++;
              processed++;
              console.error(
                `[BatchEmbeddingService] Failed to generate embedding for job ${job.id}:`,
                error
              );
            }
          })
        );

        // Delay between batches to avoid rate limiting
        if (i + this.batchSize < jobsWithoutEmbeddings.length) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.delayBetweenBatches)
          );
        }
      }
    } catch (error) {
      console.error("[BatchEmbeddingService] Batch processing error:", error);
      throw error;
    }

    return { processed, success, failed };
  }

  /**
   * Generate structured embeddings for JobExtraction records without them
   */
  async generateMissingStructuredEmbeddings(options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ processed: number; success: number; failed: number }> {
    const { limit = 100, offset = 0 } = options || {};

    let processed = 0;
    let success = 0;
    let failed = 0;

    try {
      // Find extractions without structured embeddings
      const extractionsWithoutEmbeddings = await prisma.$queryRaw<
        Array<{
          id: string;
          jobId: string;
          skills: unknown;
          requirements: unknown;
          qualifications: unknown;
          experienceLevel: string | null;
          educationLevel: string | null;
          workType: string | null;
          workSchedule: string | null;
        }>
      >`
        SELECT 
          id, 
          "jobId",
          skills,
          requirements,
          qualifications,
          "experienceLevel",
          "educationLevel",
          "workType",
          "workSchedule"
        FROM scam_detector_job_extraction
        WHERE structured_embedding IS NULL
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      console.log(
        `[BatchEmbeddingService] Found ${extractionsWithoutEmbeddings.length} extractions without structured embeddings`
      );

      // Process in batches
      for (
        let i = 0;
        i < extractionsWithoutEmbeddings.length;
        i += this.batchSize
      ) {
        const batch = extractionsWithoutEmbeddings.slice(i, i + this.batchSize);

        // Process batch in parallel
        await Promise.all(
          batch.map(async (extraction) => {
            try {
              // Generate structured embedding
              const result = await embeddingService.embedStructuredData({
                skills: extraction.skills as
                  | Array<{
                      name: string;
                      category?: string;
                    }>
                  | undefined,
                requirements: extraction.requirements as
                  | Array<{
                      type: string;
                      name: string;
                    }>
                  | undefined,
                qualifications: extraction.qualifications as
                  | Array<{
                      type: string;
                      value: string;
                    }>
                  | undefined,
                experienceLevel: extraction.experienceLevel || undefined,
                educationLevel: extraction.educationLevel || undefined,
                workType: extraction.workType || undefined,
                workSchedule: extraction.workSchedule || undefined,
              });

              // Update extraction with embedding using service
              await JobExtractionService.updateStructuredEmbedding(
                extraction.id,
                result.embedding
              );

              // Store cost metadata if available
              if (result.costMetadata) {
                // Get current extraction to merge metadata
                const currentExtraction = await prisma.jobExtraction.findUnique(
                  {
                    where: { id: extraction.id },
                    select: { metadata: true },
                  }
                );

                const combinedMetadata = {
                  ...((currentExtraction?.metadata as Record<
                    string,
                    unknown
                  >) || {}),
                  embedding: result.costMetadata,
                };

                await prisma.jobExtraction.update({
                  where: { id: extraction.id },
                  data: {
                    metadata: combinedMetadata as unknown as InputJsonValue,
                  },
                });
              }

              success++;
              processed++;
            } catch (error) {
              failed++;
              processed++;
              console.error(
                `[BatchEmbeddingService] Failed to generate structured embedding for extraction ${extraction.id}:`,
                error
              );
            }
          })
        );

        // Delay between batches
        if (i + this.batchSize < extractionsWithoutEmbeddings.length) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.delayBetweenBatches)
          );
        }
      }
    } catch (error) {
      console.error(
        "[BatchEmbeddingService] Batch structured embedding error:",
        error
      );
      throw error;
    }

    return { processed, success, failed };
  }
}

// Export singleton instance
export const batchEmbeddingService = new BatchEmbeddingService();
