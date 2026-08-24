import { describe, expect, test } from 'bun:test';
import { createLogger, parseLogLevel, type LogFields } from '../../src/middleware/logger';
import { observeRequest } from '../../src/middleware/requestLogging';

function collectingLogger(level: 'debug' | 'info' | 'warn' | 'error' = 'info') {
  const lines: { level: string; msg: string; fields: LogFields }[] = [];
  const logger = createLogger(level, (line) => {
    const parsed = JSON.parse(line) as { level: string; msg: string } & LogFields;
    const { level: entryLevel, msg, ...fields } = parsed;
    lines.push({ level: entryLevel, msg, fields });
  });
  return { logger, lines };
}

describe('logger', () => {
  test('emits json lines with fields', () => {
    const { logger, lines } = collectingLogger();
    logger.info('request', { status: 200, durationMs: 4 });
    expect(lines).toHaveLength(1);
    expect(lines[0]!.level).toBe('info');
    expect(lines[0]!.msg).toBe('request');
    expect(lines[0]!.fields.status).toBe(200);
  });

  test('respects the configured minimum level', () => {
    const { logger, lines } = collectingLogger('warn');
    logger.debug('noisy');
    logger.info('fine');
    logger.warn('careful');
    expect(lines.map((line) => line.msg)).toEqual(['careful']);
  });

  test('parses unknown levels back to info', () => {
    expect(parseLogLevel(undefined)).toBe('info');
    expect(parseLogLevel('loud')).toBe('info');
    expect(parseLogLevel('error')).toBe('error');
  });
});

describe('request logging', () => {
  function fakeResponse() {
    let listener: (() => void) | undefined;
    return {
      statusCode: 200,
      on: (_event: 'finish', callback: () => void) => {
        listener = callback;
      },
      finish(statusCode: number) {
        this.statusCode = statusCode;
        listener?.();
      },
    };
  }

  test('logs one info line with duration and identity for success responses', () => {
    const { logger, lines } = collectingLogger();
    const response = fakeResponse();
    observeRequest(
      { method: 'POST', url: '/graphql?x=1', socket: { remoteAddress: '10.0.0.9' } },
      response,
      logger,
    );
    response.finish(200);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.msg).toBe('request');
    expect(lines[0]!.fields.status).toBe(200);
    expect(lines[0]!.fields.ip).toBe('10.0.0.9');
    expect(lines[0]!.fields.path).toBe('/graphql');
  });

  test('escalates client errors to warn and server errors to error', () => {
    const { logger, lines } = collectingLogger();
    const first = fakeResponse();
    observeRequest({ method: 'POST', url: '/graphql' }, first, logger);
    first.finish(429);
    const second = fakeResponse();
    observeRequest({ method: 'POST', url: '/graphql' }, second, logger);
    second.finish(500);
    expect(lines.map((line) => line.level)).toEqual(['warn', 'error']);
  });
});
