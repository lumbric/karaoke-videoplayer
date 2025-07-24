# Karaoke Video Data Generator

This script automatically generates the `videos.json` file, downloads cover art, and stores metadata for your karaoke application.

## Quick Start

```bash
# Make the script executable (if not already)
chmod +x generate_karaoke_data.sh

# Run the script
./generate_karaoke_data.sh
```

## What it does

1. **Scans the `videos/` directory** for video files (mp4, avi, mkv, mov, webm, flv, m4v)
2. **Generates `videos.json`** with proper metadata structure
3. **Downloads cover art** automatically using available tools
4. **Stores spotdl metadata** in `metadata/` folder for future reference

## Directory Structure

```
your-project/
├── videos/           # Your video files (must exist)
├── covers/           # Generated cover images
├── metadata/         # Spotdl metadata files
├── videos.json       # Generated JSON file
└── generate_karaoke_data.sh
```

## Required Tools

- **curl** (required) - for downloading covers
- **spotdl** (optional, recommended) - for best cover art quality
- **yt-dlp** (optional) - fallback for cover downloads
- **youtube-dl** (optional) - secondary fallback
- **jq** (optional) - for better JSON parsing

## Installation of Optional Tools

```bash
# Install spotdl (recommended)
pip install spotdl

# Install yt-dlp (fallback)
pip install yt-dlp

# Install jq (for JSON parsing)
# Ubuntu/Debian:
sudo apt install jq
# macOS:
brew install jq
```

## Features

- **Smart filename cleaning** - converts filenames to readable titles
- **Multiple cover formats** - supports jpg, jpeg, png, webp
- **Automatic fallbacks** - tries multiple download methods
- **Progress tracking** - colored output with status updates
- **Error handling** - continues processing even if some covers fail
- **Existing file detection** - skips already downloaded covers

## Command Line Options

```bash
./generate_karaoke_data.sh -h    # Show help
./generate_karaoke_data.sh -v    # Verbose mode (debug output)
```

## How Cover Download Works

1. **Spotdl first** - Uses spotdl to get high-quality album art
2. **yt-dlp fallback** - Searches YouTube for the song and gets thumbnail
3. **youtube-dl fallback** - Secondary YouTube search method
4. **Graceful failure** - If no cover found, continues without error

## Example Output

```
[INFO] Starting Karaoke Video Data Generator...
[INFO] Processing: bohemian_rhapsody.mp4
[INFO] Using spotdl to download cover...
[SUCCESS] Downloaded cover via spotdl metadata
[INFO] Processing: sweet_caroline.mp4
[SUCCESS] Cover already exists: covers/sweet_caroline.jpg
[SUCCESS] Finished processing!
[INFO] Videos processed: 5
[INFO] Covers downloaded: 3
[INFO] JSON file created: videos.json
```

## Troubleshooting

- **No covers downloaded**: Install spotdl or yt-dlp
- **Permission denied**: Run `chmod +x generate_karaoke_data.sh`
- **No videos found**: Make sure video files are in the `videos/` directory
- **JSON malformed**: Check for special characters in filenames

## Integration with Karaoke App

After running the script, your karaoke application will automatically use:
- The generated `videos.json` for video metadata
- Cover images from the `covers/` directory
- Fallback images for missing covers (handled by the web app)