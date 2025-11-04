# Futuromy Mobile Template - Validators Package

This is the validators package for the Futuromy Mobile Template. It provides shared validation schemas and utilities using Zod for runtime type validation across the web, mobile, and backend applications.

## Tech Stack

- **Zod**: TypeScript-first schema validation with static type inference
- **TypeScript**: Static type checking for JavaScript
- **Logger**: Custom logging utility

## Package Structure

```
packages/shared/
├── src/
│   ├── index.ts            # Package entry point
│   ├── constants.ts        # Shared constants
│   ├── Logger.ts           # Logging utility
│   └── notification-types.ts # Notification type definitions
└── package.json            # Package configuration
```

## Usage

### Basic Validation Schemas

The Validators package provides reusable validation schemas:

```typescript
import { z } from "zod";

import { emailSchema, passwordSchema } from "@acme/shared";

// Use predefined schemas
const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

// Type inference
type LoginInput = z.infer<typeof loginSchema>;

// Validate data
function validateLogin(data: unknown): LoginInput {
  return loginSchema.parse(data);
}

try {
  const validatedData = validateLogin({
    email: "user@example.com",
    password: "Password123!",
  });
  // Use validated data
} catch (error) {
  if (error instanceof z.ZodError) {
    // Handle validation errors
    console.error(error.errors);
  }
}
```

### Form Validation

The Validators package can be used with form libraries like react-hook-form:

```typescript
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { userSchema, type UserSchema } from "@acme/shared";

export function UserForm() {
  const form = useForm<UserSchema>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "USER",
    },
  });

  const onSubmit = (data: UserSchema) => {
    // Submit validated data
    console.log(data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Form fields */}
    </form>
  );
}
```

### API Input Validation

The Validators package is used for validating API inputs in tRPC procedures:

```typescript
import { z } from "zod";

import { userSchema } from "@acme/shared";

import { createTRPCRouter, publicProcedure } from "../trpc";

export const userRouter = createTRPCRouter({
  create: publicProcedure.input(userSchema).mutation(async ({ ctx, input }) => {
    // Input is validated and typed
    return ctx.db.user.create({
      data: input,
    });
  }),
});
```

### Custom Validation Rules

The Validators package allows for creating custom validation rules:

```typescript
import { z } from "zod";

// Custom validation for username
export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be at most 20 characters")
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Username can only contain letters, numbers, and underscores"
  );

// Custom validation for age with minimum age requirement
export const ageSchema = z
  .number()
  .int("Age must be a whole number")
  .min(18, "You must be at least 18 years old")
  .max(120, "Age must be at most 120");

// Custom validation for phone number
export const phoneSchema = z
  .string()
  .regex(/^\+?[0-9]{10,15}$/, "Invalid phone number format");
```

### Notification Types

The Validators package includes type definitions for notifications:

```typescript
// src/notification-types.ts
import { z } from "zod";

export const notificationTypeSchema = z.enum([
  "NEW_MESSAGE",
  "FRIEND_REQUEST",
  "SUBSCRIPTION_EXPIRING",
  "PAYMENT_FAILED",
  "SYSTEM_ANNOUNCEMENT",
]);

export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationSchema = z.object({
  id: z.string(),
  type: notificationTypeSchema,
  title: z.string(),
  body: z.string(),
  data: z.record(z.string(), z.any()).optional(),
  createdAt: z.date(),
  read: z.boolean().default(false),
  userId: z.string(),
});

export type Notification = z.infer<typeof notificationSchema>;
```

### Logger Utility

The Validators package includes a Logger utility for consistent logging:

```typescript
import { Logger } from "@acme/shared/Logger";

// Create a logger instance
const logger = new Logger("UserService");

// Log messages with different levels
logger.info("User logged in", { userId: "123" });
logger.warn("Failed login attempt", { email: "user@example.com" });
logger.error("Database connection failed", { error: "Connection refused" });
logger.debug("Processing request", { requestId: "abc123" });

// Log with custom metadata
logger.log({
  level: "info",
  message: "Custom log message",
  metadata: {
    userId: "123",
    action: "login",
    timestamp: new Date(),
  },
});
```

### Constants

The Validators package includes shared constants:

```typescript
// src/constants.ts
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
];
export const MAX_USERNAME_LENGTH = 20;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_DESCRIPTION_LENGTH = 500;
```

## Creating New Validators

To add a new validator to the package:

1. Create a new schema in the appropriate file
2. Export the schema and its inferred type
3. Use the schema in your application

```typescript
// Example of adding a new validator
import { z } from "zod";

// Define the schema
export const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  price: z.number().positive("Price must be positive"),
  category: z.enum(["electronics", "clothing", "food", "other"]),
  inStock: z.boolean().default(true),
});

// Export the inferred type
export type ProductSchema = z.infer<typeof productSchema>;
```
