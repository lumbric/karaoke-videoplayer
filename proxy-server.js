#!/usr/bin/env node
/**
 * Simple proxy server for Invidious API
 * Solves CORS issues for video playback
 *
 * Usage:
 *   node proxy-server.js [port]
 *
 * Example:
 *   PORT=3000 node proxy-server.js
 *   or: node proxy-server.js 3000
 */

const http = require("http");
const https = require("https");
const url = require("url");

const PORT = process.env.PORT || process.argv[2] || 3000;

const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://yt.chocolatemoo53.com",
  "https://invidious.tiekoetter.com",
  "https://invidious.f5.si",
  "https://iv.nboeck.de"
];

/**
 * Fetch from a URL with automatic protocol selection
 */
function fetchUrl(urlString, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new url.URL(urlString);
    const protocol = parsedUrl.protocol === "https:" ? https : http;

    const reqOptions = {
      method: options.method || "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: options.accept || "*/*",
        ...options.headers
      },
      timeout: 10000
    };

    const req = protocol.request(parsedUrl, reqOptions, (res) => {
      let data = Buffer.alloc(0);

      res.on("data", (chunk) => {
        data = Buffer.concat([data, chunk]);
      });

      res.on("end", () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

/**
 * Try fetching from multiple instances
 */
async function fetchWithFallback(path, options = {}) {
  let lastError = null;

  for (let i = 0; i < INVIDIOUS_INSTANCES.length; i++) {
    try {
      const fullUrl = INVIDIOUS_INSTANCES[i] + path;
      console.log(`[Proxy] Instance ${i}: ${fullUrl}`);

      const result = await fetchUrl(fullUrl, options);

      if (result.status === 200) {
        console.log(`[Proxy] ✓ Success from instance ${i}`);
        return result;
      }

      lastError = new Error(`HTTP ${result.status}`);
      console.log(`[Proxy] Instance ${i} returned ${result.status}, trying next...`);
    } catch (error) {
      lastError = error;
      console.log(`[Proxy] Instance ${i} failed: ${error.message}`);
    }
  }

  throw lastError || new Error("All instances failed");
}

// Create proxy server
const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, max-age=86400");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  // Route: /api/invidious?q=...&type=video&page=1
  if (req.url.startsWith("/api/invidious?")) {
    try {
      const queryString = req.url.replace("/api/invidious?", "");
      const path = `/api/v1/search?${queryString}`;

      const result = await fetchWithFallback(path);

      res.writeHead(200, {
        "Content-Type": "application/json"
      });
      res.end(result.body);
    } catch (error) {
      console.error(`[Proxy] Search error: ${error.message}`);
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // Route: /api/video/0/latest_version?id=...&itag=...
  if (req.url.startsWith("/api/video/")) {
    try {
      const urlPath = req.url.replace("/api/video/", "");
      const [pathPart, queryPart] = urlPath.split("?");
      const pathSegments = pathPart.split("/").filter((p) => p.length > 0);

      if (pathSegments.length < 2) {
        throw new Error("Invalid path");
      }

      const endpoint = "/" + pathSegments.slice(1).join("/");
      const fullPath = `${endpoint}${queryPart ? "?" + queryPart : ""}`;

      console.log(`[Proxy] Video endpoint: ${fullPath}`);

      const result = await fetchWithFallback(fullPath, {
        accept: "video/*, application/octet-stream"
      });

      res.writeHead(200, {
        "Content-Type": result.headers["content-type"] || "video/mp4",
        "Content-Length": result.body.length
      });
      res.end(result.body);
    } catch (error) {
      console.error(`[Proxy] Video error: ${error.message}`);
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // Default: 404
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`✓ Invidious proxy server listening on http://localhost:${PORT}`);
  console.log(`  Endpoints:`);
  console.log(`    - GET /api/invidious?q=...&type=video&page=1`);
  console.log(`    - GET /api/video/0/latest_version?id=...&itag=...`);
  console.log(`\n  Configured instances:`);
  INVIDIOUS_INSTANCES.forEach((instance, i) => {
    console.log(`    [${i}] ${instance}`);
  });
});
