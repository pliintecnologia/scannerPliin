declare module "pdfkit" {
  class PDFDocument {
    constructor(options?: Record<string, unknown>);
    on(event: "data", listener: (chunk: Buffer) => void): this;
    on(event: "end", listener: () => void): this;
    on(event: "error", listener: (error: unknown) => void): this;
    fontSize(size: number): this;
    text(text: string, options?: Record<string, unknown>): this;
    moveDown(lines?: number): this;
    end(): void;
  }

  export default PDFDocument;
}
