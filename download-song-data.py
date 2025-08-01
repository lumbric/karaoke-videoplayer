#!/usr/bin/env python3
"""
Download Song Data Script - Python Version
Uses spotdl to retrieve accurate metadata and cover art for karaoke videos.
"""

import os
import json
import subprocess
import tempfile
import argparse
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import logging

# Configuration
VIDEOS_DIR = "videos"
COVERS_DIR = "covers"
OUTPUT_JSON = "videos.json"
METADATA_JSON = "metadata.json"
VIDEO_EXTENSIONS = [".mp4", ".avi", ".mkv", ".mov", ".webm", ".flv", ".m4v"]
COVER_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"]

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)


def check_dependencies():
    """Check if required tools are available."""
    required = ["spotdl", "ffprobe"]
    missing = []
    
    for tool in required:
        try:
            subprocess.run([tool, "--version"], capture_output=True, check=True)
            logger.info(f"✓ {tool} found")
        except (subprocess.CalledProcessError, FileNotFoundError):
            missing.append(tool)
            logger.error(f"✗ {tool} not found")
    
    if missing:
        logger.error(f"Missing dependencies: {', '.join(missing)}")
        logger.error("Install with: pip install spotdl && apt install ffmpeg")
        return False
    
    return True


def get_video_files() -> List[Path]:
    """Get all video files from the videos directory."""
    videos_path = Path(VIDEOS_DIR)
    if not videos_path.exists():
        logger.error(f"Videos directory '{VIDEOS_DIR}' not found!")
        return []
    
    video_files = []
    for ext in VIDEO_EXTENSIONS:
        video_files.extend(videos_path.glob(f"*{ext}"))
    
    logger.info(f"Found {len(video_files)} video files")
    return video_files


def get_existing_cover(base_name: str) -> Optional[str]:
    """Check if cover already exists with any supported extension."""
    covers_path = Path(COVERS_DIR)
    for ext in COVER_EXTENSIONS:
        cover_file = covers_path / f"{base_name}{ext}"
        if cover_file.exists():
            return cover_file.name
    return None


def download_cover(base_name: str, search_query: str) -> Optional[str]:
    """Download cover art using spotdl."""
    existing_cover = get_existing_cover(base_name)
    if existing_cover:
        logger.info(f"Cover already exists: {existing_cover}")
        return existing_cover
    
    logger.info(f"Downloading cover for: {search_query}")
    
    # Create covers directory if it doesn't exist
    Path(COVERS_DIR).mkdir(exist_ok=True)
    
    try:
        # Download cover using spotdl
        result = subprocess.run([
            "spotdl", "save", search_query,
            "--save-file", "/dev/null",  # We don't need the metadata file
            "--output", f"{COVERS_DIR}/{base_name}",
            "--format", "jpg"
        ], capture_output=True, text=True, timeout=30)
        
        # Check if cover was downloaded
        new_cover = get_existing_cover(base_name)
        if new_cover:
            logger.info(f"✓ Downloaded cover: {new_cover}")
            return new_cover
        else:
            logger.warning(f"✗ Failed to download cover for: {search_query}")
            return None
            
    except subprocess.TimeoutExpired:
        logger.warning(f"✗ Timeout downloading cover for: {search_query}")
        return None
    except Exception as e:
        logger.warning(f"✗ Error downloading cover for {search_query}: {e}")
        return None


