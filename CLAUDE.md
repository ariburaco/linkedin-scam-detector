# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Turborepo monorepo containing a Chrome extension (StreamSense) and a Next.js web application with a shared API layer. The project uses TypeScript, tRPC for type-safe APIs, Prisma with PostgreSQL for database operations, and Better-Auth for authentication with Polar integration for payments.

## Development Commands

### Setup
```bash
bun install                           # Install dependencies
bun db:push                          # Push Prisma schema to database
```

### Development
```bash
bun dev                              # Start all apps in development mode
bun dev:web                          # Start only the Next.js web app (port 3000)
bun dev:chrome-extension             # Start only the Chrome extension
```

### Building
```bash
bun build                            # Build all applications
bun typecheck                        # Type-check all applications
```

### Linting & Formatting
```bash
bun lint                             # Lint all applications
bun lint:fix                         # Lint and auto-fix all applications
bun format:check                     # Check formatting
bun format:write                     # Format all files
```

### Database Commands
```bash
bun db:push                          # Push schema changes without migration
bun db:migrate                       # Create and apply migrations
bun db:generate                      # Generate Prisma client
bun db:studio                        # Open Prisma Studio UI
bun db:start                         # Start PostgreSQL in Docker (detached)
bun db:watch                         # Start PostgreSQL in Docker (interactive)
bun db:stop                          # Stop PostgreSQL container
bun db:down                          # Stop and remove PostgreSQL container
```

### Chrome Extension Development
```bash
cd apps/chrome-extension
bun dev                              # Start Plasmo dev server with HMR
bun build                            # Build production extension
bun package                          # Package extension for distribution
```

## Architecture

### Monorepo Structure

The project uses Turborepo with two main applications and several shared packages:

```
apps/
  chrome-extension/          # Plasmo-based Chrome extension (StreamSense)
  web/                       # Next.js 16 web application (port 3000)

packages/
  api/                       # tRPC API layer with routers
  auth/                      # Better-Auth configuration with Polar
  db/                        # Prisma schema and client
  shared/                    # Shared utilities, types, and Logger
  config-eslint-prettier/    # Shared ESLint/Prettier configs
```

### Chrome Extension Architecture

The Chrome extension (StreamSense) is built with Plasmo and targets streaming platforms (Netflix, Prime Video, Disney+, Max).

**Key Components:**
- `src/contents/` - Content scripts injected into streaming platform pages
  - `smart-skip.tsx` - Main content script with debug panel and smart skip logic
  - Content scripts run at `document_end` in the `MAIN` world
- `src/features/streaming/` - Streaming platform feature implementations
  - `smart-skip.ts` - Platform-agnostic smart skip implementation with `VIDE_PLATFORMS` config
  - `netflix-skip.ts` - Netflix-specific skip functionality
  - `skip-factory.ts` - Factory pattern for creating platform-specific skip handlers
- `src/background/` - Background service worker
  - `messages/` - Message handlers for extension-to-background communication
- `src/trpc/` - tRPC client setup for communicating with the web API
  - `caller.ts` - tRPC client caller
  - `react.tsx` - React Query integration
  - `withTrpcProvider.tsx` - Provider wrapper
- `src/auth/` - Authentication client for Chrome extension
- `src/popup.tsx` - Extension popup UI
- `src/options/` - Extension options page

**Streaming Platform Support:**
The `VIDE_PLATFORMS` array in `src/features/streaming/smart-skip.ts` defines platform configurations with selectors for skip buttons and navigation controls. Each platform config includes:
- `platform` - Domain matcher
- `selectors` - Array of button selectors (aria-label, class, id, data-testid, shadow-dom)
- `videoSelector` - CSS selector for video element
- `features` - Feature flags (skipIntro, skipRecap, nextEpisode, seek controls)

### Web Application Architecture

Next.js 16 application with App Router, running on port 3000.

**Key Features:**
- Authentication pages (`/login`, `/dashboard`, `/success`)
- tRPC API routes under `/api/trpc`
- Better-Auth with Polar payment integration
- React Query for data fetching

### API Layer (`packages/api`)

tRPC-based API with type-safe procedures:
- `publicProcedure` - Unauthenticated endpoints
- `protectedProcedure` - Requires valid session (throws `UNAUTHORIZED` if no session)
- Uses SuperJSON for serialization
- Routers defined in `src/routers/`

### Authentication (`packages/auth`)

Better-Auth configuration with:
- Email/password authentication enabled
- Polar plugin for payments and customer management
- Checkout and portal functionality
- PostgreSQL adapter via Prisma
- `trustedOrigins` configured via `CORS_ORIGIN` env var

### Database (`packages/db`)

Prisma setup with:
- PostgreSQL database
- Schema files in `prisma/schema/` (split schema: `schema.prisma` + `auth.prisma`)
- Generated client output to `generated/` directory
- ESM module format

### Shared Package (`packages/shared`)

Common utilities and types:
- `Logger.ts` - Shared logging utility
- `constants.ts` - Application constants
- `utils/` - Shared utility functions
- `types/` - Shared TypeScript types

## Environment Variables

Required environment variables (see `apps/web/.env.example`):
- `DATABASE_URL` - PostgreSQL connection string
- `BETTER_AUTH_SECRET` - Secret for auth token signing
- `BETTER_AUTH_URL` - Base URL for auth callbacks
- `POLAR_ACCESS_TOKEN` - Polar API access token
- `POLAR_SUCCESS_URL` - Redirect URL after successful payment
- `CORS_ORIGIN` - Allowed CORS origin for Chrome extension

## Package Manager

This project uses **Bun** (`bun@1.2.23`) exclusively. Do not use npm, pnpm, or yarn.

## Important Notes

- The project has patched dependencies (`jiti@2.6.1` and `@tailwindcss/oxide@4.1.16`) - use `bun patch` to modify
- The Chrome extension uses Plasmo's messaging system (`@plasmohq/messaging`) for background communication
- Content scripts inject into streaming platforms with specific host permissions
- The web app uses React 19 with babel-plugin-react-compiler enabled
- Prisma client is generated to `packages/db/prisma/generated/` with ESM format
- tRPC context includes session information - check `packages/api/src/context.ts` for available context
- Chrome extension runs content scripts in the MAIN world to access page JavaScript context

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md
