type LaunchOverrides = {
  args?: string[];
};

type BrowserLaunchOptions = {
  headless?: boolean;
  args?: string[];
  executablePath?: string;
};

type ChromiumModule = {
  chromium: {
    launch(options?: BrowserLaunchOptions): Promise<unknown>;
  };
};

type SparticuzChromiumModule = {
  args: string[];
  headless: boolean | "shell";
  executablePath(): Promise<string>;
};

export async function getChromiumLaunchOptions(overrides: LaunchOverrides = {}): Promise<BrowserLaunchOptions> {
  const extraArgs = overrides.args ?? [];
  const isServerless = process.env.VERCEL === "1" || process.env.AWS_REGION || process.env.NODE_ENV === "production";

  if (!isServerless) {
    return {
      headless: true,
      args: extraArgs
    };
  }

  const chromiumBinary = (await import("@sparticuz/chromium")).default as SparticuzChromiumModule;
  return {
    headless: true,
    executablePath: await chromiumBinary.executablePath(),
    args: [...chromiumBinary.args, ...extraArgs]
  };
}

export async function launchBrowser(overrides: LaunchOverrides = {}): Promise<any> {
  const options = await getChromiumLaunchOptions(overrides);
  const chromiumModule = (
    process.env.VERCEL === "1" || process.env.AWS_REGION || process.env.NODE_ENV === "production"
      ? await import("playwright-core")
      : await import("playwright")
  ) as ChromiumModule;

  return await chromiumModule.chromium.launch(options);
}
