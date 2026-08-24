import { GraphQLScalarType, Kind } from 'graphql';
import { gqlError } from '../errors';

export const dateTimeScalar = new GraphQLScalarType<Date, string>({
  name: 'DateTime',
  serialize: (value) =>
    value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString(),
  parseValue: (value) => new Date(String(value)),
  parseLiteral: (node) => {
    if (node.kind !== Kind.STRING) throw gqlError('INVALID_DATETIME');
    return new Date(node.value);
  },
});
