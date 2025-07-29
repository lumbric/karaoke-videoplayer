#!/bin/bash

# Download Song Data Script
# Uses spotdl to retrieve accurate metadata and cover art for karaoke videos
# Run this after downloading videos with spot-dl or adding new video files

# Configuration
VIDEOS_DIR="videos"
COVERS_DIR="covers"
OUTPUT_JSON="videos.json"
METADATA_JSON="metadata.json"
COVER_FORMATS=("jpg" "jpeg" "png" "webp")
VIDEO_FORMATS=("mp4" "avi" "mkv" "mov" "webm" "flv" "m4v")

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

# Function to get metadata from spotdl
get_spotdl_metadata() {
    local filename="$1"
    local search_query="$2"
    
    print_status "Getting metadata for: $search_query"
    
    # Create temporary file for spotdl metadata
    local temp_file=$(mktemp)
    
    if command_exists spotdl; then
        # Use spotdl to save metadata
        if spotdl save "$search_query" --save-file "$temp_file" >/dev/null 2>&1; then
            if [[ -f "$temp_file" ]]; then
                print_success "Retrieved spotdl metadata for: $search_query"
                cat "$temp_file"
                rm -f "$temp_file"
                return 0
            fi
        fi
    fi
    
    # Fallback: create basic metadata structure
    print_warning "Could not retrieve spotdl metadata for: $search_query"
    rm -f "$temp_file"
    
    # Parse basic artist and title from filename as fallback
    local artist_title=$(parse_artist_title_fallback "$filename")
    local artist="${artist_title%|*}"
    local title="${artist_title#*|}"
    
    # Create minimal JSON structure
    cat << EOF
{
  "name": "$title",
  "artists": [{"name": "$artist"}],
  "album": {"name": "Unknown Album"},
  "duration_ms": 0,
  "explicit": false,
  "external_urls": {},
  "genres": [],
  "popularity": 0,
  "preview_url": null,
  "track_number": 1,
  "disc_number": 1,
  "lyrics": null,
  "copyright_text": null,
  "isrc": null,
  "release_date": "1900-01-01",
  "images": []
}
EOF
    return 1
}

