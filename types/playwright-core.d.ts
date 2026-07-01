declare module "playwright-core" {
  export type Page = import("playwright").Page;

  export const chromium: {
    launch(options?: {
      headless?: boolean;
      args?: string[];
      executablePath?: string;
    }): Promise<{
      newPage(options?: { viewport?: { width: number; height: number } }): Promise<Page>;
      close(): Promise<void>;
    }>;
  };
}
