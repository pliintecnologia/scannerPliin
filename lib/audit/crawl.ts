export function getSameOriginLinks(baseUrl: string, html: string, maxPages: number) {
  const origin = new URL(baseUrl).origin;
  const anchors = Array.from(html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi));
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const match of anchors) {
    try {
      const target = new URL(match[1], baseUrl);
      if (target.origin !== origin) continue;
      target.hash = "";
      const normalized = target.toString();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      urls.push(normalized);
      if (urls.length >= maxPages) break;
    } catch {
      continue;
    }
  }

  return urls;
}
