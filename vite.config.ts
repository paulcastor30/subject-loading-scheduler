import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  base: "/subject-loading-scheduler/",
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules") &&
            ["/react/", "/react-dom/", "/scheduler/"].some((name) =>
              id.includes(name),
            )
          )
            return "react";
          if (
            id.includes("node_modules") &&
            (id.includes("read-excel-file") || id.includes("write-excel-file"))
          )
            return "spreadsheets";
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["e2e/**", "node_modules/**"],
  },
});
