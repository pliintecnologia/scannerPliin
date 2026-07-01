declare module "@sparticuz/chromium" {
  const chromium: {
    args: string[];
    headless: boolean | "shell";
    executablePath(): Promise<string>;
  };

  export default chromium;
}
