import type { Logger } from './logger';

type ObservedRequest = {
  method?: string;
  url?: string;
  socket?: { remoteAddress?: string };
};

type ObservedResponse = {
  statusCode: number;
  on: (event: 'finish', listener: () => void) => unknown;
};

/**
 * Emits one structured log line per HTTP request when the response finishes.
 */
export function observeRequest(
  request: ObservedRequest,
  response: ObservedResponse,
  logger: Logger,
): void {
  const startedAt = Date.now();
  const base = {
    method: request.method ?? 'UNKNOWN',
    path: request.url?.split('?')[0] ?? 'unknown',
    ip: request.socket?.remoteAddress ?? 'unknown',
  };
  response.on('finish', () => {
    const fields = {
      ...base,
      status: response.statusCode,
      durationMs: Date.now() - startedAt,
    };
    if (response.statusCode >= 500) logger.error('request', fields);
    else if (response.statusCode >= 400) logger.warn('request', fields);
    else logger.info('request', fields);
  });
}
