# BurdenOff

A support-ticket tracker with business-hours SLA enforcement. Reporters raise tickets, agents work them, and every ticket carries two SLA clocks — first response and resolution — that only consume business time (Mon–Fri 09:00–18:00 in a configurable timezone, minus configured holidays).

## Tech stack

- **Runtime:** Bun + TypeScript (strict, no `any`)
- **API:** GraphQL Yoga with a schema-first SDL (`src/schema.graphql`) and typed resolvers
- **Database:** PostgreSQL via Prisma ORM (versioned migrations)
- **Auth:** JWT bearer tokens + bcrypt password hashing
- **Frontend:** React 19 + Vite + Tailwind CSS
- **Tests:** Bun test runner; unit tests plus real-PostgreSQL integration tests
- **Infra:** Docker Compose (database and containerized API), GitHub Actions CI

## Quick start

```bash
cp .env.example .env          # set JWT_SECRET at minimum
docker compose up -d          # start PostgreSQL (and optionally the API image)
bun install
bun run gendb                 # prisma generate + migrate dev + seed demo data
bun run dev                   # API at http://localhost:4000/graphql
```

In a second terminal:

```bash
bun run dev:client            # frontend at http://localhost:5173
```

Demo accounts (both use password `password`):

| Role     | Email                  |
| -------- | ---------------------- |
| Agent    | `agent@example.com`    |
| Reporter | `reporter@example.com` |

## Architecture

Business logic lives in services, never in GraphQL resolvers or the frontend:

```
src/
  server.ts                 HTTP bootstrap: Yoga, context, rate limiting
  schema.graphql            schema-first SDL
  config.ts / errors.ts     environment access, coded GraphQLError helper
  graphql/
    schema.ts               executable schema factory (db + clock injected)
    resolvers.ts            thin argument/context plumbing into services
    scalars.ts, context.ts  DateTime scalar, request context type
  middleware/rateLimit.ts   fixed-window IP rate limiter (injectable clock)
  services/
    sla/engine.ts           pure business-hours math: policies, deadlines, states
    sla/presenter.ts        SLA info / resolution-attempt projection for the API
    ticket/                 create/assign/transition/pause/reopen/comment rules,
                            list+filter+pagination, dashboard, agent statistics
    auth/                   register/login service, JWT sign/verify, role guards
    holiday/                holiday set for SLA math, holiday listing
  repositories/             all Prisma access (user, ticket, comment, event, attempt)
  validation/               text/email/password validation with coded errors
prisma/                     schema, migrations, seed
tests/
  unit/                     pure logic: SLA engine, pause math, transitions, limiter
  integration/              real PostgreSQL: db reset, GraphQL persistence flow
```

Resolvers only authenticate and delegate; a fake clock is injected so SLA behavior is deterministic under test.

## Database schema overview

- **User** — email (unique), name, bcrypt `passwordHash`, role (`REPORTER`/`AGENT`)
- **Ticket** — title, description, priority (`URGENT/HIGH/MEDIUM/LOW`), status, reporter, optional assignee, `firstResponseAt`, `resolvedAt`, persisted `responseDeadline`/`resolutionDeadline`, `pausedAt`; indexes on `(createdAt,id)`, status, priority, assignee
- **Comment** — content, author, ticket; cascade delete with its ticket
- **TicketEvent** — audit trail: type (`CREATED`, `STATUS_CHANGED`, `ASSIGNED`, `FIRST_RESPONSE`, `COMMENT`, `RESOLVED`, `REOPENED`, `CLOSED`), actor, from/to status, from/to assignee, body
- **ResolutionAttempt** — one per resolution cycle (a partial unique index enforces at most one open attempt per ticket), each with its own due date
- **Holiday** — unique calendar date (`YYYY-MM-DD`) + name

CHECK constraints mirror server validation for non-empty title/description/comment content.

## SLA calculation approach

- Policies (business minutes): URGENT 60/240, HIGH 240/1440, MEDIUM 480/2880, LOW 24h→72h response/resolution.
- Deadlines are computed once at creation with `addBusinessMinutes` over weekday intervals 09:00–18:00 in `BUSINESS_TIMEZONE` (default `Asia/Kolkata`), skipping weekends and holidays, and are stored on the ticket.
- State is computed server-side at read time: `BREACHED` past deadline, `AT_RISK` when more than 75% of the budget is consumed, else `ON_TRACK`. Completed clocks freeze on their event timestamps (`firstResponseAt`, `resolvedAt`) and never change state afterwards.
- Remaining time is returned as business minutes; the frontend only displays it.
- While a ticket is `WAITING_ON_CUSTOMER` both clocks freeze (`pausedAt`); on resume each active clock restarts from the resume instant carrying exactly the business minutes it had left when paused.

