/**
 * Vite development proxy middleware for Invidious API calls.
 * Handles CORS issues by proxying requests through the dev server.
 */

import { IncomingMessage, ServerResponse } from "http";

const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://yt.chocolatemoo53.com",
  "https://invidious.tiekoetter.com",
  "https://invidious.f5.si",
  "https://iv.nboeck.de"
];

/**
 * Try fetching from multiple Invidious instances in sequence
 */
async function tryInvidiousFetch(path: string): Promise<Response> {
  let lastError: Error | null = null;

  for (const baseUrl of INVIDIOUS_INSTANCES) {
    try {
      const fullUrl = `${baseUrl}${path}`;
      const response = await fetch(fullUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      });

      // Only consider 2xx as success
      if (response.ok) {
        return response;
      }

      lastError = new Error(`HTTP ${response.status} from ${baseUrl}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // Continue to next instance
      continue;
    }
  }

  // All instances failed
  throw new Error(
    `All Invidious instances failed. Last error: ${lastError?.message}`
  );
}

/**
 * Try fetching video from a specific instance (for latest_version)
 */
async function fetchVideoFromInstance(baseUrl: string, path: string): Promise<Response> {
  try {
    const fullUrl = `${baseUrl}${path}`;
    console.log(`[Video Proxy] Trying: ${fullUrl}`);
    const response = await fetch(fullUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "video/*, application/octet-stream"
      }
    });

    if (response.ok) {
      const contentType = response.headers.get("content-type") || "";
      console.log(`[Video Proxy] Success: HTTP ${response.status}, Content-Type: ${contentType}`);
      return response;
    }

    console.error(`[Video Proxy] Failed: HTTP ${response.status}`);
    throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Video Proxy] Exception: ${msg}`);
    throw error;
  }
}

/**
 * Try fetching video from multiple instances in sequence
 */
async function tryFetchVideoWithFallback(path: string): Promise<Response> {
  let lastError: Error | null = null;

  for (let i = 0; i < INVIDIOUS_INSTANCES.length; i++) {
    try {
      return await fetchVideoFromInstance(INVIDIOUS_INSTANCES[i], path);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`[Video Proxy] Trying next instance (${i + 1}/${INVIDIOUS_INSTANCES.length})...`);
    }
  }

  throw new Error(
    `All Invidious instances failed for video. Last error: ${lastError?.message}`
  );
}

export default function viteProxyMiddleware() {
  return {
    name: "invidious-proxy",
    configureServer(server: any) {
      return () => {
        // Proxy for search API calls
        server.middlewares.use("/api/invidious", async (req: IncomingMessage, res: ServerResponse) => {
          // Only handle GET requests
          if (req.method !== "GET") {
            res.writeHead(405, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Method not allowed" }));
            return;
          }

          try {
            // req.url is like "?q=...&type=video&page=1"
            const queryString = (req.url || "").split("?")[1] || "";
            const fullPath = `/api/v1/search?${queryString}`;

            const response = await tryInvidiousFetch(fullPath);
            const data = await response.text();

            // Forward CORS headers
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            });
            res.end(data);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            console.error(`[Invidious Proxy] ${errorMsg}`);

            res.writeHead(502, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            });
            res.end(JSON.stringify({ error: errorMsg }));
          }
        });

        // Proxy for video content (latest_version)
        // Matches: /api/video/{instance_index}/latest_version?id=...&itag=...
        server.middlewares.use("/api/video/", async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== "GET") {
            res.writeHead(405);
            res.end("Method not allowed");
            return;
          }

          try {
            // req.url is like "/0/latest_version?id=...&itag=..."
            const urlPath = req.url || "/0/latest_version";
            const [pathPart, queryPart] = urlPath.split("?");
            const pathSegments = pathPart.split("/").filter((p) => p.length > 0);

            if (pathSegments.length < 2) {
              console.error(`[Video Proxy] Invalid path segments: ${pathSegments.join("/")} from ${urlPath}`);
              res.writeHead(400, { "Content-Type": "text/plain" });
              res.end("Invalid request");
              return;
            }

            // pathSegments: ["0", "latest_version"] or higher numbers for fallback
            const instanceIdx = parseInt(pathSegments[0] || "0");
            const endpoint = "/" + pathSegments.slice(1).join("/");
            const fullPath = `${endpoint}${queryPart ? "?" + queryPart : ""}`;

            console.log(`[Video Proxy] Instance ${instanceIdx}: ${fullPath}`);

            // Try the specific instance, then fallback to others
            let response: Response | null = null;
            for (let i = instanceIdx; i < INVIDIOUS_INSTANCES.length; i++) {
              try {
                response = await fetchVideoFromInstance(INVIDIOUS_INSTANCES[i], fullPath);
                break;
              } catch (error) {
                console.log(`[Video Proxy] Instance ${i} failed, trying next...`);
                if (i === INVIDIOUS_INSTANCES.length - 1) {
                  throw error;
                }
              }
            }

            if (!response) {
              throw new Error("No response from any instance");
            }

            const buffer = await response.arrayBuffer();
            const contentType = response.headers.get("content-type") || "video/mp4";

            res.writeHead(200, {
              "Content-Type": contentType,
              "Content-Length": buffer.byteLength,
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=86400"
            });
            res.end(Buffer.from(buffer));
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            console.error(`[Video Proxy] Error: ${errorMsg}`);

            res.writeHead(502, { "Content-Type": "text/plain" });
            res.end(`Error: ${errorMsg}`);
          }
        });
      };
    }
  };
}
