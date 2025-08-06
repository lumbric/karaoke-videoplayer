#!/usr/bin/env python3
"""
Update Song Data

This script generates or updates the videos.json file according to the files in the videos folder
and downloads cover images and metadata using spotdl for the song (if a network connection is
available).

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
EXTRA_METADATA_JSON = "extra_metadata.json"

# FIXME this is probably not necessary
VIDEO_EXTENSIONS = [".mp4", ".avi", ".mkv", ".mov", ".webm", ".flv", ".m4v"]
COVER_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"]


logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)


def save_json_files(videos_data, extra_metadata_data):
    """Save current videos and extra metadata to JSON files."""
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(videos_data, f, indent=2, ensure_ascii=False)

    with open(EXTRA_METADATA_JSON, 'w', encoding='utf-8') as f:
        json.dump(extra_metadata_data, f, indent=2, ensure_ascii=False)


def load_existing_data() -> Tuple[List[Dict], Dict]:
    """Load existing videos.json and extra_metadata.json files."""
    existing_videos = []
    existing_extra_metadata = {}

    if os.path.exists(OUTPUT_JSON):
        with open(OUTPUT_JSON, 'r', encoding='utf-8') as f:
            existing_videos = json.load(f)
        logger.info(f"✓ Loaded {len(existing_videos)} existing video entries")

    if os.path.exists(EXTRA_METADATA_JSON):
        with open(EXTRA_METADATA_JSON, 'r', encoding='utf-8') as f:
            existing_extra_metadata = json.load(f)
        logger.info(f"✓ Loaded extra metadata for {len(existing_extra_metadata)} videos")

    return existing_videos, existing_extra_metadata


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
    for ext in COVER_EXTENSIONS:
        cover_file = Path(COVERS_DIR) / f"{base_name}{ext}"
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

    # Download cover using spotdl
    result = subprocess.run([
        "spotdl", "save", search_query,
        "--save-file", "/dev/null",  # We don't need the metadata file
        "--output", f"{COVERS_DIR}/{base_name}",
        "--format", "jpg"
    ], capture_output=True, text=True, timeout=100, check=True)

    # Check if cover was downloaded
    new_cover = get_existing_cover(base_name)
    if new_cover:
        logger.info(f"✓ Downloaded cover: {new_cover}")
        return new_cover
    else:
        logger.warning(f"✗ Failed to download cover for: {search_query}")
        return None


def get_spotdl_metadata(search_query: str) -> Optional[Dict]:
    """Get metadata from spotdl."""
    logger.info(f"Getting metadata for: {search_query}")

    try:
        with tempfile.NamedTemporaryFile(mode='w+', suffix='.spotdl', delete=False) as temp_file:
            temp_path = temp_file.name

        # Use spotdl to get metadata
        result = subprocess.run([
            "spotdl", "save", search_query,
            "--save-file", temp_path
        ], capture_output=False, text=True, timeout=30)

        # Log explicit error output
        if result.returncode != 0:
            logger.warning(f"✗ spotdl failed for metadata '{search_query}' (exit code {result.returncode})")
            if result.stdout.strip():
                logger.warning(f"  STDOUT: {result.stdout.strip()}")
            if result.stderr.strip():
                logger.warning(f"  STDERR: {result.stderr.strip()}")

            # Clean up temp file if it exists
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            return None

        if result.returncode == 0 and os.path.exists(temp_path):
            with open(temp_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)

            if len(metadata) != 1:
                raise ValueError("unexpected length of metadata:", len(metadata))

            metadata = metadata[0]

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


def needs_update(video_entry: Dict) -> Tuple[bool, List[str]]:
    """Check if a video entry needs metadata or cover updates."""
    reasons = []

    # Check if metadata is missing (no artist or title in videos.json)
    if not video_entry.get("artist") or not video_entry.get("title"):
        reasons.append("missing metadata")

    # Check if cover is missing
    if not get_existing_cover(video_entry["filename"]):
        reasons.append("missing cover")

    return len(reasons) > 0, reasons


def update_video_entry(video_entry: Dict, video_path: Path) -> Tuple[Optional[Dict], Optional[Dict]]:
    """Update a single video entry with missing metadata/cover."""
    base_name = video_entry["filename"]
    logger.info(f"Updating: {base_name}")

    # Get metadata from spotdl if not available or incomplete
    extra_metadata = None
    if not video_entry.get("artist") and not video_entry.get("title"):
        extra_metadata = get_spotdl_metadata(base_name)
        if extra_metadata:
            # Extract song information
            artist, title, genre = extract_song_info(extra_metadata)

            logger.info(f"→ Artist: '{artist or 'N/A'}', Title: '{title or 'N/A'}'" + (f", Genre: '{genre}'" if genre else ""))

            # Update video entry with new metadata
            if artist:
                video_entry["artist"] = artist

            if title:
                video_entry["title"] = title

            if genre:
                video_entry["genre"] = genre

            # Update processed timestamp
            video_entry["processed_at"] = subprocess.run(
                ["date", "-u", "+%Y-%m-%dT%H:%M:%SZ"],
                capture_output=True, text=True
            ).stdout.strip()

    # Download cover if missing
    if not get_existing_cover(base_name):
        cover_filename = download_cover(base_name, base_name)
        if cover_filename and cover_filename != f"{base_name}.jpg":
            video_entry["cover_filename"] = cover_filename

    return video_entry, extra_metadata


def extract_song_info(metadata: Dict) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Extract artist, title, and genre from spotdl metadata."""
    # Extract artist
    artist = None
    if "artists" in metadata and metadata["artists"]:
        artist_name = metadata["artists"][0].get("name", "").strip()
        if artist_name and artist_name != "Unknown Artist":
            artist = artist_name
    elif "artist" in metadata:
        artist_name = metadata.get("artist", "").strip()
        if artist_name and artist_name != "Unknown Artist":
            artist = artist_name

    # Extract title
    title = None
    title_name = metadata.get("name", "").strip()
    if title_name and title_name != "Unknown Title":
        title = title_name

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
    extra_metadata = get_spotdl_metadata(base_name)
    if not extra_metadata:
        logger.warning(f"Skipping {video_path.name} - no metadata available")
        return None

    # Extract song information
    artist, title, genre = extract_song_info(extra_metadata)

    logger.info(f"→ Artist: '{artist or 'N/A'}', Title: '{title or 'N/A'}'" + (f", Genre: '{genre}'" if genre else ""))

    # Download cover
    cover_filename = download_cover(base_name, base_name)

    # Get video duration
    duration = get_video_duration(video_path)

    # Build video entry for videos.json
    video_entry = {
        "filename": base_name
    }

    # Add optional fields only if they have valid values
    if artist:
        video_entry["artist"] = artist

    if title:
        video_entry["title"] = title

    if genre:
        video_entry["genre"] = genre

    # Add optional fields
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
        "extra_metadata": extra_metadata,
        "base_name": base_name
    }


