import { defineStore } from "pinia";
import type { AppConfig } from "../types";

interface ConfigState {
  config: AppConfig | null;
}

export const useConfigStore = defineStore("config", {
  state: (): ConfigState => ({
    config: null
  }),
  getters: {
    isReady: (state) => state.config !== null
  },
  actions: {
    setConfig(config: AppConfig): void {
      this.config = config;
    }
  }
});
