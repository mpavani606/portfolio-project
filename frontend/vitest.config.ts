import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    environmentOptions: { jsdom: { url: "http://localhost:5173/dashboard" } },
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    restoreMocks: true,
    coverage: { reporter: ["text", "html"] },
  },
});
