#!/usr/bin/env bash
set -euo pipefail

# Syncs runtime data symlinks for local/dev and dist:
#   public/data/{videos,covers,songs.json,extra_metadata.json} -> ../../data/*
#   dist/data/{videos,covers,songs.json,extra_metadata.json} -> ../../data/* (if dist exists)
#
# Behavior:
# - Creates missing symlinks
# - Fails if target path exists as non-symlink
# - Fails if existing symlink points to a different target

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$ROOT_DIR/data"
mkdir -p "$DATA_DIR/videos" "$DATA_DIR/covers"

link_path() {
  local target="$1"
  local link_path="$2"

  mkdir -p "$(dirname "$link_path")"

  if [[ -L "$link_path" ]]; then
    local current_target
    current_target="$(readlink "$link_path")"
    if [[ "$current_target" == "$target" ]]; then
      echo "Already linked: $link_path -> $target"
      return 0
    fi

    echo "Error: existing symlink points elsewhere: $link_path -> $current_target"
    exit 1
  fi

  if [[ -e "$link_path" ]]; then
    echo "Error: path already exists and is not a symlink: $link_path"
    exit 1
  fi

  ln -s "$target" "$link_path"
  echo "Linked: $link_path -> $target"
}

link_path "../../data/videos" "$ROOT_DIR/public/data/videos"
link_path "../../data/covers" "$ROOT_DIR/public/data/covers"
link_path "../../data/songs.json" "$ROOT_DIR/public/data/songs.json"
link_path "../../data/extra_metadata.json" "$ROOT_DIR/public/data/extra_metadata.json"

if [[ -d "$ROOT_DIR/dist" ]]; then
  link_path "../../data/videos" "$ROOT_DIR/dist/data/videos"
  link_path "../../data/covers" "$ROOT_DIR/dist/data/covers"
  link_path "../../data/songs.json" "$ROOT_DIR/dist/data/songs.json"
  link_path "../../data/extra_metadata.json" "$ROOT_DIR/dist/data/extra_metadata.json"
fi
