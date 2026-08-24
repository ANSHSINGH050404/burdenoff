import { GraphQLError } from 'graphql';

export function gqlError(code: string, message?: string): GraphQLError {
  return new GraphQLError(message ?? code, { extensions: { code } });
}
