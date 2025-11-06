/**
 * Company Service
 * Handles all database operations for Company model
 */

import prisma, {
  type InputJsonValue,
  type Company,
} from "@acme/db";
import { Logger } from "@acme/shared/Logger";

const logger = new Logger("CompanyService");

export interface CreateCompanyInput {
  linkedinCompanyId: string;
  name: string;
  url: string;
  logoUrl?: string | null;
  description?: string | null;
  industry?: string | null;
  employeeCount?: string | null;
  linkedinEmployeeCount?: string | null;
  followerCount?: string | null;
  rawData?: Record<string, unknown> | null;
}

export class CompanyService {
  /**
   * Find company by LinkedIn ID
   */
  static async findByLinkedInId(
    linkedinCompanyId: string
  ): Promise<Company | null> {
    try {
      return await prisma.company.findUnique({
        where: { linkedinCompanyId },
      });
    } catch (error) {
      logger.error("Failed to find company by LinkedIn ID", {
        linkedinCompanyId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Find company by ID
   */
  static async findById(id: string): Promise<Company | null> {
    try {
      return await prisma.company.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error("Failed to find company by ID", {
        id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Check if field value has changed
   */
  private static hasFieldChanged<T>(
    existing: T | null | undefined,
    newValue: T | null | undefined
  ): boolean {
    // Both null/undefined = no change
    if (!existing && !newValue) return false;
    // One is null/undefined, other has value = change
    if (!existing || !newValue) return true;
    // Both have values, compare
    return existing !== newValue;
  }

  /**
   * Update company only if fields have changed
   */
  static async updateIfChanged(
    companyId: string,
    newData: Partial<CreateCompanyInput>
  ): Promise<Company | null> {
    try {
      const existing = await this.findById(companyId);
      if (!existing) {
        logger.warn("Company not found for update", { companyId });
        return null;
      }

      // Check which fields have changed
      const changes: Partial<CreateCompanyInput> = {};
      let hasChanges = false;

      if (
        newData.name !== undefined &&
        this.hasFieldChanged(existing.name, newData.name)
      ) {
        changes.name = newData.name;
        hasChanges = true;
      }

      if (
        newData.url !== undefined &&
        this.hasFieldChanged(existing.url, newData.url)
      ) {
        changes.url = newData.url;
        hasChanges = true;
      }

      if (
        newData.logoUrl !== undefined &&
        this.hasFieldChanged(existing.logoUrl, newData.logoUrl)
      ) {
        changes.logoUrl = newData.logoUrl ?? null;
        hasChanges = true;
      }

      if (
        newData.description !== undefined &&
        this.hasFieldChanged(existing.description, newData.description)
      ) {
        changes.description = newData.description ?? null;
        hasChanges = true;
      }

      if (
        newData.industry !== undefined &&
        this.hasFieldChanged(existing.industry, newData.industry)
      ) {
        changes.industry = newData.industry ?? null;
        hasChanges = true;
      }

      if (
        newData.employeeCount !== undefined &&
        this.hasFieldChanged(existing.employeeCount, newData.employeeCount)
      ) {
        changes.employeeCount = newData.employeeCount ?? null;
        hasChanges = true;
      }

      if (
        newData.linkedinEmployeeCount !== undefined &&
        this.hasFieldChanged(
          existing.linkedinEmployeeCount,
          newData.linkedinEmployeeCount
        )
      ) {
        changes.linkedinEmployeeCount = newData.linkedinEmployeeCount ?? null;
        hasChanges = true;
      }

      if (
        newData.followerCount !== undefined &&
        this.hasFieldChanged(existing.followerCount, newData.followerCount)
      ) {
        changes.followerCount = newData.followerCount ?? null;
        hasChanges = true;
      }

      if (
        newData.rawData !== undefined &&
        JSON.stringify(existing.rawData) !== JSON.stringify(newData.rawData)
      ) {
        changes.rawData = newData.rawData;
        hasChanges = true;
      }

      // Only update if there are actual changes
      if (!hasChanges) {
        logger.debug("No changes detected for company", {
          companyId,
          linkedinCompanyId: existing.linkedinCompanyId,
        });
        return existing;
      }

      // Update with changed fields only
      return await prisma.company.update({
        where: { id: companyId },
        data: {
          ...changes,
          rawData: changes.rawData
            ? (changes.rawData as InputJsonValue)
            : undefined,
        } as any,
      });
    } catch (error) {
      logger.error("Failed to update company if changed", {
        companyId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Create or update company with smart update logic
   * Only updates fields if they've changed
   * Preserves existing data if new data is missing/null
   */
  static async createOrUpdate(
    input: CreateCompanyInput
  ): Promise<Company> {
    try {
      const existing = await this.findByLinkedInId(input.linkedinCompanyId);

      if (existing) {
        // Update only if fields have changed
        // Preserve existing values if new values are null/undefined
        const updateData: Partial<CreateCompanyInput> = {
          name: input.name,
          url: input.url,
          logoUrl: input.logoUrl ?? existing.logoUrl ?? null,
          description: input.description ?? existing.description ?? null,
          industry: input.industry ?? existing.industry ?? null,
          employeeCount: input.employeeCount ?? existing.employeeCount ?? null,
          linkedinEmployeeCount:
            input.linkedinEmployeeCount ??
            existing.linkedinEmployeeCount ??
            null,
          followerCount: input.followerCount ?? existing.followerCount ?? null,
          rawData: input.rawData ?? (existing.rawData as Record<string, unknown> | null) ?? null,
        };

        // Use updateIfChanged to only update when necessary
        const updated = await this.updateIfChanged(existing.id, updateData);
        return updated || existing;
      } else {
        // Create new company
        return await prisma.company.create({
          data: {
            linkedinCompanyId: input.linkedinCompanyId,
            name: input.name,
            url: input.url,
            logoUrl: input.logoUrl ?? null,
            description: input.description ?? null,
            industry: input.industry ?? null,
            employeeCount: input.employeeCount ?? null,
            linkedinEmployeeCount: input.linkedinEmployeeCount ?? null,
            followerCount: input.followerCount ?? null,
            rawData: input.rawData
              ? (input.rawData as InputJsonValue)
              : undefined,
          } as any,
        });
      }
    } catch (error) {
      logger.error("Failed to create or update company", {
        linkedinCompanyId: input.linkedinCompanyId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}

