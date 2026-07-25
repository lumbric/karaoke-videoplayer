# Online Search & Video Playback - Setup-Guide

## Das Problem: CORS

Invidious-Instanzen (YouTube-Mirror) haben CORS-Beschränkungen. Ein direkter Zugriff vom Browser aus wird blockiert.

## Die Lösung: Proxy

Es gibt zwei Möglichkeiten, den Proxy zu betreiben:

### 1. **Development**: Vite-integrierter Proxy ✅ (Aktuell)

Für lokale Entwicklung nutzen wir einen Vite-Middleware-Proxy:

```bash
npm run dev
```

Der Vite Dev Server (`localhost:5173`) beinhaltet die Proxy-Middleware in `vite-proxy-middleware.ts`:
- `/api/invidious?q=...` → Search API
- `/api/video/0/latest_version?id=...` → Video Stream

**Vorteile:**
- Keine zusätzliche Konfiguration
- Dev Server & App zusammen
- Einfaches Debugging

**Nachteile:**
- Funktioniert nur mit Vite Dev Server
- Nicht für Production

---

### 2. **Production**: Express Proxy-Server 🚀

Für Production brauchst du einen separaten Proxy-Server. Ein einfacher Express-Server liegt vor:

```bash
# Port auto-detect (3000)
npm run proxy

# Oder mit spezifischem Port
PORT=8080 npm run proxy

# Oder direkt mit node
node proxy-server.js 8080
```

**Der Proxy läuft dann:**
```
http://localhost:3000
  ├── /api/invidious?q=...       → Search
  └── /api/video/0/latest_version?id=...  → Video
```

**Konfiguriere dann deine App** um den Proxy zu nutzen:

```javascript
// In onlineSearch.ts
const PROXY_BASE = process.env.VITE_PROXY_URL || 'http://localhost:3000';

const url = `${PROXY_BASE}/api/invidious?q=${encodeURIComponent(...)}`;
```

---

### 3. **Alternative**: Nginx Reverse Proxy

Für Production ohne Node.js kannst du auch Nginx nutzen:

```nginx
# /etc/nginx/sites-available/karaoke-videoplayer
server {
  listen 80;
  server_name karaoke.example.com;

  # Serve static app
  root /var/www/karaoke-videoplayer/dist;
  
  # Proxy APIs
  location /api/invidious {
    proxy_pass https://inv.nadeko.net/api/v1/search;
    add_header Access-Control-Allow-Origin "*";
  }
  
  location /api/video/ {
    proxy_pass https://invidious.nerdvpn.de/latest_version;
    add_header Access-Control-Allow-Origin "*";
  }
}
```

---

## Deployment-Optionen

### Option A: Vite + Proxy zusammen (Docker)

```bash
docker compose up
```

**docker-compose.yml:**
```yaml
services:
  app:
    build: .
    ports:
      - "5173:5173"
    command: npm run dev -- --host 0.0.0.0
  
  proxy:
    build: .
    ports:
      - "3000:3000"
    command: PORT=3000 node proxy-server.js
```

### Option B: Build + Static Server + Proxy (Production)

```bash
npm run build
npm run proxy  # In separatem Terminal

# App via einfachen HTTP Server serven:
python3 -m http.server 8000 --directory dist
```

Dann öffne: `http://localhost:8000`

Der Proxy läuft auf `http://localhost:3000` und die App greift darauf zu.

### Option C: Nur Vite (nicht recommended für Production)

```bash
npm run dev -- --host 0.0.0.0 --port 80
```

Der Vite Dev Server ist nicht für Production gemacht, aber für Testing ok.

---

## Umgebungsvariablen

**Für Production, erstelle eine `.env.production` Datei:**

```env
VITE_PROXY_URL=http://karaoke-proxy:3000
VITE_API_BASE=/api
```

Dann in der App:
```javascript
const proxyBase = import.meta.env.VITE_PROXY_URL || window.location.origin;
```

---

## Troubleshooting

### `Content-Type: text/html` Fehler

Das bedeutet, der Proxy antwortet nicht richtig. Checken:

1. **Dev Mode**: Läuft `npm run dev` mit der Vite-Middleware?
2. **Production**: Läuft `npm run proxy` auf dem richtigen Port?
3. **Netzwerk**: Kann dein Browser den Proxy erreichen?

```bash
# Test den Proxy manuell:
curl http://localhost:3000/api/invidious?q=test&type=video&page=1

# Sollte JSON zurückgeben, nicht HTML
```

### Invidious-Instanzen nicht erreichbar

Alle 6 konfigurierten Instanzen sind down? Der Proxy fallback funktioniert dann nicht.

**Lösungen:**
1. Neue Instanz in `proxy-server.js` oder `vite-proxy-middleware.ts` hinzufügen
2. `https://instances.invidious.io` checken für aktive Instanzen

---

## Zusammenfassung

| Szenario | Lösung | Port |
|----------|--------|------|
| **Lokal entwickeln** | `npm run dev` (Vite + Proxy) | 5173 |
| **Testen mit Production-Build** | `npm run build` + `npm run proxy` | 3000 + 8000* |
| **Docker-Produktion** | `docker compose up` | 80 |
| **Nginx Production** | Nginx Reverse Proxy | 80/443 |

*Port 8000 für den App-Server (z.B. `python3 -m http.server`)

