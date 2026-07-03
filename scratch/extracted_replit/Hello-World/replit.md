# Libyan Learn Hub (EduLibya)

## Overview

A full-stack Learning Management System for Libya — "EduLibya" — supporting Arabic and English. Includes a web app, mobile app (Expo), and a shared Express API server.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 (with JWT auth, bcryptjs)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle for API server)

## Structure

```text
workspace/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server (JWT auth, all routes)
│   ├── lms-web/            # React + Vite web app (Arabic/English LMS)
│   └── lms-mobile/         # Expo React Native mobile app
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml     # pnpm workspace (packages + catalog)
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package
```

## Features

### Web App (lms-web) — served at `/`
- Arabic/English bilingual UI (RTL support with Tajawal font)
- Pages: Home, Courses, CourseDetail, Learn, Auth (login/register), Dashboard, TeacherDashboard, AdminDashboard, LiveSessions
- Wouter routing, React Query, Shadcn/ui components
- JWT token stored in localStorage, injected into all API calls via fetch monkey-patch

### Mobile App (lms-mobile) — served at `/lms-mobile/`
- Expo Router file-based routing
- Tabs layout with liquid glass support on iOS 26+
- Inter font, safe area handling, React Query

### API Server (api-server) — served at `/api`
- Routes: auth, users, courses, categories, enrollments, lessons, live-sessions, payments, progress, teacher, admin, video
- JWT authentication with bcryptjs password hashing
- Full Drizzle ORM integration with PostgreSQL

## Database Schema

Tables: users, categories, courses, lessons, enrollments, progress, reviews, live_sessions, payments, teacher_earnings, withdrawal_requests

## TypeScript & Composite Projects

- `lib/*` packages are composite and emit declarations via `tsc --build`
- `artifacts/*` are leaf packages, typechecked with `tsc --noEmit`
- Run `pnpm run typecheck` from root for full check

## Root Scripts

- `pnpm run build` — runs typecheck then builds all packages
- `pnpm run typecheck` — full typecheck via project references
- `pnpm --filter @workspace/db run push` — push DB schema changes
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client

## Service Ports

- API Server: 8080 → `/api`
- Web App: 21957 → `/`
- Mobile App: 21752 → `/lms-mobile/`
