# Karaoke Metadata System

## Überblick

Das erweiterte Metadata-System speichert Informationen über heruntergeladene Songs in einem strukturierten Format und ermöglicht eine bessere Darstellung mit "Artist - Title" Format.

## Neue Dateistruktur

```
karaoke-videoplayer/
├── videos/                  # MP4 Video-Dateien
├── covers/                  # Cover-Bilder (JPG)
├── metadata/                # Metadaten-Dateien (.spotdl)
├── videos.json              # JSON-Format mit Artist/Title
└── download-song-data.sh    # Script zum Download der Song-Daten
```

## videos.json Format

```json
[
  {
    "filename": "99 Luftballons - Nena",
    "artist": "Nena",
    "title": "99 Luftballons"
  }
]
```

**Vorteile:**
- `filename`: Basis für automatische Pfad-Generierung
- `artist` und `title`: Separate Felder für bessere Darstellung
- `file` und `cover` werden automatisch generiert als `videos/{filename}.mp4` und `covers/{filename}.jpg`

## Metadaten-Dateien (.spotdl)

Jede `.spotdl` Datei im `metadata/` Ordner enthält erweiterte Informationen:

```json
{
  "filename": "99 Luftballons - Nena",
  "artist": "Nena",
  "title": "99 Luftballons",
  "duration": "3:52",
  "downloaded_at": "2025-07-27T10:30:00Z",
  "file_size_mb": 9.2
}
```

## Verwendung

### 1. Nach spot-dl Download

Nach dem Download mit spot-dl das Script ausführen:

```bash
./download-song-data.sh
```

Das Script:
- Analysiert alle MP4-Dateien im `videos/` Ordner
- Extrahiert Artist und Title aus den Dateinamen
- Erstellt `videos.json` mit dem neuen Format
- Generiert `.spotdl` Metadaten-Dateien
- Lädt Cover-Bilder herunter

### 2. Manuelle Bearbeitung

Die `videos.json` kann manuell bearbeitet werden, um:
- Artist/Title Zuordnungen zu korrigieren
- Fehlende Informationen zu ergänzen

### 3. Anzeige im Karaoke-Player

- Songs werden als "Artist - Title" angezeigt
- Suche funktioniert über Artist und Title
- Datei-Pfade werden automatisch generiert

## Filename-Parsing

Das Skript versucht verschiedene Formate zu erkennen:

1. **"Artist - Title"** → Artist: "Artist", Title: "Title"
2. **"Title Artist"** → Artist: "Artist", Title: "Title" 
3. **Fallback** → Artist: "", Title: "Gesamter Filename"

## Integration mit spot-dl

Für die beste Integration sollte spot-dl so konfiguriert werden, dass Dateien im Format "Artist - Title" benannt werden. Das kann über die spot-dl Konfiguration erreicht werden.

## Migration von altem Format

Das alte `videos.json` Format wird durch das neue Format mit separaten `artist` und `title` Feldern ersetzt. Die Anwendung lädt automatisch das neue Format.
