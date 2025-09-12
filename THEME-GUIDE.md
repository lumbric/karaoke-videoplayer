# Theme Configuration Guide

## How to Switch Themes

To change the theme, edit the `THEME_NAME` in `theme-config.js`:

```javascript
const THEME_CONFIG = {
  // Change this line to switch themes:
  THEME_NAME: 'karaoke-ab-hof',  // Available: 'karaoke-ab-hof', 'dark-theme', 'neon-theme'
  // ... rest of config
};
```

## Available Themes

### 1. **karaoke-ab-hof** (Default)
- Original colorful theme with purple/pink colors
- Includes the theme logo/mascot
- Perfect for party/karaoke atmosphere

### 2. **dark-theme**
- Sleek GitHub-inspired dark theme
- Blue accents and professional look
- Great for low-light environments

### 3. **neon-theme**
- Cyberpunk/neon style with bright colors
- Glowing effects and animations
- Eye-catching retro-futuristic design

## Theme Structure

Each theme folder contains:
```
static/[theme-name]/
├── theme.css          # Main stylesheet
├── logo.png           # Theme-specific logo image
└── cover_fallback.svg # Default cover image
```

## Creating Custom Themes

1. **Create a new theme folder:**
   ```bash
   mkdir static/my-custom-theme
   ```

2. **Copy base files:**
   ```bash
   cp static/karaoke-ab-hof/* static/my-custom-theme/
   ```

3. **Edit the CSS file:**
   - Modify colors, fonts, and styling in `static/my-custom-theme/theme.css`
   - Replace images if desired

4. **Update configuration:**
   ```javascript
   THEME_NAME: 'my-custom-theme',
   ```

## Configuration Options

The `THEME_CONFIG` object provides:

- `THEME_NAME`: The folder name of the active theme
- `CSS_PATH`: Automatically calculated CSS file path
- `LOGO_PATH`: Path to the theme logo image
- `COVER_FALLBACK_PATH`: Path to the fallback cover image
- `getAssetPath(filename)`: Helper to get any theme asset path

## Benefits of This System

- ✅ **Simple Configuration**: Change one line to switch themes
- ✅ **Self-Contained**: Each theme includes all its assets
- ✅ **No UI Clutter**: No theme selector interface
- ✅ **Easy Customization**: Copy and modify existing themes
- ✅ **Consistent Structure**: All themes follow the same pattern