## Status transition rules

```
OPEN ──▶ IN_PROGRESS ──▶ RESOLVED ──▶ CLOSED
 │ ▲         │              │
 │ └─────────┼──────────────┘ (IN_PROGRESS → OPEN)
 ▼           ▼
WAITING_ON_CUSTOMER (freeze) ──▶ OPEN / IN_PROGRESS (resume)
RESOLVED ──reopenTicket──▶ OPEN (new resolution attempt; history preserved)
CLOSED is terminal.
```

Illegal transitions fail with `INVALID_STATUS_TRANSITION`.

## Authentication & authorization

- `register` creates reporters only; requesting the `AGENT` role returns `FORBIDDEN`. Agents come from the seed/admin provisioning.
- Passwords are bcrypt-hashed (cost 12); login returns a signed JWT (8h expiry) sent as `Authorization: Bearer`.
- Everything except `register`/`login` requires authentication.
- Reporters see and comment on only their own tickets; agents act on all tickets. Authorization is enforced server-side in service guards.
- Duplicate registration attempts return a generic `VALIDATION_ERROR` to prevent account enumeration.

## Environment variables

Copy `.env.example` to `.env` (never committed):

| Variable            | Purpose                            | Default        |
| ------------------- | ---------------------------------- | -------------- |
| `DATABASE_URL`      | PostgreSQL connection string       | compose value  |
| `TEST_DATABASE_URL` | Database used by integration tests | —              |
| `JWT_SECRET`        | Token signing secret               | dev fallback   |
| `PORT`              | API port                           | `4000`         |
| `BUSINESS_TIMEZONE` | IANA zone for business hours       | `Asia/Kolkata` |
| `RATE_LIMIT_MAX`    | GraphQL requests per minute per IP | `240`          |

## Migrations

Schema changes go through Prisma migrations only (committed under `prisma/migrations`):

```bash
bunx prisma migrate dev --name describe_the_change   # develop against DATABASE_URL
bunx prisma migrate deploy                           # apply pending migrations (CI/Docker/test DBs)
```

## Seed

`bun run db:seed` upserts the two demo users above and sample holidays (Republic Day, Independence Day next year). `bun run gendb` runs generate + migrate + seed in one step.

## Run the backend

```bash
bun run dev            # http://localhost:4000/graphql (GraphiQL included)
```

Or fully containerized: `docker compose up -d --build` (API on port 4000, migrations applied on boot).

## Run the frontend

```bash
bun run dev:client     # http://localhost:5173, proxies /graphql to :4000
```

## Tests

```bash
bun test               # unit + integration (integration needs TEST_DATABASE_URL)
bun run typecheck
bun run lint
bun run build          # production client build
```

Integration tests truncate tables and exercise the real GraphQL stack against PostgreSQL; apply migrations to the test database first with `DATABASE_URL=$TEST_DATABASE_URL bunx prisma migrate deploy`. CI (GitHub Actions) runs all of the above with a postgres:16 service container.

## Example GraphQL

```graphql
mutation Login {
  login(email: "agent@example.com", password: "password") {
    token
    user {
      id
      role
    }
  }
}

query Queue {
  tickets(status: OPEN, take: 20) {
    nodes {
      id
      title
      priority
      status
      sla {
        resolutionState
        resolutionRemainingMinutes
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}

mutation Create {
  createTicket(title: "Payment failed", description: "Checkout errors", priority: URGENT) {
    id
    sla {
      firstResponseDueAt
    }
  }
}

mutation Respond($ticketId: ID!, $content: String!) {
  addComment(ticketId: $ticketId, content: $content) {
    id
  } # agent comment = first response
}

mutation Move($ticketId: ID!) {
  changeTicketStatus(ticketId: $ticketId, status: WAITING_ON_CUSTOMER) {
    id
    status
  }
}
```

All operations except `register`/`login` require the bearer token. Errors surface as GraphQL errors with machine-readable `extensions.code` (`VALIDATION_ERROR`, `TICKET_NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `INVALID_STATUS_TRANSITION`, `INVALID_COMMENT`, …). The endpoint is rate-limited per IP (`429 RATE_LIMITED`).
