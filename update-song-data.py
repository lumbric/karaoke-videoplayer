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
import socket
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


logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def check_internet_connection() -> bool:
    """Check if internet connection is available."""
    try:
        # Try to connect to a reliable DNS server
        socket.create_connection(("8.8.8.8", 53), timeout=5)
        return True
    except (socket.timeout, socket.error):
        return False


def save_json_files(videos_map, extra_metadata_data):
    """Save current videos and extra metadata to JSON files."""

    videos_data = list(videos_map.values())
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(videos_data, f, indent=2, ensure_ascii=False)

    with open(EXTRA_METADATA_JSON, "w", encoding="utf-8") as f:
        json.dump(extra_metadata_data, f, indent=2, ensure_ascii=False)


def load_existing_data() -> Tuple[List[Dict], Dict]:
    """Load existing videos.json and extra_metadata.json files."""
    existing_videos = []
    existing_extra_metadata = {}

    if os.path.exists(OUTPUT_JSON):
        with open(OUTPUT_JSON, "r", encoding="utf-8") as f:
            existing_videos = json.load(f)
        logger.info(f"✓ Loaded {len(existing_videos)} existing video entries")

    if os.path.exists(EXTRA_METADATA_JSON):
        with open(EXTRA_METADATA_JSON, "r", encoding="utf-8") as f:
            existing_extra_metadata = json.load(f)
        logger.info(
            f"✓ Loaded extra metadata for {len(existing_extra_metadata)} videos"
        )

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
    return Path(COVERS_DIR) / f"{base_name}.jpg"


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
    subprocess.run(
        [
            "spotdl",
            "save",
            search_query,
            "--save-file",
            "/dev/null",  # We don't need the metadata file
            "--output",
            f"{COVERS_DIR}/{base_name}",
            "--format",
            "jpg",
        ],
        capture_output=True,
        text=True,
        timeout=150,
        check=True,
    )

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
        with tempfile.NamedTemporaryFile(
            mode="w+", suffix=".spotdl", delete=False
        ) as temp_file:
            temp_path = temp_file.name

        # Use spotdl to get metadata
        result = subprocess.run(
            ["spotdl", "save", search_query, "--save-file", temp_path],
            capture_output=False,
            text=True,
            timeout=150,
        )

        # Log explicit error output
        if result.returncode != 0:
            logger.warning(
                f"✗ spotdl failed for metadata '{search_query}' (exit code {result.returncode})"
            )
            if result.stdout.strip():
                logger.warning(f"  STDOUT: {result.stdout.strip()}")
            if result.stderr.strip():
                logger.warning(f"  STDERR: {result.stderr.strip()}")

            # Clean up temp file if it exists
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            return None

        if result.returncode == 0 and os.path.exists(temp_path):
            with open(temp_path, "r", encoding="utf-8") as f:
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
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "quiet",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(video_path),
            ],
            capture_output=True,
            text=True,
        )

        if result.returncode == 0 and result.stdout.strip():
            return float(result.stdout.strip())
    except Exception as e:
        logger.warning(f"Could not get duration for {video_path}: {e}")

    return None


def needs_update(
    video_entry: Dict, no_internet: bool = False
) -> Tuple[bool, List[str]]:
    """Check if a video entry needs metadata or cover updates."""
    reasons = []

    if no_internet:
        # In offline mode, we only care if the entry exists
        return False, []

    # Check if metadata is missing (no artist or title in videos.json)
    if not video_entry.get("artist") or not video_entry.get("title"):
        reasons.append("missing metadata")

    # Check if cover is missing
    if not get_existing_cover(video_entry["filename"]):
        reasons.append("missing cover")

    return len(reasons) > 0, reasons


def update_video_entry(
    video_entry: Dict, video_path: Path
) -> Tuple[Optional[Dict], Optional[Dict]]:
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

            logger.info(
                f"→ Artist: '{artist or 'N/A'}', Title: '{title or 'N/A'}'"
                + (f", Genre: '{genre}'" if genre else "")
            )

            # Update video entry with new metadata
            if artist:
                video_entry["artist"] = artist

            if title:
                video_entry["title"] = title

            if genre:
                video_entry["genre"] = genre

            # Update processed timestamp
            video_entry["processed_at"] = subprocess.run(
                ["date", "-u", "+%Y-%m-%dT%H:%M:%SZ"], capture_output=True, text=True
            ).stdout.strip()

    # Download cover if missing
    if not get_existing_cover(base_name):
        cover_filename = download_cover(base_name, base_name)
        if cover_filename and cover_filename != f"{base_name}.jpg":
            video_entry["cover_filename"] = cover_filename

    return video_entry, extra_metadata


