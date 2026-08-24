# BurdenOff

A support-ticket service built with Bun, TypeScript, GraphQL Yoga, Prisma/PostgreSQL, and a React/Vite frontend styled with Tailwind CSS.

## Run locally

1. Copy `.env.example` to `.env` and set `JWT_SECRET`.
2. Start PostgreSQL with `docker compose up -d`.
3. Run `bun install`, `bunx prisma migrate dev --name init`, and `bun run db:seed`.
4. Start the API with `bun run dev`; GraphQL is at `http://localhost:4000/graphql`.
5. In a second terminal, run `bun run dev:client`; open `http://localhost:5173`.
6. Build the browser client with `bun run build`.

Demo accounts are `reporter@example.com` and `agent@example.com`, both using `password`.

## Architecture

The backend is layered so that GraphQL code contains no business logic and no Prisma access:

```
src/
  server.ts                 HTTP/Yoga bootstrap only
  schema.graphql            schema-first SDL
  config.ts                 environment access (BUSINESS_TIMEZONE, JWT_SECRET)
  errors.ts                 coded GraphQLError helper
  graphql/
    schema.ts               executable schema factory (injects db + clock)
    resolvers.ts            thin argument/context plumbing into services
    scalars.ts, context.ts  DateTime scalar and request context type
  services/
    sla/engine.ts           pure business-hours math: policies, deadlines, states
    sla/presenter.ts        SLA info / resolution-attempt projection for the API
    ticket/ticket.service.ts     create/assign/transition/reopen/comment rules
    ticket/ticket.query.service.ts list+SLA filtering+pagination, detail, dashboard
    ticket/transitions.ts   status transition table
    auth/                   register/login service, JWT sign/verify, guards
    holiday/                holiday set for SLA math, holiday listing
  repositories/             all Prisma queries (user, ticket, comment, event, attempt)
  validation/               text/email/password validation with coded errors
prisma/                     schema, migrations, seed
tests/
  unit/                     SLA engine + transition rules (pure)
  integration/              real PostgreSQL via Docker (db reset, GraphQL flow)
```

Resolvers only authenticate, shape arguments, and delegate; authorization guards live in `services/auth/guards.ts`, transactional rules in `services/ticket`, and every date calculation in `services/sla`. A fake clock is injected so tests are deterministic.

## Rules

Registration always creates a reporter. Agents are provisioned administratively/through the seed. Reporters see their own tickets; agents see all tickets and active users. The legal transitions are `OPEN -> IN_PROGRESS/WAITING_ON_CUSTOMER`, `IN_PROGRESS -> OPEN/RESOLVED/WAITING_ON_CUSTOMER`, `WAITING_ON_CUSTOMER -> OPEN/IN_PROGRESS`, `RESOLVED -> CLOSED`; closed tickets are terminal and only resolved tickets can be reopened. Reopening starts a new resolution attempt without changing original SLA deadlines.

While a ticket is `WAITING_ON_CUSTOMER` both SLA clocks are frozen: on resume, each still-active clock is restarted from the resume instant with exactly the business time it had left when paused (weekends/holidays inside the pause never count).

Business hours are 09:00-18:00 on weekdays in `Asia/Kolkata` by default. Holidays are date-only records. SLA state is calculated at read time; completed work uses event timestamps while the enum remains `ON_TRACK`, `AT_RISK`, or `BREACHED`.

## Tests

`bun test` runs unit and integration tests. The integration tests need `TEST_DATABASE_URL`; apply migrations to that database first, for example with `DATABASE_URL=$TEST_DATABASE_URL bunx prisma migrate deploy`. `bun run typecheck`, `bun run lint`, and `bun run format:check` are also available.

## API notes

All operations except `register` and `login` require `Authorization: Bearer <jwt>`. The schema exposes ticket list/detail, dashboard, users, holidays, comments, assignment, status changes, resolution, reopening, and authentication. Ticket connections use newest-first cursor pagination and calculate SLA filters before pagination. Domain/auth failures expose `extensions.code`.
