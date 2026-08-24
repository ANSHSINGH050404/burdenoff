import { gqlError } from '../errors';

export function requireText(
  value: string,
  code: string,
  limits: { min: number; max: number },
): string {
  const trimmed = value.trim();
  if (trimmed.length < limits.min || trimmed.length > limits.max) throw gqlError(code);
  return trimmed;
}

export function requireEmail(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) throw gqlError('VALIDATION_ERROR');
  return trimmed;
}

export function requirePassword(value: string): string {
  if (value.length < 8)
    throw gqlError('VALIDATION_ERROR', 'Password must be at least 8 characters');
  return value;
}
