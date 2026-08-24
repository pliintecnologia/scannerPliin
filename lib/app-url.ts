type RequestWithUrl = Pick<Request, "headers" | "url">;

export function appUrl(request: RequestWithUrl, pathname: string) {
  const configuredOrigin = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configuredOrigin) return new URL(pathname, configuredOrigin);

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    return new URL(pathname, `${forwardedProto}://${forwardedHost.split(",")[0].trim()}`);
  }

  return new URL(pathname, request.url);
}
