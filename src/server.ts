import { createYoga, type YogaInitialContext } from 'graphql-yoga';
import { createServer } from 'node:http';
import { PrismaClient } from '@prisma/client';
import { authenticate } from './context';
import { createSchema } from './api/schema';
import type { Context } from './api/resolvers';

const db = new PrismaClient();
const schema = createSchema(db);
const context = ({ request }: YogaInitialContext): Context => {
  const header = request.headers.get('authorization');
  return header ? { user: authenticate(header) } : {};
};
const yoga = createYoga({ schema, context });
createServer(yoga).listen(Number(process.env.PORT ?? 4000), () =>
  console.log(`GraphQL running on http://localhost:${process.env.PORT ?? 4000}/graphql`),
);