def main():
    parser = argparse.ArgumentParser(description="Update song metadata and covers using spotdl")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose output")
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Load existing data
    videos_data, extra_metadata_data = load_existing_data()

    # Get video files from filesystem
    video_files = get_video_files()
    if not video_files:
        logger.error("No video files found!")
        return 1

    # Create covers directory
    Path(COVERS_DIR).mkdir(exist_ok=True)

    # Build a map of existing video entries by filename
    existing_videos_map = {entry["filename"]: entry for entry in videos_data}

    if len(existing_videos_map) < len(videos_data):
        raise ValueError()

    # Process each video file
    processed_count = 0
    updated_count = 0
    cover_downloaded_count = 0

    try:
        for video_path in video_files:
            base_name = video_path.stem

            # Check if video entry already exists
            if base_name in existing_videos_map:
                video_entry = existing_videos_map[base_name]

                # Check if update is needed (only based on videos.json data and cover existence)
                needs_updating, reasons = needs_update(video_entry)

                if needs_updating:
                    logger.info(f"Updating {base_name}: {', '.join(reasons)}")
                    updated_entry, new_extra_metadata = update_video_entry(video_entry, video_path)

                    if updated_entry:
                        # Update the entry in our data
                        existing_videos_map[base_name] = updated_entry
                        if new_extra_metadata:
                            extra_metadata_data[base_name] = new_extra_metadata
                        updated_count += 1
                else:
                    logger.info(f"✓ {base_name} is up to date")
            else:
                # New video file - process it completely
                logger.info(f"New video found: {base_name}")
                result = process_video_file(video_path)
                if result:
                    existing_videos_map[base_name] = result["video_entry"]
                    extra_metadata_data[base_name] = result["extra_metadata"]
                    processed_count += 1

            # Save after every new video for resume capability
            videos_data = list(existing_videos_map.values())
            save_json_files(videos_data, extra_metadata_data)

            # Count covers that exist
            if get_existing_cover(base_name):
                cover_downloaded_count += 1

    finally:
        videos_data = list(existing_videos_map.values())
        save_json_files(videos_data, extra_metadata_data)

    logger.info(f"Videos processed: {processed_count} new, {updated_count} updated")
    logger.info(f"Covers available: {cover_downloaded_count}")
    logger.info(f"JSON files saved: {OUTPUT_JSON}, {EXTRA_METADATA_JSON}")

    return 0


if __name__ == "__main__":
    exit(main())
