export function rejectCrossOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const expectedHost = forwardedHost || request.headers.get("host") || new URL(request.url).host;
    return originUrl.host !== expectedHost;
  } catch {
    return true;
  }
}

export function bodyTooLarge(request: Request, maxBytes: number) {
  const length = Number(request.headers.get("content-length") || 0);
  return Number.isFinite(length) && length > maxBytes;
}
