import { defineStore } from "pinia";
import type { AppConfig, SecretConfig } from "../types";

interface ConfigState {
  config: AppConfig | null;
  secret: SecretConfig;
}

export const useConfigStore = defineStore("config", {
  state: (): ConfigState => ({
    config: null,
    secret: {}
  }),
  getters: {
    isReady: (state) => state.config !== null
  },
  actions: {
    setConfig(config: AppConfig): void {
      this.config = config;
    },
    setSecret(secret: SecretConfig): void {
      this.secret = secret;
    }
  }
});
