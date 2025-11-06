/**
 * Job Search Service
 * Handles semantic search operations for jobs
 */

import prisma from "@acme/db";
import { Logger } from "@acme/shared/Logger";
import { embeddingService } from "./embedding.service";

const logger = new Logger("JobSearchService");

export interface SearchJobsResult {
  id: string;
  title: string;
  company: string;
  description: string;
  url: string;
  location: string | null;
  salary: string | null;
  similarity: number;
}

export interface SearchJobsOptions {
  query: string;
  limit?: number;
}

export class JobSearchService {
  /**
   * Search jobs using semantic similarity
   */
  static async searchJobs(
    options: SearchJobsOptions
  ): Promise<{ results: SearchJobsResult[]; count: number }> {
    const { query, limit = 10 } = options;

    try {
      // Generate embedding for the search query
      const queryResult = await embeddingService.embedText({ text: query });
      const queryEmbedding = queryResult.embedding;

      // Format embedding as PostgreSQL vector
      const vectorString = `[${queryEmbedding.join(",")}]`;

      // Perform cosine similarity search using raw SQL
      // Cosine distance (<->) returns smaller values for more similar vectors
      const results = await prisma.$queryRaw<
        Array<{
          id: string;
          title: string;
          company: string;
          description: string;
          url: string;
          location: string | null;
          salary: string | null;
          similarity: number;
        }>
      >`
        SELECT 
          id,
          title,
          company,
          description,
          url,
          location,
          salary,
          1 - (embedding <-> ${vectorString}::vector) AS similarity
        FROM scam_detector_job
        WHERE embedding IS NOT NULL
        ORDER BY embedding <-> ${vectorString}::vector
        LIMIT ${limit}
      `;

      return {
        results: results.map((r) => ({
          id: r.id,
          title: r.title,
          company: r.company,
          description: r.description,
          url: r.url,
          location: r.location,
          salary: r.salary,
          similarity: Number(r.similarity), // Convert to number (0-1, higher = more similar)
        })),
        count: results.length,
      };
    } catch (error) {
      logger.error("Failed to search jobs", {
        query,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}
