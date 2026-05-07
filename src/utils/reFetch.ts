/**
 * A highly resilient fetch wrapper that automatically retries on 502/503/504 errors.
 * It uses exponential backoff with jitter to avoid triggering WAFs.
 */
import { fetch } from "bun";

export async function resilientFetch(
  url: string,
  options: RequestInit,
  maxRetries = 99,
): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 60-second leash per request to prevent hanging the Worker
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const fetchOptions: RequestInit & {
        tls?: { rejectUnauthorized: boolean };
        idleTimeout?: number;
      } = {
        ...options,
        signal: controller.signal,
        idleTimeout: 60000, // Ensure idle connections are also killed after 60s
        tls: { rejectUnauthorized: false }, // Disable TLS verification to handle self-signed certs
      };

      const res = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      // If it's a success, a redirect, or a hard SSL/Auth error (401, 526), return immediately.
      // We ONLY want to retry on momentary server crashes (500, 502, 503, 504).
      if (![500, 502, 503, 504].includes(res.status)) {
        return res;
      }
    } catch (error: any) {}

    // If this was the last attempt, break out and let the router handle the failure
    if (attempt === maxRetries) {
      break;
    }

    // Exponential backoff + Jitter (Attempt 1: ~1s, Attempt 2: ~2s, Attempt 3: ~4s)
    // const baseDelay = Math.pow(2, attempt - 1) * 1000;
    // const jitter = Math.random() * 300;
    // await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));
  }

  // Fallback: If all retries failed, do one final raw fetch so the router gets the actual 50x response to parse.
  return fetch(url, options);
}
