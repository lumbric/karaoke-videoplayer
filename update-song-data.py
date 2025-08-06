#!/usr/bin/env python3
"""
Update Song Data

This script generates or updates the videos.json file according to the files in the videos folder
and downloads cover images and metadata using spotdl for the song (if a network connection is
available).

"""

import os
import sys
import time
import json
import socket
import imghdr
import logging
import subprocess
import tempfile
import argparse
import requests
import logging.config
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Configuration
VIDEOS_DIR = "videos"
COVERS_DIR = "covers"
OUTPUT_JSON = "videos.json"
EXTRA_METADATA_JSON = "extra_metadata.json"

# FIXME this is probably not necessary
VIDEO_EXTENSIONS = [".mp4", ".avi", ".mkv", ".mov", ".webm", ".flv", ".m4v"]

LOG_FILE = "update-song-data.log"


def log_exception(type_, value, traceback):
    logging.error("Uncaught exception:", exc_info=(type_, value, traceback))


def setup_logging(fname=LOG_FILE):
    sys.excepthook = log_exception

    NO_COLOR = "\33[m"
    RED, GREEN, ORANGE, BLUE, PURPLE, LBLUE, GREY = map("\33[%dm".__mod__, range(31, 38))

    logging_config = {
        "version": 1,
        "disable_existing_loggings": False,
        "formatters": {
            "default": {"format": "[%(asctime)s] %(levelname)-4s - %(message)s"},
            "color": {
                "format": "{}[%(asctime)s]{} {}%(levelname)-5s{}: %(message)s".format(
                    ORANGE, NO_COLOR, PURPLE, NO_COLOR
                )
            },
        },
        "handlers": {
            "stream": {
                "class": "logging.StreamHandler",
                "formatter": "color",
            }
        },
        "root": {
            "handlers": ["stream"],
            "level": logging.INFO,
        },
    }
    if fname is not None:
        logging_config["handlers"]["file"] = {
            "class": "logging.FileHandler",
            "formatter": "default",
            "level": logging.DEBUG,
            "filename": fname,
        }
        logging_config["root"]["handlers"].append("file")

    logging.config.dictConfig(logging_config)


def check_internet_connection() -> bool:
    """Check if internet connection is available."""
    try:
        # Try to connect to a reliable DNS server
        socket.create_connection(("8.8.8.8", 53), timeout=5)
        return True
    except (socket.timeout, socket.error):
        return False


def save_json_files(video_data, extra_metadata):
    """Save current videos and extra metadata to JSON files."""
    videos_data = list(video_data.values())
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(videos_data, f, indent=2, ensure_ascii=False)

    with open(EXTRA_METADATA_JSON, "w", encoding="utf-8") as f:
        json.dump(extra_metadata, f, indent=2, ensure_ascii=False)


def load_existing_data() -> Tuple[List[Dict], Dict]:
    """Load existing videos.json and extra_metadata.json files."""
    existing_videos = []
    existing_extra_metadata = {}

    if os.path.exists(OUTPUT_JSON):
        with open(OUTPUT_JSON, "r", encoding="utf-8") as f:
            existing_videos = json.load(f)
        logging.info(f"✓ Loaded {len(existing_videos)} existing video entries")

    if os.path.exists(EXTRA_METADATA_JSON):
        with open(EXTRA_METADATA_JSON, "r", encoding="utf-8") as f:
            existing_extra_metadata = json.load(f)
        logging.info(f"✓ Loaded extra metadata for {len(existing_extra_metadata)} videos")

    return existing_videos, existing_extra_metadata


def get_video_files() -> List[Path]:
    """Get all video files from the videos directory."""
    videos_path = Path(VIDEOS_DIR)
    video_files = []
    for ext in VIDEO_EXTENSIONS:
        video_files.extend(videos_path.glob(f"*{ext}"))

    logging.info(f"Found {len(video_files)} video files")

    return video_files


def download_cover(base_name: str, cover_url: str) -> Optional[str]:
    """Download cover art from the given URL if it does not already exist."""
    full_path = Path(COVERS_DIR) / f"{base_name}.jpg"
    if os.path.exists(full_path):
        logging.info(f"Skipping download of cover {base_name} - already exists.")
        return str(full_path), False

    # Create covers directory if it doesn't exist
    Path(COVERS_DIR).mkdir(exist_ok=True)

    logging.info(f"Downloading cover for: {base_name}...")
    response = requests.get(cover_url)
    response.raise_for_status()

    # Detect the image type (e.g., 'jpeg', 'png')
    ext = imghdr.what(None, h=response.content)
    if not ext:
        raise ValueError("Could not detect image type for: {cover_url}")

    # Map 'jpeg' to 'jpg' for common file extension
    ext = "jpg" if ext == "jpeg" else ext

    if ext != "jpg":
        raise NotImplementedError("Cover art is not in JPG format, currently not supported")

    with open(full_path, "wb") as f:
        f.write(response.content)

    logging.info(f"✓ Downloaded cover: {full_path}")

    return str(full_path), True


