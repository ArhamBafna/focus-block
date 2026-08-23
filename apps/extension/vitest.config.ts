import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["background/__tests__/**/*.test.ts", "popup/**/__tests__/**/*.test.ts"],
  },
});
