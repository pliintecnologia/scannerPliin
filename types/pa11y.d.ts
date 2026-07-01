declare module "pa11y" {
  const pa11y: (url: string, options?: Record<string, unknown>) => Promise<unknown>;
  export default pa11y;
}
