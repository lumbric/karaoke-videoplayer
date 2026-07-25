import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import invidiousProxy from "./vite-proxy-middleware";

export default defineConfig({
  plugins: [vue(), invidiousProxy()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts"]
  }
});
