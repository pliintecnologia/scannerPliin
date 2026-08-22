import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
  .split(/\r?\n/).filter((file) => /^(app|lib)\/.*\.tsx?$/.test(file));
const violations = [];
for (const file of files) {
  const source = await readFile(file, "utf8");
  const patterns = [
    { regex: /(?:query|client\.query|tenantQuery)\s*\(\s*`[^`]*\$\{/gs, reason: "interpolação em SQL" },
    { regex: /(?:query|client\.query|tenantQuery)\s*\(\s*[^"'`\s][^,)]*\+/g, reason: "concatenação em SQL" }
  ];
  for (const pattern of patterns) if (pattern.regex.test(source)) violations.push(`${file}: ${pattern.reason}`);
}
if (violations.length) {
  console.error(violations.join("\n"));
  process.exit(1);
}
console.log("Verificação SQL: nenhuma interpolação ou concatenação detectada.");
