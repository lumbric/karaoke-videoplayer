# Karaoke ab Hof - Replit Project Documentation

## Overview

This is a client-side karaoke application called "Karaoke ab Hof" (Karaoke from the Farm) built with vanilla HTML, CSS, and JavaScript. The application provides a video library interface where users can browse, search, and play karaoke videos in fullscreen mode. It features a card-based grid layout for video selection and includes statistics tracking functionality.

## User Preferences

Preferred communication style: Simple, everyday language.
Design preferences: Purple/pink color scheme from poster, no CPU-intensive animations, black text with pink shadow for titles.
UI preferences: Back button in top-left corner with left arrow, ESC key clears search when no video playing.

## System Architecture

### Frontend Architecture
- **Pure client-side application**: Built entirely with vanilla web technologies (HTML5, CSS3, JavaScript)
- **Single-page application (SPA)**: All functionality contained within `index.html`
- **Responsive design**: Uses flexbox for adaptive layout across different screen sizes
- **Component-based styling**: CSS organized by functional components (cards, player, search, etc.)

### Data Management
- **Static JSON configuration**: Video metadata stored in `videos.json` file
- **Local storage**: Statistics and user preferences likely stored in browser's localStorage
- **File-based media storage**: Videos and cover images stored in local directories (`videos/` and `covers/`)

## Key Components

### Video Library Interface
- **Search functionality**: Real-time filtering of video collection
- **Grid layout**: Responsive card-based display of karaoke videos
- **Thumbnail previews**: Each video card displays cover image and title
- **Hover effects**: Interactive card scaling for better UX

### Video Player
- **Fullscreen player**: Overlay player that covers entire viewport
- **HTML5 video element**: Native browser video playback
- **Player controls**: Custom close button with overlay positioning
- **Background handling**: Black background for optimal viewing experience

### Statistics System
- **Chart.js integration**: External library for data visualization
- **Statistics button**: Fixed position access point for analytics
- **Usage tracking**: Likely tracks video play counts and user behavior

### Search System
- **Real-time filtering**: Instant search results as user types
- **Case-insensitive matching**: Flexible search implementation
- **Search info display**: User feedback for search results

## Data Flow

1. **Application initialization**: Load video metadata from `videos.json`
2. **UI rendering**: Generate video cards dynamically from JSON data
3. **User interaction**: Handle search input, card clicks, and player controls
4. **Video playback**: Stream video files from local storage
5. **Statistics collection**: Track user interactions and video plays
6. **Data persistence**: Store usage statistics in browser localStorage

## External Dependencies

### CDN Resources
- **Chart.js**: `https://cdn.jsdelivr.net/npm/chart.js` for statistics visualization
- **No other external dependencies**: Self-contained application

### Media Assets
- **Video files**: Stored locally in `videos/` directory (MP4 format)
- **Cover images**: Stored locally in `covers/` directory (JPG format)
- **Asset organization**: Predictable naming convention matching JSON metadata

## Deployment Strategy

### Static File Hosting
- **Simple deployment**: Can be hosted on any static file server
- **No server-side requirements**: Pure client-side application
- **Asset management**: Requires proper file structure with videos and covers directories
- **Performance considerations**: Large video files may require CDN for production

### Development Environment
- **Local development**: Can run directly from file system or local server
- **No build process**: Direct HTML/CSS/JS without compilation
- **Hot reload**: Changes immediately visible in browser

### Production Considerations
- **File size optimization**: Video compression needed for web delivery
- **Caching strategy**: Static assets benefit from browser caching
- **Progressive loading**: Consider lazy loading for large video collections
- **Mobile optimization**: Touch-friendly interface and responsive design

## Technical Notes

- **Language**: Interface text in German ("Karaoke ab Hof")
- **Color scheme**: Purple background (#2e255c) with pink accents (#e94d8f)
- **Video format**: MP4 files for broad browser compatibility
- **Image format**: JPG covers for efficient loading
- **Browser compatibility**: Uses modern CSS and HTML5 features