import { defineStore } from "pinia";
import type { AppConfig, SecretConfig, ThemeConfig } from "../types";
import { resolveThemeConfig } from "../services/config";

interface ConfigState {
  config: AppConfig | null;
  secret: SecretConfig;
  themeConfig: ThemeConfig;
}

export const useConfigStore = defineStore("config", {
  state: (): ConfigState => ({
    config: null,
    secret: {},
    themeConfig: resolveThemeConfig("default", null)
  }),
  getters: {
    isReady: (state) => state.config !== null,
    aiTitle: (state) => state.themeConfig.ai?.title ?? "Automatische Songvorschläge",
    aiLogoPath: (state) => state.themeConfig.ai?.logoPath,
    coverFallbackPath: (state) => state.themeConfig.coverFallbackPath
  },
  actions: {
    setConfig(config: AppConfig): void {
      this.config = config;
    },
    setSecret(secret: SecretConfig): void {
      this.secret = secret;
    },
    setThemeConfig(themeConfig: ThemeConfig | null): void {
      const themeName = this.config?.theme.name ?? "default";
      this.themeConfig = resolveThemeConfig(themeName, themeConfig);
    }
  }
});