def get_spotdl_metadata(search_query: str) -> Optional[Dict]:
    """Get metadata from spotdl."""
    logger.info(f"Getting metadata for: {search_query}")
    
    try:
        with tempfile.NamedTemporaryFile(mode='w+', suffix='.json', delete=False) as temp_file:
            temp_path = temp_file.name
        
        # Use spotdl to get metadata
        result = subprocess.run([
            "spotdl", "save", search_query,
            "--save-file", temp_path
        ], capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0 and os.path.exists(temp_path):
            with open(temp_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
            
            os.unlink(temp_path)  # Clean up temp file
            
            if metadata:  # Check if metadata is not empty
                logger.info(f"✓ Retrieved metadata for: {search_query}")
                return metadata
        
        # Clean up temp file if it exists
        if os.path.exists(temp_path):
            os.unlink(temp_path)
            
        logger.warning(f"✗ No metadata found for: {search_query}")
        return None
        
    except subprocess.TimeoutExpired:
        logger.warning(f"✗ Timeout getting metadata for: {search_query}")
        return None
    except Exception as e:
        logger.warning(f"✗ Error getting metadata for {search_query}: {e}")
        return None


def get_video_duration(video_path: Path) -> Optional[float]:
    """Get video duration using ffprobe."""
    try:
        result = subprocess.run([
            "ffprobe", "-v", "quiet",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(video_path)
        ], capture_output=True, text=True)
        
        if result.returncode == 0 and result.stdout.strip():
            return float(result.stdout.strip())
    except Exception as e:
        logger.warning(f"Could not get duration for {video_path}: {e}")
    
    return None


def extract_song_info(metadata: Dict) -> Tuple[str, str, Optional[str]]:
    """Extract artist, title, and genre from spotdl metadata."""
    # Extract artist
    artist = "Unknown Artist"
    if "artists" in metadata and metadata["artists"]:
        artist = metadata["artists"][0].get("name", "Unknown Artist")
    
    # Extract title
    title = metadata.get("name", "Unknown Title")
    
    # Extract genre
    genre = None
    if "genres" in metadata and metadata["genres"]:
        genre = metadata["genres"][0]
    
    return artist, title, genre


def process_video_file(video_path: Path) -> Optional[Dict]:
    """Process a single video file."""
    base_name = video_path.stem
    logger.info(f"Processing: {video_path.name}")
    
    # Get metadata from spotdl
    metadata = get_spotdl_metadata(base_name)
    if not metadata:
        logger.warning(f"Skipping {video_path.name} - no metadata available")
        return None
    
    # Extract song information
    artist, title, genre = extract_song_info(metadata)
    
    if not artist or not title or artist == "Unknown Artist" or title == "Unknown Title":
        logger.warning(f"Skipping {video_path.name} - incomplete metadata")
        return None
    
    logger.info(f"→ Artist: '{artist}', Title: '{title}'" + (f", Genre: '{genre}'" if genre else ""))
    
    # Download cover
    cover_filename = download_cover(base_name, base_name)
    
    # Get video duration
    duration = get_video_duration(video_path)
    
    # Build video entry for videos.json
    video_entry = {
        "filename": base_name,
        "artist": artist,
        "title": title
    }
    
    # Add optional fields
    if genre:
        video_entry["genre"] = genre
    
    if video_path.name != f"{base_name}.mp4":
        video_entry["video_filename"] = video_path.name
    
    if cover_filename and cover_filename != f"{base_name}.jpg":
        video_entry["cover_filename"] = cover_filename
    
    if duration:
        video_entry["duration_seconds"] = round(duration, 2)
    
    video_entry["processed_at"] = subprocess.run(
        ["date", "-u", "+%Y-%m-%dT%H:%M:%SZ"],
        capture_output=True, text=True
    ).stdout.strip()
    
    return {
        "video_entry": video_entry,
        "metadata": metadata,
        "base_name": base_name
    }


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Download song metadata and covers using spotdl")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose output")
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    logger.info("Starting Download Song Data Script (Python)...")
    
    # Check dependencies
    if not check_dependencies():
        return 1
    
    # Get video files
    video_files = get_video_files()
    if not video_files:
        return 1
    
    # Create covers directory
    Path(COVERS_DIR).mkdir(exist_ok=True)
    
    # Process videos
    videos_data = []
    metadata_data = {}
    processed_count = 0
    cover_downloaded_count = 0
    
    for video_path in video_files:
        result = process_video_file(video_path)
        if result:
            videos_data.append(result["video_entry"])
            metadata_data[result["base_name"]] = result["metadata"]
            processed_count += 1
            
            if get_existing_cover(result["base_name"]):
                cover_downloaded_count += 1
    
    # Write videos.json
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(videos_data, f, indent=2, ensure_ascii=False)
    
    # Write metadata.json
    with open(METADATA_JSON, 'w', encoding='utf-8') as f:
        json.dump(metadata_data, f, indent=2, ensure_ascii=False)
    
    # Print summary
    logger.info("✓ Finished processing!")
    logger.info(f"Videos processed: {processed_count}/{len(video_files)}")
    logger.info(f"Covers available: {cover_downloaded_count}")
    logger.info(f"JSON files created: {OUTPUT_JSON}, {METADATA_JSON}")
    
    if processed_count == 0:
        logger.warning("No videos were successfully processed!")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
