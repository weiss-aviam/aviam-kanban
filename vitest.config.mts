import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: ["./src/__tests__/setup.ts"],
        include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}", "scripts/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
        exclude: ["node_modules", "dist", ".next", "coverage", "**/*.d.ts"],
        pool: "forks",
        reporters: ["verbose"],
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            exclude: ["node_modules/", "src/__tests__/", "**/*.d.ts", "**/*.config.*", "**/coverage/**", "**/dist/**", "**/.next/**"],
            thresholds: {
                global: {
                    branches: 80,
                    functions: 80,
                    lines: 80,
                    statements: 80,
                },
            },
        },
        testTimeout: 30000,
        hookTimeout: 30000,
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
