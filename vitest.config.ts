import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/src/tests/**/*.test.ts"],
    setupFiles: ["./server/src/tests/setup.ts"],
    restoreMocks: true,
  },
});