def get_spotdl_metadata(search_query: str) -> Optional[Dict]:
    """Get metadata from spotdl."""
    logging.info(f'Getting metadata for: "{search_query}"')

    try:
        with tempfile.NamedTemporaryFile(mode="w+", suffix=".spotdl", delete=False) as temp_file:
            temp_path = temp_file.name
            temp_file.close()

            # Use spotdl to get metadata
            result = subprocess.run(
                ["spotdl", "save", search_query, "--save-file", temp_path],
                capture_output=False,
                text=True,
                timeout=150,
            )

            # Log explicit error output
            if result.returncode != 0:
                logging.warning(
                    f"✗ spotdl failed for metadata '{search_query}' (exit code {result.returncode})"
                )
                if result.stdout.strip():
                    logging.warning(f"  STDOUT: {result.stdout.strip()}")
                if result.stderr.strip():
                    logging.warning(f"  STDERR: {result.stderr.strip()}")

                # Clean up temp file if it exists
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                return None

            if result.returncode == 0 and os.path.exists(temp_path):
                with open(temp_path, "r", encoding="utf-8") as f:
                    metadata = json.load(f)

    except subprocess.TimeoutExpired:
        logging.warning(f"✗ Timeout getting metadata for: {search_query}")
        return None

    except Exception as e:
        logging.warning(f"✗ Error getting metadata for {search_query}: {e}")
        return None

    if len(metadata) != 1:
        raise ValueError("unexpected length of metadata:", len(metadata))

    metadata = metadata[0]

    if metadata:  # Check if metadata is not empty
        logging.info(f"✓ Retrieved metadata for: {search_query}")
        return metadata


def get_video_duration(video_path: Path) -> Optional[float]:
    """Get video duration using ffprobe."""
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
        check=True,
        text=True,
    )

    if result.stdout.strip():
        return float(result.stdout.strip())
    else:
        raise ValueError(f"Could not retrieve duration of video {video_path} using ffprobe")


def process_video_file(
    video_path: Path,
    base_name: str,
    video_entry: dict = None,
    extra_metadata_entry: dict = None,
    no_internet: bool = False,
) -> Optional[Dict]:
    """Process a single video file.

    Note: This will edit the parameter video_entry!

    """
    t0 = time.time()

    video_entry = {k: v for k, v in video_entry.items()} if video_entry else {}

    result = {
        "cover_downloaded": False,
        "metadata_downloaded": False,
        "video_entry": video_entry,
    }

    # Build video entry for videos.json
    if "filename" not in video_entry:
        video_entry["filename"] = base_name

    # Get video duration
    if "duration_seconds" not in video_entry:
        duration = get_video_duration(video_path)
        video_entry["duration_seconds"] = round(duration, 2)

    if no_internet:
        return result

    logging.debug(f"Processing: {video_path.name}...")

    # Get metadata from spotdl
    if extra_metadata_entry is None:
        extra_metadata_entry = get_spotdl_metadata(base_name)

    if not extra_metadata_entry:
        logging.warning(f"Skipping {video_path.name} - no metadata available")
        return result

    result["metadata_downloaded"] = True

    # Extract song information
    artist = extra_metadata_entry.get("artist", None)
    title = extra_metadata_entry.get("name", None)
    genre = extra_metadata_entry["genres"]

    logging.info(f"Artist: '{artist}', Title: '{title}', Genre: '{genre}'")

    # Download cover
    cover_filename, cover_downloaded = download_cover(base_name, extra_metadata_entry["cover_url"])
    result["cover_downloaded"] = cover_downloaded

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

    video_entry["processed_at"] = subprocess.run(
        ["date", "-u", "+%Y-%m-%dT%H:%M:%SZ"], capture_output=True, text=True
    ).stdout.strip()

    logging.info(f"Total processing duration: {time.time() - t0}")

    result["extra_metadata_entry"] = extra_metadata_entry

    return result


def main():
    parser = argparse.ArgumentParser(description="Update song metadata and covers using spotdl")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose output")
    parser.add_argument(
        "--no-internet",
        action="store_true",
        help="Skip network operations - only add filename and duration of videos",
    )
    args = parser.parse_args()

    setup_logging()

    if args.verbose:
        logging.getlogging().setLevel(logging.DEBUG)

    # Check internet connectivity unless explicitly running in offline mode
    has_internet = True
    if not args.no_internet:
        has_internet = check_internet_connection()
        if not has_internet:
            logging.warning("⚠️  No internet connection detected!")
            logging.warning(
                "💡 Consider using '--no-internet' flag to add videos with filename and "
                "duration only"
            )
            return 1
    else:
        logging.info("Running in offline mode - skipping network operations")

    # Load existing data
    videos_list, extra_metadata = load_existing_data()

    # Get video files from file system
    video_files = get_video_files()
    if not video_files:
        logging.error("No video files found!")
        return 1

    # Create covers directory
    if not args.no_internet:
        Path(COVERS_DIR).mkdir(exist_ok=True)

    # Build a map of existing video entries by filename
    video_data = {entry["filename"]: entry for entry in videos_list}

    if len(video_data) < len(videos_list):
        raise ValueError(
            "some videos have the same base name but different ending, this is not supported"
        )

    # TODO check if all videos in video_data exist otherwise error!

    # Process each video file
    processed_count = 0
    metadata_downloaded_count = 0
    cover_downloaded_count = 0

    try:
        for video_path in video_files:
            logging.info(f"\n\n# # # Processing: {video_path.name} # # #")

            base_name = video_path.stem

            result = process_video_file(
                video_path,
                base_name,
                video_data.get(base_name),
                extra_metadata.get(base_name),
                args.no_internet,
            )

            cover_downloaded_count += result["cover_downloaded"]
            metadata_downloaded_count += result["metadata_downloaded"]

            video_data[base_name] = result["video_entry"]
            if "extra_metadata_entry" in result:
                extra_metadata[base_name] = result["extra_metadata_entry"]

            processed_count += 1

            # Save after every new video for resume capability
            save_json_files(video_data, extra_metadata)

    finally:
        save_json_files(video_data, extra_metadata)

        logging.info(f"Videos processed: {processed_count}")
        logging.info(f"Number of songs where metadata was retrieved: {metadata_downloaded_count}")
        logging.info(f"Covers downloaded: {cover_downloaded_count}")

        logging.info(f"JSON files saved: {OUTPUT_JSON}, {EXTRA_METADATA_JSON}")

    return 0


if __name__ == "__main__":
    exit(main())
