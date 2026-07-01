declare module "lighthouse" {
  const lighthouse: (
    url: string,
    options: { port: number; onlyCategories?: string[] }
  ) => Promise<{ lhr: unknown }>;
  export default lighthouse;
}
