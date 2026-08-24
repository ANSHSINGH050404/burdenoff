import { createYoga, type YogaInitialContext } from 'graphql-yoga';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { PrismaClient } from '@prisma/client';
import { authenticate } from './context';
import { createResolvers, type Context } from './api/resolvers';

const db = new PrismaClient();
const typeDefs = readFileSync(new URL('./schema.graphql', import.meta.url), 'utf8');
const schema = makeExecutableSchema({ typeDefs, resolvers: createResolvers(db) });
const context = ({ request }: YogaInitialContext): Context => { const header = request.headers.get('authorization'); return header ? { user: authenticate(header) } : {}; };
const yoga = createYoga<Record<string, never>, Context>({ schema, context });
createServer(yoga).listen(Number(process.env.PORT ?? 4000), () => console.log(`GraphQL running on http://localhost:${process.env.PORT ?? 4000}/graphql`));
