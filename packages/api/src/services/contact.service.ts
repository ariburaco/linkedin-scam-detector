/**
 * Contact Service
 * Handles all database operations for Contact model
 */

import prisma, {
  type InputJsonValue,
  type Contact,
} from "@acme/db";
import { Logger } from "@acme/shared/Logger";

const logger = new Logger("ContactService");

export interface CreateContactInput {
  linkedinProfileId: string;
  name: string;
  profileUrl: string;
  profileImageUrl?: string | null;
  isVerified?: boolean;
  rawData?: Record<string, unknown> | null;
}

export interface LinkContactToCompanyInput {
  contactId: string;
  companyId: string;
  role?: string | null;
  title?: string | null;
  isCurrent?: boolean;
}

export interface LinkContactToJobInput {
  contactId: string;
  jobId: string;
  relationshipType: string; // e.g., "job_poster", "hiring_manager", "recruiter", "hiring_team_member"
  connectionDegree?: string | null; // e.g., "2nd", "3rd"
  isJobPoster?: boolean;
}

export class ContactService {
  /**
   * Find contact by LinkedIn profile ID
   */
  static async findByLinkedInProfileId(
    linkedinProfileId: string
  ): Promise<Contact | null> {
    try {
      return await prisma.contact.findUnique({
        where: { linkedinProfileId },
      });
    } catch (error) {
      logger.error("Failed to find contact by LinkedIn profile ID", {
        linkedinProfileId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Find contact by ID
   */
  static async findById(id: string): Promise<Contact | null> {
    try {
      return await prisma.contact.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error("Failed to find contact by ID", {
        id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Create or update contact (upsert)
   */
  static async createOrUpdate(
    input: CreateContactInput
  ): Promise<Contact> {
    try {
      const existing = await this.findByLinkedInProfileId(
        input.linkedinProfileId
      );

      if (existing) {
        // Update existing contact
        return await prisma.contact.update({
          where: { id: existing.id },
          data: {
            name: input.name,
            profileUrl: input.profileUrl,
            profileImageUrl: input.profileImageUrl ?? existing.profileImageUrl ?? null,
            isVerified: input.isVerified ?? existing.isVerified,
            rawData: input.rawData
              ? (input.rawData as InputJsonValue)
              : (existing.rawData as InputJsonValue | null),
          } as any,
        });
      } else {
        // Create new contact
        return await prisma.contact.create({
          data: {
            linkedinProfileId: input.linkedinProfileId,
            name: input.name,
            profileUrl: input.profileUrl,
            profileImageUrl: input.profileImageUrl ?? null,
            isVerified: input.isVerified ?? false,
            rawData: input.rawData
              ? (input.rawData as InputJsonValue)
              : undefined,
          } as any,
        });
      }
    } catch (error) {
      logger.error("Failed to create or update contact", {
        linkedinProfileId: input.linkedinProfileId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Link contact to company (create/update CompanyContact relationship)
   */
  static async linkToCompany(
    input: LinkContactToCompanyInput
  ): Promise<void> {
    try {
      await prisma.companyContact.upsert({
        where: {
          companyId_contactId: {
            companyId: input.companyId,
            contactId: input.contactId,
          },
        },
        create: {
          companyId: input.companyId,
          contactId: input.contactId,
          role: input.role ?? null,
          title: input.title ?? null,
          isCurrent: input.isCurrent ?? true,
        },
        update: {
          role: input.role ?? undefined,
          title: input.title ?? undefined,
          isCurrent: input.isCurrent ?? undefined,
        },
      });
    } catch (error) {
      logger.error("Failed to link contact to company", {
        contactId: input.contactId,
        companyId: input.companyId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Link contact to job (create/update JobContact relationship)
   */
  static async linkToJob(input: LinkContactToJobInput): Promise<void> {
    try {
      await prisma.jobContact.upsert({
        where: {
          jobId_contactId: {
            jobId: input.jobId,
            contactId: input.contactId,
          },
        },
        create: {
          jobId: input.jobId,
          contactId: input.contactId,
          relationshipType: input.relationshipType,
          connectionDegree: input.connectionDegree ?? null,
          isJobPoster: input.isJobPoster ?? false,
        },
        update: {
          relationshipType: input.relationshipType,
          connectionDegree: input.connectionDegree ?? undefined,
          isJobPoster: input.isJobPoster ?? undefined,
        },
      });
    } catch (error) {
      logger.error("Failed to link contact to job", {
        contactId: input.contactId,
        jobId: input.jobId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}