def extract_song_info(
    metadata: Dict,
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Extract artist, title, and genre from spotdl metadata."""
    artist = artist_name = metadata.get("artist", None)
    title = metadata.get("name", None)
    genres = metadata["genres"]

    return artist, title, genres


def process_video_file(video_path: Path) -> Optional[Dict]:
    """Process a single video file."""
    base_name = video_path.stem
    logger.debug(f"Processing: {video_path.name}")

    # Get metadata from spotdl
    extra_metadata = get_spotdl_metadata(base_name)
    if not extra_metadata:
        logger.warning(f"Skipping {video_path.name} - no metadata available")
        return None

    # Extract song information
    artist, title, genre = extract_song_info(extra_metadata)

    logger.info(
        f"→ Artist: '{artist or 'N/A'}', Title: '{title or 'N/A'}'"
        + (f", Genre: '{genre}'" if genre else "")
    )

    # Download cover
    cover_filename = download_cover(base_name, base_name)

    # Get video duration
    duration = get_video_duration(video_path)

    # Build video entry for videos.json
    video_entry = {"filename": base_name}

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
        ["date", "-u", "+%Y-%m-%dT%H:%M:%SZ"], capture_output=True, text=True
    ).stdout.strip()

    return {
        "video_entry": video_entry,
        "extra_metadata": extra_metadata,
        "base_name": base_name,
    }


def process_video_file_offline(video_path: Path) -> Dict:
    """Process a single video file without internet - just filename and duration."""
    base_name = video_path.stem
    logger.info(f"Processing offline: {video_path.name}")

    # Get video duration
    duration = get_video_duration(video_path)

    # Build minimal video entry for videos.json
    video_entry = {"filename": base_name}

    # Add optional fields
    if video_path.name != f"{base_name}.mp4":
        video_entry["video_filename"] = video_path.name

    if duration:
        video_entry["duration_seconds"] = round(duration, 2)

    video_entry["processed_at"] = subprocess.run(
        ["date", "-u", "+%Y-%m-%dT%H:%M:%SZ"], capture_output=True, text=True
    ).stdout.strip()

    return {"video_entry": video_entry, "base_name": base_name}


def main():
    parser = argparse.ArgumentParser(
        description="Update song metadata and covers using spotdl"
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Enable verbose output"
    )
    parser.add_argument(
        "--no-internet",
        action="store_true",
        help="Skip network operations - only add filename and duration of videos",
    )
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Check internet connectivity unless explicitly running in offline mode
    has_internet = True
    if not args.no_internet:
        has_internet = check_internet_connection()
        if not has_internet:
            logger.warning("⚠️  No internet connection detected!")
            logger.warning(
                "💡 Consider using '--no-internet' flag to add videos with filename and "
                "duration only"
            )
            return 1
    else:
        logger.info("Running in offline mode - skipping network operations")

    # Load existing data
    videos_list, extra_metadata_data = load_existing_data()

    # Get video files from filesystem
    video_files = get_video_files()
    if not video_files:
        logger.error("No video files found!")
        return 1

    # Create covers directory
    if not args.no_internet:
        Path(COVERS_DIR).mkdir(exist_ok=True)

    # Build a map of existing video entries by filename
    videos_map = {entry["filename"]: entry for entry in videos_list}

    if len(videos_map) < len(videos_list):
        raise ValueError(
            "some videos have the same base name but different ending, this is not supported"
        )

    # Process each video file
    processed_count = 0
    updated_count = 0
    cover_downloaded_count = 0

    try:
        for video_path in video_files:
            base_name = video_path.stem

            # Check if video entry already exists
            if base_name in videos_map:
                video_entry = videos_map[base_name]

                # Check if update is needed (skip updates in offline mode)
                needs_updating, reasons = needs_update(video_entry, args.no_internet)

                if needs_updating:
                    logger.info(f"Updating {base_name}: {', '.join(reasons)}")
                    updated_entry, new_extra_metadata = update_video_entry(
                        video_entry, video_path
                    )

                    if updated_entry:
                        # Update the entry in our data
                        videos_map[base_name] = updated_entry
                        if new_extra_metadata:
                            extra_metadata_data[base_name] = new_extra_metadata
                        updated_count += 1
                else:
                    logger.debug(f"✓ {base_name} is up to date")
            else:
                # New video file - process it
                logger.info(f"New video found: {base_name}")

                if args.no_internet:
                    # Process without network operations
                    result = process_video_file_offline(video_path)
                    if result:
                        videos_map[base_name] = result["video_entry"]
                        processed_count += 1
                else:
                    # Process with full metadata and cover download
                    result = process_video_file(video_path)
                    if result:
                        videos_map[base_name] = result["video_entry"]
                        extra_metadata_data[base_name] = result["extra_metadata"]
                        processed_count += 1

            # Save after every new video for resume capability
            save_json_files(videos_map, extra_metadata_data)

            # Count covers that exist (only if not in offline mode)
            if not args.no_internet and get_existing_cover(base_name):
                cover_downloaded_count += 1

    finally:
        save_json_files(videos_map, extra_metadata_data)

    logger.info(f"Videos processed: {processed_count} new, {updated_count} updated")
    logger.info(f"Covers available: {cover_downloaded_count}")
    logger.info(f"JSON files saved: {OUTPUT_JSON}, {EXTRA_METADATA_JSON}")

    return 0


if __name__ == "__main__":
    exit(main())
