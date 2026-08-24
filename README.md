# BurdenOff

A minimal support-ticket service built with Bun, TypeScript, GraphQL Yoga, Prisma/PostgreSQL, and React/Vite.

## Run locally

1. Copy `.env.example` to `.env` and set `JWT_SECRET`.
2. Start PostgreSQL with `docker compose up -d`.
3. Run `bun install`, `bunx prisma migrate dev --name init`, and `bun run db:seed`.
4. Start the API with `bun run dev`; GraphQL is at `http://localhost:4000/graphql`.
5. Build the browser client with `bun run build`.

Demo accounts are `reporter@example.com` and `agent@example.com`, both using `password`.

## Rules

Registration always creates a reporter. Agents are provisioned administratively/through the seed. Reporters see their own tickets; agents see all tickets and active users. The legal transitions are `OPEN -> IN_PROGRESS`, `IN_PROGRESS -> OPEN/RESOLVED`, `RESOLVED -> CLOSED`; closed tickets are terminal and only resolved tickets can be reopened. Reopening starts a new resolution attempt without changing original SLA deadlines.

Business hours are 09:00-17:00 on weekdays in `Asia/Kolkata` by default. Holidays are date-only records. SLA state is calculated at read time; completed work uses event timestamps while the enum remains `ON_TRACK`, `AT_RISK`, or `BREACHED`.

## Tests

`bun test` runs domain tests. Set `TEST_DATABASE_URL` to run the PostgreSQL integration test with `bun run test:integration`; apply the same migration to that database first, for example with `DATABASE_URL=$TEST_DATABASE_URL bunx prisma migrate deploy`. `bun run typecheck` and `bun run lint` are also available.

## API notes

All operations except `register` and `login` require `Authorization: Bearer <jwt>`. The schema exposes ticket list/detail, dashboard, users, holidays, comments, assignment, status changes, resolution, reopening, and authentication. Ticket connections use newest-first cursor pagination and calculate SLA filters before pagination. Domain/auth failures expose `extensions.code`.
