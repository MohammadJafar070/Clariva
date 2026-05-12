const requests = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(ip: string, limit = 20, windowMs = 60000): boolean {
  const now = Date.now();
  const record = requests.get(ip);

  if (!record || now > record.resetTime) {
    requests.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}
