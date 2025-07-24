#!/bin/bash

# Karaoke Video Data Generator
# Generates videos.json, downloads cover art, and stores spotdl metadata

# Note: Not using 'set -e' because download failures shouldn't stop the entire process

# Configuration
VIDEOS_DIR="videos"
COVERS_DIR="covers"
METADATA_DIR="metadata"
OUTPUT_JSON="videos.json"
COVER_FORMATS=("jpg" "jpeg" "png" "webp")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to clean filename for search
clean_filename() {
    local filename="$1"
    # Remove file extension
    filename="${filename%.*}"
    # Replace underscores and hyphens with spaces
    filename="${filename//_/ }"
    filename="${filename//-/ }"
    # Remove common video quality indicators
    filename=$(echo "$filename" | sed -E 's/\b(720p|1080p|4k|hd|HD|mp4|MP4)\b//g')
    # Clean up extra spaces
    filename=$(echo "$filename" | sed 's/[[:space:]]\+/ /g' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    echo "$filename"
}

# Function to download cover art using available tools
download_cover() {
    local video_file="$1"
    local cover_base="$2"
    local search_query="$3"
    
    # Check if cover already exists
    for ext in "${COVER_FORMATS[@]}"; do
        if [[ -f "$COVERS_DIR/$cover_base.$ext" ]]; then
            print_success "Cover already exists: $COVERS_DIR/$cover_base.$ext"
            return 0
        fi
    done
    
    print_status "Downloading cover for: $search_query"
    
    # Try with spotdl first (if available) - this is the preferred method
    if command_exists spotdl; then
        print_status "Trying spotdl..."
        local metadata_file="$METADATA_DIR/$cover_base.spotdl"
        mkdir -p "$METADATA_DIR"
        
        # Use spotdl to search and save metadata
        if spotdl save "$search_query" --output "$metadata_file" --format json >/dev/null 2>&1; then
            print_success "Saved spotdl metadata: $metadata_file"
            
            # Try to extract cover URL from metadata and download
            if command_exists jq && [[ -f "$metadata_file" ]]; then
                local cover_url=$(jq -r '.album.images[0].url // .track.album.images[0].url // empty' "$metadata_file" 2>/dev/null)
                if [[ -n "$cover_url" && "$cover_url" != "null" ]]; then
                    if curl -s -L "$cover_url" -o "$COVERS_DIR/$cover_base.jpg" >/dev/null 2>&1; then
                        print_success "Downloaded cover via spotdl"
                        return 0
                    fi
                fi
            fi
        else
            print_warning "spotdl could not find: $search_query"
        fi
    fi
    
    # Try with yt-dlp only if spotdl failed
    if command_exists yt-dlp; then
        print_status "Trying yt-dlp..."
        local search_result=$(yt-dlp "ytsearch1:$search_query" --get-thumbnail --no-download 2>/dev/null | head -1)
        if [[ -n "$search_result" && "$search_result" != "NA" ]]; then
            if curl -s -L "$search_result" -o "$COVERS_DIR/$cover_base.jpg" >/dev/null 2>&1; then
                print_success "Downloaded cover via yt-dlp"
                return 0
            fi
        else
            print_warning "yt-dlp could not find: $search_query"
        fi
    fi
    
    # Try with youtube-dl only if both spotdl and yt-dlp failed
    if command_exists youtube-dl; then
        print_status "Trying youtube-dl..."
        local search_result=$(youtube-dl "ytsearch1:$search_query" --get-thumbnail --no-download 2>/dev/null | head -1)
        if [[ -n "$search_result" && "$search_result" != "NA" ]]; then
            if curl -s -L "$search_result" -o "$COVERS_DIR/$cover_base.jpg" >/dev/null 2>&1; then
                print_success "Downloaded cover via youtube-dl"
                return 0
            fi
        else
            print_warning "youtube-dl could not find: $search_query"
        fi
    fi
    
    print_warning "Could not download cover for: $search_query"
    return 1
}

# Function to find existing cover
find_cover() {
    local base="$1"
    for ext in "${COVER_FORMATS[@]}"; do
        if [[ -f "$COVERS_DIR/$base.$ext" ]]; then
            echo "$COVERS_DIR/$base.$ext"
            return 0
        fi
    done
    echo ""
}

# Main function
main() {
    print_status "Starting Karaoke Video Data Generator..."
    
    # Check if videos directory exists
    if [[ ! -d "$VIDEOS_DIR" ]]; then
        print_error "Videos directory '$VIDEOS_DIR' not found!"
        exit 1
    fi
    
    # Create necessary directories
    mkdir -p "$COVERS_DIR"
    mkdir -p "$METADATA_DIR"
    
    # Check for required tools
    if ! command_exists curl; then
        print_error "curl is required but not installed!"
        exit 1
    fi
    
    # Check for optional tools
    if ! command_exists spotdl && ! command_exists yt-dlp && ! command_exists youtube-dl; then
        print_warning "No download tools found (spotdl, yt-dlp, youtube-dl). Cover download will be skipped."
    fi
    
    # Start generating JSON
    print_status "Generating $OUTPUT_JSON..."
    echo "[" > "$OUTPUT_JSON"
    
    local first=true
    local video_count=0
    local cover_downloaded=0
    
    # Process each video file
    for file in "$VIDEOS_DIR"/*; do
        # Skip if not a file or if it's a hidden file
        [[ -f "$file" ]] || continue
        [[ "$(basename "$file")" =~ ^\. ]] && continue
        
        # Check if it's a video file
        local ext="${file##*.}"
        if [[ ! "$ext" =~ ^(mp4|avi|mkv|mov|webm|flv|m4v)$ ]]; then
            continue
        fi
        
        local filename=$(basename "$file")
        local base="${filename%.*}"
        local clean_title=$(clean_filename "$filename")
        
        print_status "Processing: $filename"
        
        # Try to download cover art
        if download_cover "$file" "$base" "$clean_title"; then
            ((cover_downloaded++))
        fi
        
        # Find the best available cover
        local cover_path=$(find_cover "$base")
        if [[ -z "$cover_path" ]]; then
            cover_path=""
        fi
        
        # Add comma if not first entry
        if [[ "$first" == true ]]; then
            first=false
        else
            echo "," >> "$OUTPUT_JSON"
        fi
        
        # Write JSON entry
        echo "  {" >> "$OUTPUT_JSON"
        echo "    \"title\": \"${clean_title//\"/\\\"}\"," >> "$OUTPUT_JSON"
        echo "    \"file\": \"$file\"," >> "$OUTPUT_JSON"
        echo "    \"cover\": \"$cover_path\"" >> "$OUTPUT_JSON"
        echo -n "  }" >> "$OUTPUT_JSON"
        
        ((video_count++))
    done
    
    # Close JSON array
    echo "" >> "$OUTPUT_JSON"
    echo "]" >> "$OUTPUT_JSON"
    
    # Print summary
    print_success "Finished processing!"
    print_status "Videos processed: $video_count"
    print_status "Covers downloaded: $cover_downloaded"
    print_status "JSON file created: $OUTPUT_JSON"
    
    if [[ $video_count -eq 0 ]]; then
        print_warning "No video files found in $VIDEOS_DIR"
    fi
}

# Show help
show_help() {
    echo "Karaoke Video Data Generator"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -v, --verbose  Enable verbose output"
    echo ""
    echo "This script will:"
    echo "  1. Scan the 'videos' directory for video files"
    echo "  2. Generate a videos.json file with metadata"
    echo "  3. Download cover art for each video (if tools available)"
    echo "  4. Store spotdl metadata in 'metadata' directory"
    echo ""
    echo "Required directories:"
    echo "  - videos/     (must exist, contains video files)"
    echo "  - covers/     (created automatically)"
    echo "  - metadata/   (created automatically)"
    echo ""
    echo "Optional tools for cover download:"
    echo "  - spotdl      (preferred)"
    echo "  - yt-dlp      (fallback)"
    echo "  - youtube-dl  (fallback)"
    echo "  - jq          (for JSON parsing)"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--verbose)
            set -x
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run main function
main