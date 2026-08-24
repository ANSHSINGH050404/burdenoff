import type { GraphQLResult, Variables } from './types';

export async function request<T>(
  token: string,
  query: string,
  variables: Variables = {},
): Promise<T> {
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const result = (await response.json().catch(() => null)) as GraphQLResult<T> | null;
  if (!result)
    throw new Error(
      `HTTP_${response.status}: no GraphQL response. Is the API running? Start it with "bun run dev".`,
    );
  if (result.errors?.length)
    throw new Error(
      result.errors
        .map((item) => `${item.extensions?.code ?? 'ERROR'}: ${item.message}`)
        .join('\n'),
    );
  if (!response.ok || !result.data) throw new Error(`EMPTY_RESPONSE (HTTP ${response.status})`);
  return result.data;
}
