import type { Page } from "playwright";

export async function renderPage(page: Page, url: string) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(500);
  const html = await page.content();
  return {
    html,
    title: await page.title(),
    links: await page.$$eval("a[href]", (anchors) =>
      anchors
        .map((anchor) => (anchor as HTMLAnchorElement).href)
        .filter(Boolean)
    )
  };
}
