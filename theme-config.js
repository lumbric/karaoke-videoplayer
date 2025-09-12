// Theme Configuration
// Change the THEME_NAME to switch between different themes
// Available themes: 'karaoke-ab-hof', 'dark-theme', 'neon-theme'

const THEME_CONFIG = {
  // Set the theme folder name here
  THEME_NAME: 'karaoke-ab-hof',
  
  // Theme paths (automatically calculated based on THEME_NAME)
  get CSS_PATH() {
    return `static/${this.THEME_NAME}/theme.css`;
  },
  
  get LOGO_PATH() {
    return `static/${this.THEME_NAME}/logo.png`;
  },
  
  get COVER_FALLBACK_PATH() {
    return `static/${this.THEME_NAME}/cover_fallback.svg`;
  },
  
  // Helper function to get any theme asset
  getAssetPath(filename) {
    return `static/${this.THEME_NAME}/${filename}`;
  }
};