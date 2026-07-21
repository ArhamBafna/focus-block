import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../popup/lib/ipc.ts", import.meta.url), "utf8");
const standaloneSource = source.replace(
  /^import \{ ScheduleRecord, storageGet, storageSet \} from "\.\/storage";$/m,
  "const storageGet = async () => null; const storageSet = async () => undefined;",
);
const compiled = ts.transpileModule(standaloneSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { normalizeDomain } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

test("normalizes browser site input without desktop service", () => {
  assert.equal(normalizeDomain("HTTPS://www.YouTube.com/watch?v=1"), "youtube.com");
  assert.equal(normalizeDomain("example.com:8080"), "example.com");
});

test("accepts supported wildcard input and rejects invalid values", () => {
  assert.equal(normalizeDomain("*game"), "*game");
  assert.equal(normalizeDomain("not a site"), null);
  assert.equal(normalizeDomain("*game*"), null);
});
