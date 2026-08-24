import { readFileSync } from 'node:fs';
import { makeExecutableSchema } from '@graphql-tools/schema';
import type { GraphQLSchema } from 'graphql';
import type { PrismaClient } from '@prisma/client';
import { createResolvers } from './resolvers';

export function createSchema(db: PrismaClient, clock?: () => Date): GraphQLSchema {
  const typeDefs = readFileSync(new URL('../schema.graphql', import.meta.url), 'utf8');
  return makeExecutableSchema({ typeDefs, resolvers: createResolvers(db, clock) });
}