# Function to parse artist and title from filename (fallback)
parse_artist_title_fallback() {
    local filename="$1"
    local artist=""
    local title=""
    
    # Try different patterns
    if [[ "$filename" =~ ^(.+)\ -\ (.+)$ ]]; then
        # "Artist - Title" format
        artist="${BASH_REMATCH[1]}"
        title="${BASH_REMATCH[2]}"
    elif [[ "$filename" =~ ^(.+)\ (.+)$ ]]; then
        # "Title Artist" format - last word as artist
        words=($filename)
        artist="${words[-1]}"
        title="${words[@]:0:${#words[@]}-1}"
        title="${title// / }"
    else
        # Fallback: use filename as title
        artist="Unknown Artist"
        title="$filename"
    fi
    
    echo "$artist|$title"
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

# Function to download cover art from spotdl metadata or fallback sources
download_cover() {
    local video_file="$1"
    local cover_base="$2"
    local metadata="$3"
    local search_query="$4"
    
    # Check if cover already exists
    for ext in "${COVER_FORMATS[@]}"; do
        if [[ -f "$COVERS_DIR/$cover_base.$ext" ]]; then
            print_success "Cover already exists: $COVERS_DIR/$cover_base.$ext"
            return 0
        fi
    done
    
    print_status "Downloading cover for: $search_query"
    
    # Try to extract cover URL from spotdl metadata
    if command_exists jq && [[ -n "$metadata" ]]; then
        local cover_url=$(echo "$metadata" | jq -r '.album.images[0].url // .images[0].url // empty' 2>/dev/null)
        if [[ -n "$cover_url" && "$cover_url" != "null" ]]; then
            if curl -s -L "$cover_url" -o "$COVERS_DIR/$cover_base.jpg" >/dev/null 2>&1; then
                print_success "Downloaded cover via spotdl metadata"
                return 0
            fi
        fi
    fi
    
    # Fallback to yt-dlp
    if command_exists yt-dlp; then
        print_status "Trying yt-dlp fallback..."
        local search_result=$(yt-dlp "ytsearch1:$search_query" --get-thumbnail --no-download 2>/dev/null | head -1)
        if [[ -n "$search_result" && "$search_result" != "NA" ]]; then
            if curl -s -L "$search_result" -o "$COVERS_DIR/$cover_base.jpg" >/dev/null 2>&1; then
                print_success "Downloaded cover via yt-dlp"
                return 0
            fi
        fi
    fi
    
    # Fallback to youtube-dl
    if command_exists youtube-dl; then
        print_status "Trying youtube-dl fallback..."
        local search_result=$(youtube-dl "ytsearch1:$search_query" --get-thumbnail --no-download 2>/dev/null | head -1)
        if [[ -n "$search_result" && "$search_result" != "NA" ]]; then
            if curl -s -L "$search_result" -o "$COVERS_DIR/$cover_base.jpg" >/dev/null 2>&1; then
                print_success "Downloaded cover via youtube-dl"
                return 0
            fi
        fi
    fi
    
    print_warning "Could not download cover for: $search_query"
    return 1
}

# Function to find existing cover with different extensions
find_cover() {
    local base="$1"
    for ext in "${COVER_FORMATS[@]}"; do
        if [[ -f "$COVERS_DIR/$base.$ext" ]]; then
            echo "$base.$ext"
            return 0
        fi
    done
    echo ""
}

# Function to find video file with different extensions
find_video_file() {
    local base="$1"
    for ext in "${VIDEO_FORMATS[@]}"; do
        if [[ -f "$VIDEOS_DIR/$base.$ext" ]]; then
            echo "$base.$ext"
            return 0
        fi
    done
    echo ""
}

# Function to get video duration using ffprobe
get_video_duration() {
    local video_file="$1"
    if command_exists ffprobe; then
        local duration=$(ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$video_file" 2>/dev/null)
        if [[ -n "$duration" && "$duration" != "N/A" ]]; then
            echo "$duration"
            return 0
        fi
    fi
    echo "0"
}

# Main function
main() {
    print_status "Starting Download Song Data Script..."
    
    # Check if videos directory exists
    if [[ ! -d "$VIDEOS_DIR" ]]; then
        print_error "Videos directory '$VIDEOS_DIR' not found!"
        exit 1
    fi
    
    # Create necessary directories
    mkdir -p "$COVERS_DIR"
    
    # Check for required tools
    if ! command_exists curl; then
        print_error "curl is required but not installed!"
        exit 1
    fi
    
    # Check for spotdl (recommended)
    if ! command_exists spotdl; then
        print_warning "spotdl not found. Install with: pip install spotdl"
        print_warning "Falling back to basic filename parsing."
    fi
    
    # Check for optional tools
    if ! command_exists jq; then
        print_warning "jq not found. Install for better JSON processing: apt install jq"
    fi
    
    # Initialize metadata.json and videos.json
    print_status "Initializing JSON files..."
    echo "{}" > "$METADATA_JSON"
    echo "[" > "$OUTPUT_JSON"
    
    local first=true
    local video_count=0
    local cover_downloaded=0
    local metadata_retrieved=0
    
    # Create temporary file for metadata collection
    local temp_metadata=$(mktemp)
    echo "{" > "$temp_metadata"
    local first_metadata=true
    
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
        
        # Get metadata from spotdl
        local metadata=$(get_spotdl_metadata "$base" "$clean_title")
        local metadata_success=$?
        
        if [[ $metadata_success -eq 0 ]]; then
            ((metadata_retrieved++))
        fi
        
        # Extract info from metadata using jq or fallback
        local artist=""
        local title=""
        local genre=""
        local duration_ms=0
        
        if command_exists jq && [[ -n "$metadata" ]]; then
            artist=$(echo "$metadata" | jq -r '.artists[0].name // "Unknown Artist"' 2>/dev/null)
            title=$(echo "$metadata" | jq -r '.name // "Unknown Title"' 2>/dev/null)
            genre=$(echo "$metadata" | jq -r '.genres[0] // ""' 2>/dev/null)
            duration_ms=$(echo "$metadata" | jq -r '.duration_ms // 0' 2>/dev/null)
        else
            # Fallback parsing
            local artist_title=$(parse_artist_title_fallback "$base")
            artist="${artist_title%|*}"
            title="${artist_title#*|}"
        fi
        
        print_success "→ Artist: '$artist', Title: '$title'$([ -n "$genre" ] && echo ", Genre: '$genre'")"
        
        # Store full metadata
        if [[ "$first_metadata" == true ]]; then
            first_metadata=false
        else
            echo "," >> "$temp_metadata"
        fi
        echo "  \"$base\": $metadata" >> "$temp_metadata"
        
        # Try to download cover art
        if download_cover "$file" "$base" "$metadata" "$clean_title"; then
            ((cover_downloaded++))
        fi
        
        # Find the actual video and cover files (with extensions)
        local video_filename="$filename"
        local cover_filename=$(find_cover "$base")
        
        # Get video duration
        local video_duration=$(get_video_duration "$file")
        
        # Add comma if not first entry in videos.json
        if [[ "$first" == true ]]; then
            first=false
        else
            echo "," >> "$OUTPUT_JSON"
        fi
        
        # Write JSON entry with enhanced metadata
        echo "  {" >> "$OUTPUT_JSON"
        echo "    \"filename\": \"${base//\"/\\\"}\"," >> "$OUTPUT_JSON"
        echo "    \"artist\": \"${artist//\"/\\\"}\"," >> "$OUTPUT_JSON"
        echo "    \"title\": \"${title//\"/\\\"}\"," >> "$OUTPUT_JSON"
        
        # Optional fields
        if [[ -n "$genre" && "$genre" != "null" && "$genre" != "" ]]; then
            echo "    \"genre\": \"${genre//\"/\\\"}\"," >> "$OUTPUT_JSON"
        fi
        
        if [[ "$video_filename" != "$base.mp4" ]]; then
            echo "    \"video_filename\": \"${video_filename//\"/\\\"}\"," >> "$OUTPUT_JSON"
        fi
        
        if [[ -n "$cover_filename" && "$cover_filename" != "$base.jpg" ]]; then
            echo "    \"cover_filename\": \"${cover_filename//\"/\\\"}\"," >> "$OUTPUT_JSON"
        fi
        
        if [[ "$video_duration" != "0" ]]; then
            echo "    \"duration_seconds\": $video_duration," >> "$OUTPUT_JSON"
        fi
        
        if [[ "$duration_ms" != "0" ]]; then
            echo "    \"duration_ms\": $duration_ms," >> "$OUTPUT_JSON"
        fi
        
        # Remove trailing comma from last field
        echo "    \"processed_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" >> "$OUTPUT_JSON"
        echo -n "  }" >> "$OUTPUT_JSON"
        
        ((video_count++))
    done
    
    # Close JSON files
    echo "" >> "$OUTPUT_JSON"
    echo "]" >> "$OUTPUT_JSON"
    
    echo "" >> "$temp_metadata"
    echo "}" >> "$temp_metadata"
    
    # Move temporary metadata to final location
    mv "$temp_metadata" "$METADATA_JSON"
    
    # Print summary
    print_success "Finished processing!"
    print_status "Videos processed: $video_count"
    print_status "Metadata retrieved: $metadata_retrieved"
    print_status "Covers downloaded: $cover_downloaded"
    print_status "JSON files created: $OUTPUT_JSON, $METADATA_JSON"
    
    if [[ $video_count -eq 0 ]]; then
        print_warning "No video files found in $VIDEOS_DIR"
    fi
    
    if [[ $metadata_retrieved -lt $video_count ]]; then
        print_warning "Consider installing spotdl for better metadata: pip install spotdl"
    fi
}

# Show help
show_help() {
    echo "Download Song Data Script (Enhanced with SpotDL)"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -v, --verbose  Enable verbose output"
    echo ""
    echo "This script will:"
    echo "  1. Scan the 'videos' directory for video files"
    echo "  2. Use spotdl to retrieve accurate artist, title, and metadata"
    echo "  3. Generate videos.json with enhanced metadata (including genre if available)"
    echo "  4. Create metadata.json with complete spotdl metadata (lyrics, etc.)"
    echo "  5. Download cover art from spotdl or fallback sources"
    echo ""
    echo "Generated files:"
    echo "  - videos.json     (main video catalog with artist/title/genre)"
    echo "  - metadata.json   (complete spotdl metadata by filename)"
    echo ""
    echo "Required directories:"
    echo "  - videos/         (must exist, contains video files)"
    echo "  - covers/         (created automatically)"
    echo ""
    echo "Required tools:"
    echo "  - curl            (for downloading covers)"
    echo ""
    echo "Recommended tools:"
    echo "  - spotdl          (pip install spotdl) - for accurate metadata"
    echo "  - jq              (apt install jq) - for JSON processing"
    echo "  - ffprobe         (apt install ffmpeg) - for video duration"
    echo ""
    echo "Fallback tools (for cover download):"
    echo "  - yt-dlp          (pip install yt-dlp)"
    echo "  - youtube-dl      (pip install youtube-dl)"
    echo ""
    echo "Enhanced features:"
    echo "  - Uses spotdl to search and retrieve accurate metadata"
    echo "  - Supports optional video_filename and cover_filename fields"
    echo "  - Includes genre information when available"
    echo "  - Complete metadata storage in metadata.json"
    echo "  - Support for various video and image formats"
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
