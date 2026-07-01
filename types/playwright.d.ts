declare module "playwright" {
  export type Page = {
    goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<void>;
    waitForTimeout(ms: number): Promise<void>;
    content(): Promise<string>;
    title(): Promise<string>;
    addScriptTag(options: { content: string }): Promise<void>;
    evaluate<T>(pageFunction: (...args: never[]) => T | Promise<T>): Promise<T>;
    setContent(html: string, options?: { waitUntil?: string }): Promise<void>;
    pdf(options: {
      format: "A4" | string;
      printBackground?: boolean;
      margin?: { top: string; right: string; bottom: string; left: string };
    }): Promise<Buffer>;
    $$eval<T>(selector: string, pageFunction: (elements: Element[]) => T): Promise<T>;
  };

  export const chromium: {
    launch(options?: { headless?: boolean; args?: string[] }): Promise<{
      newPage(options?: { viewport?: { width: number; height: number } }): Promise<Page>;
      close(): Promise<void>;
    }>;
  };
}
