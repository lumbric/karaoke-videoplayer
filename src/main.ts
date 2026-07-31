import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { getThemeCssPath, loadRuntimeConfig, loadThemeConfig, validateProviderSecrets } from "./services/config";
import { loadSecretConfig } from "./services/secretConfig";
import { useConfigStore } from "./stores/configStore";
import { useCatalogStore } from "./stores/catalogStore";

function renderFatalError(message: string): void {
  document.title = "Karaoke Player - Konfigurationsfehler";

  const mountNode = document.getElementById("app");
  if (!mountNode) {
    throw new Error(message);
  }

  mountNode.innerHTML = `
    <section class="error-box" role="alert">
      <h1>Start fehlgeschlagen</h1>
      <p>Die Datei config.json fehlt oder ist ungültig.</p>
      <p><strong>Details:</strong> ${message}</p>
    </section>
  `;
}

function applyRuntimeTheme(cssPath: string): void {
  const link = document.getElementById("theme-override") as HTMLLinkElement | null;
  if (!link) {
    return;
  }

  link.href = cssPath;
}

async function bootstrap(): Promise<void> {
  try {
    const config = await loadRuntimeConfig();
    const secret = await loadSecretConfig();
    validateProviderSecrets(config, secret);

    document.title = config.theme.title;
    applyRuntimeTheme(getThemeCssPath(config));

    const app = createApp(App);
    const pinia = createPinia();

    app.use(pinia);

    const configStore = useConfigStore(pinia);
    const catalogStore = useCatalogStore(pinia);

    configStore.setConfig(config);
    configStore.setSecret(secret);

    const themeConfig = await loadThemeConfig(config.theme.name);
    configStore.setThemeConfig(themeConfig);

    await catalogStore.initialize(config);

    app.mount("#app");
  } catch (error) {
    renderFatalError(String(error));
  }
}

void bootstrap();
