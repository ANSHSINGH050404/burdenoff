export const DEFAULT_BUSINESS_TIMEZONE = 'Asia/Kolkata';

export function businessTimezone(): string {
  return process.env.BUSINESS_TIMEZONE ?? DEFAULT_BUSINESS_TIMEZONE;
}

export function jwtSecret(): string {
  return process.env.JWT_SECRET ?? 'development-secret';
}
