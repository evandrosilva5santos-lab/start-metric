// Rate limiter in-memory por chave (IP, token, etc).
// Suficiente para proteger endpoints públicos contra bruteforce/DoS leve
// em deploy single-instance; para multi-instância, migrar para Upstash/Redis.

type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();

function prune(bucket: Bucket, windowMs: number, now: number) {
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
}

export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    if (buckets.size >= 10_000) {
      // Bound de memória: descarta o bucket mais antigo (primeira chave).
      const oldest = buckets.keys().next().value;
      if (oldest !== undefined) buckets.delete(oldest);
    }
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }

  prune(bucket, options.windowMs, now);

  if (bucket.hits.length >= options.limit) {
    const oldestHit = bucket.hits[0];
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((options.windowMs - (now - oldestHit)) / 1000)),
    };
  }

  bucket.hits.push(now);
  return { allowed: true, remaining: options.limit - bucket.hits.length, retryAfterSeconds: 0 };
}

export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
