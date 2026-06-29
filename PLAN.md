# Golf Competition & Leaderboard Web App

This application will allow you to host diverse golf competitions, manage players, enter scores on the course, and view live leaderboards. It will be built using modern web technologies (Next.js, React, TypeScript) and hosted on Vercel with Vercel Postgres as the database.

## Design Decisions Based on Feedback

1. **Styling Framework:** We will use **Tailwind CSS**. It is natively supported by Next.js and provides the robust, standard foundation needed for complex dynamic UIs.
2. **Authentication:** We will use **NextAuth (Auth.js)** for simple, robust session management.
3. **Offline capability / PWA:** We will set this up as a Progressive Web App (PWA) with a Service Worker to cache score inputs locally if the network drops on the course.
4. **Image Uploads:** Vercel Postgres is for relational data, not files. We will use **Vercel Blob** storage for player pictures and scorecard media. It is Vercel's native robust solution for file uploads.
5. **Database Connection:** We will use the provided Vercel Postgres credentials for both local development and production.

## Proposed Changes

We will execute the project in phases.

### 1. Project Initialization & Architecture

- Initialize a Next.js (App Router) project with TypeScript and Tailwind CSS.
- Set up Vercel deployment configuration.
- Integrate Prisma ORM for database management and connect to the provided Neon DB.

### 2. Database Schema (Prisma)

The core entities in the database:

- **User**: Stores Player, Admin, and Super-Admin accounts. (Name, Email, Password, Handicap, Home Course, Phone, Picture, Role).
- **Course**: Stores golf course details. (Name, GPS, Picture).
- **Hole**: Belongs directly to a Course. (HoleNumber, Par, StrokeIndex).
- **Tee**: Belongs to a Course. (Name/Color, CourseRating, Slope).
- **Competition**: (Name, Type, StartDate, EndDate, CustomCSS, BackgroundImage, SettingsJSON).
- **Team**: For team competitions.
- **Participant**: Links a User to a Competition, locking in their Competition Handicap and optionally assigning them to a Team.
- **Round**: A specific round of play within a Competition. Specifies the Course and Tees used.
- **Match / Group**: Used for Matchplay pairings or group stage groupings.
- **Score**: Stores individual hole scores. (ParticipantId, RoundId, HoleId, GrossStrokes, Status).
- **AuditLog**: Tracks who changed scores and when.

### 3. Core Engine (Competition Formats)

We will build a "Scoring Engine" utility class/module that handles the specific rules of golf calculations:
- Playing Handicap Calculation (Course Rating, Slope, 85% allowance for 4Ball, 60/40 allowance for Chapman).
- Stableford Points Calculation (Gross and Netto).
- Matchplay Status (All Square, +X, -X) and point distribution (Win = 1, Tie = 0.5, etc.).
- Tie-breakers and split positions (T1).

### 4. User Interfaces

- **Admin Dashboard**: Create comps, manage players, set courses, enter pairings, edit scores, regenerate course info.
- **Leaderboards**: Tabbed view, dynamic styling per competition, split positions (T1), playoff trees (Turnierbaum), matchplay Ryder-Cup style grids.
- **Live Scoring**: 
  - Mobile-first interface for `+` and `-` hole-by-hole score entry.
  - Alternative bulk-entry interface to input an entire scorecard at once.

### 5. Step-by-Step Execution Plan

1. Setup Next.js, Prisma, and the Postgres Database schema. (DONE)
2. Implement Authentication (NextAuth). (DONE)
3. Seed the initial courses (Gut Altentann, Zillertal-Uderns, etc.). (DONE)
4. Build the Competition and Course Admin Interfaces.
   - Guard `/admin` routes using NextAuth session roles.
   - Create Admin Sidebar Navigation layout.
   - **Courses Admin**: View and edit seeded courses, tees, and holes.
   - **Users Admin**: Create dummy players or invite real users.
   - **Competitions Admin**: Create competitions, assign courses, create teams, and add participants.
5. Implement the Scoring Engine (handicap & points logic).
6. Build the Score Entry mobile interface and bulk entry interface.
7. Build the dynamic Leaderboards.

## Phase 4: Admin Interface Architecture

### User Review Required
> [!IMPORTANT]
> The admin interface will feature a dark-mode sidebar layout. 
> For data tables, we will use simple responsive HTML tables. For forms, we will use React Server Actions with standard HTML forms styled by Tailwind.
> 
> **Are you okay with this routing structure for the Admin panel?**
> - `/admin` (Dashboard Overview)
> - `/admin/competitions` (Manage tournaments)
> - `/admin/courses` (Manage courses and tees)
> - `/admin/users` (Manage player accounts and handicaps)

### Proposed Changes

#### [NEW] `src/app/admin/layout.tsx`
Server component that checks `session.user.role === 'ADMIN' || 'SUPER_ADMIN'` and provides the sidebar navigation shell.

#### [NEW] `src/app/admin/page.tsx`
Admin dashboard home showing quick stats (Total Competitions, Total Users).

#### [NEW] `src/app/admin/competitions/page.tsx` and `/new/page.tsx`
UI to list existing competitions and a form to create a new one. The creation form will ask for:
- Competition Name and URL Slug
- Format Type (Strokeplay Gross, Netto Stableford, Matchplay, etc.)
- Is it a Team Competition?

#### [NEW] `src/app/admin/courses/page.tsx`
UI to list the courses we seeded (e.g. GC Gut Altentann) and view their hole pars and stroke indexes.

## Verification Plan

### Automated Tests
- We will write unit tests (using Jest or Vitest) for the **Scoring Engine**.

### Manual Verification
- We will manually test the score entry flow on a mobile viewport, simulating offline drops.
- You will be able to test the application locally using your actual Vercel Postgres instance.
