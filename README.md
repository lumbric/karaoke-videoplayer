# Karaoke ab Hof 🎤

A local web-based karaoke video player application originally built for the festival ["Kultur ab Hof"](https://kulturabhof.at/).

## What is this?

This is a **web application for local usage** that creates a beautiful karaoke interface where you can:
- Browse your karaoke video collection in a card-based grid
- Search for songs by title or artist
- Play videos in fullscreen mode
- Track playing statistics and most popular songs
- Enjoy a responsive design that works on computers, tablets, and phones

**Why offline?** This app was designed for the "Kultur ab Hof" festival where internet connectivity is limited or unavailable. Instead of relying on YouTube or streaming services, it uses a local collection of karaoke videos that work completely offline.

## How to Use

### Quick Setup
You can get started quickly with the example data:

```bash
git clone https://github.com/lumbric/karaoke-videoplayer/
cd karaoke-videoplayer
mkdir videos

# Download example videos
cd videos
wget https://share.suuf.cc/api/shares/cAs2aB59/files/3aed7102-34cf-4965-98ce-ec442157c9d1
unzip 3aed7102-34cf-4965-98ce-ec442157c9d1

cd ..
mkdir covers

# Install dependencies for automatic metadata generation
pip3 install spotdl
pip3 install yt-dlp

# Generate metadata and covers
./generate_karaoke_data.sh

# Start the web server
python3 -m http.server 8000
```

### Manual Setup

#### 1. Setup Your Videos
Create a `videos/` folder in the project directory and place your karaoke video files (MP4 format) there:
```
karaoke-videoplayer/
├── videos/
│   ├── Song 1 - Artist.mp4
│   ├── Song 2 - Artist.mp4
│   └── ...
├── covers/ (optional - for custom thumbnails)
├── index.html
└── start.sh
```

#### 2. Generate Metadata (Optional but Recommended)
Use the included script to automatically generate metadata and cover art:

```bash
chmod +x generate_karaoke_data.sh
./generate_karaoke_data.sh
```

This script will:
- Scan your `videos/` folder for video files
- Extract artist and title information from filenames
- Generate a `videos.json` file with proper metadata
- Download cover art automatically
- Store metadata in `metadata/` folder

#### 3. Start the Web Server
**Important:** You need a local web server for video streaming to work properly. Simply opening the HTML file directly in a browser won't work due to browser security restrictions.

**Option A: Use the included script (Linux/Mac)**
```bash
chmod +x start.sh
./start.sh
```
This will start a Python web server and open the app in kiosk mode.

**Option B: Manual Python server**
```bash
python3 -m http.server 8000
# Then open http://localhost:8000 in your browser
```

**Option C: Other web servers**
```bash
# Node.js (if you have it)
npx serve .

# PHP (if available)
php -S localhost:8000

# Python 2 (older systems)
python -m SimpleHTTPServer 8000
```

#### 4. Open in Browser
Navigate to `http://localhost:8000` in your web browser.

### Adding Songs
1. Place your karaoke videos in MP4 format in the `videos/` folder
2. Use descriptive filenames like `"Song Title - Artist Name.mp4"` for best results
3. Optionally add cover images in `covers/` folder with matching names (JPG format)
4. Run `./generate_karaoke_data.sh` to update metadata
5. Refresh your browser to see new songs

### Controls
- **Search**: Type in the search box to filter songs
- **Play Video**: Click any song card to start playing
- **Fullscreen**: Videos automatically play in fullscreen mode
- **Player Controls**: 
  - ✕ button to close/exit fullscreen
  - ⏸ Pause/▶ Play button
  - ↻ Restart button to replay from beginning
- **Statistics**: Click the chart button to view song popularity and usage stats

### Keyboard Shortcuts
- **ESC**: Clear search (when no video is playing) or exit fullscreen
- **Space**: Pause/play video (when in fullscreen)

## File Structure

```
karaoke-videoplayer/
├── videos/                  # Your MP4 karaoke videos go here
├── covers/                  # Cover images (JPG) - auto-generated or custom
├── metadata/                # Song metadata (.spotdl files) - auto-generated
├── static/                  # App assets
│   ├── singing-chicken.png  # Decorative image
│   ├── RocknRollOne.ttf    # Custom font
│   └── chart.js            # Statistics charts
├── index.html              # Main application
├── start.sh               # Quick start script
├── generate_karaoke_data.sh # Metadata generation script
├── update-song-data.py    # Metadata processing
└── videos.json            # Video metadata (auto-generated)
```

## Features

### Core Features
- **Video Library**: Card-based grid showing all your karaoke videos
- **Search**: Real-time search by song title or artist name
- **Fullscreen Player**: Clean video player with play/pause and restart controls
- **Responsive Design**: Works on desktop, tablet, and mobile devices

### Advanced Features
- **Statistics Tracking**: See most played songs and hourly activity charts
- **Auto-thumbnails**: Automatic cover art generation with fallback designs
- **Metadata Support**: Enhanced display with artist/title separation
- **Custom Covers**: Support for custom thumbnail images in `covers/` folder

### Design
- Purple/pink color scheme with a fun, party atmosphere
- Custom "RocknRoll One" font for authentic karaoke feel
- Animated decorative elements (musical notes, singing chicken)
- Clean, intuitive interface optimized for party environments

## Advanced Setup

### Metadata System
The app uses a sophisticated metadata system that stores song information in a structured format for better display with "Artist - Title" formatting.

#### videos.json Format
```json
[
  {
    "filename": "99 Luftballons - Nena",
    "artist": "Nena", 
    "title": "99 Luftballons"
  }
]
```

**Benefits:**
- `filename`: Basis for automatic path generation
- `artist` and `title`: Separate fields for better display
- `file` and `cover` paths are automatically generated as `videos/{filename}.mp4` and `covers/{filename}.jpg`

#### Automatic Metadata Generation
The `generate_karaoke_data.sh` script automatically:
- Analyzes all video files in the `videos/` folder
- Extracts artist and title from filenames using intelligent parsing
- Creates `videos.json` with proper structure
- Downloads cover art using spotdl, yt-dlp, or fallback methods
- Generates `.spotdl` metadata files with extended information

#### Filename Parsing
The script recognizes various filename formats:
1. **"Artist - Title"** → Artist: "Artist", Title: "Title"
2. **"Title Artist"** → Artist: "Artist", Title: "Title" 
3. **Fallback** → Artist: "", Title: "Entire Filename"

#### Required Tools for Metadata Generation
- **curl** (required) - for downloading covers
- **spotdl** (optional, recommended) - for best cover art quality
- **yt-dlp** (optional) - fallback for cover downloads
- **jq** (optional) - for better JSON parsing

```bash
# Install recommended tools
pip install spotdl yt-dlp
```

### Custom Cover Images
Place JPG images in the `covers/` folder with the same name as your video files:
```
videos/My Song - Artist.mp4
covers/My Song - Artist.jpg
```

## Why a Web Server is Required

Modern browsers block direct file access for security reasons. When you open an HTML file directly (`file://` protocol), the browser prevents it from:
- Loading local video files
- Accessing other local files
- Making certain JavaScript operations

Running a local web server (`http://` protocol) bypasses these restrictions while keeping everything local and secure.
