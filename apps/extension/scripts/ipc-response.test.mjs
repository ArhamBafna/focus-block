import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../popup/lib/ipc.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { getServiceErrorMessage } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

test("reads the service message from Rust's externally tagged error response", () => {
  assert.equal(
    getServiceErrorMessage({
      status: "Err",
      data: { message: "A focus session is already active." },
    }),
    "A focus session is already active.",
  );
});

test("keeps compatibility with a top-level service error message", () => {
  assert.equal(
    getServiceErrorMessage({ status: "Err", message: "Service unavailable." }),
    "Service unavailable.",
  );
});
