import { createYoga, type YogaInitialContext } from 'graphql-yoga';
import { createServer } from 'node:http';
import { PrismaClient } from '@prisma/client';
import { authenticate } from './services/auth/jwt';
import { createSchema } from './graphql/schema';
import type { Context } from './graphql/context';
import { createRateLimiter } from './middleware/rateLimit';

const db = new PrismaClient();
const schema = createSchema(db);
const context = ({ request }: YogaInitialContext): Context => {
  const header = request.headers.get('authorization');
  return header ? { user: authenticate(header) } : {};
};
const yoga = createYoga({ schema, context });

const rateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_MAX ?? 240),
});

const server = createServer((request, response) => {
  const ip = request.socket.remoteAddress ?? 'unknown';
  if (!rateLimiter.check(ip)) {
    response.writeHead(429, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ errors: [{ message: 'RATE_LIMITED' }] }));
    return;
  }
  yoga(request, response);
});

server.listen(Number(process.env.PORT ?? 4000), () =>
  console.log(`GraphQL running on http://localhost:${process.env.PORT ?? 4000}/graphql`),
);
