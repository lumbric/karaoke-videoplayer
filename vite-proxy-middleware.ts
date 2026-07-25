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
    const response = await fetch(fullUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    if (response.ok) {
      return response;
    }

    throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
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
            // Extract the query string
            const path = (req.url || "").split("?")[1];
            const fullPath = `/api/v1/search?${path}`;

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

        // Proxy for video content (latest_version, vi/)
        server.middlewares.use("/api/video", async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== "GET") {
            res.writeHead(405);
            res.end("Method not allowed");
            return;
          }

          try {
            // Parse: /api/video/{instance_index}/path?query
            // Example: /api/video/0/latest_version?id=abc&itag=18&local=true
            const url = new URL(req.url || "/api/video/0", "http://localhost");
            const pathParts = url.pathname.split("/").filter((p) => p.length > 0); // ["api", "video", "0", "latest_version"]

            if (pathParts.length < 3) {
              res.writeHead(400);
              res.end("Invalid request");
              return;
            }

            const instanceIndex = parseInt(pathParts[2] || "0");
            const instanceIdx = Math.max(0, Math.min(instanceIndex, INVIDIOUS_INSTANCES.length - 1));
            const endpointPath = "/" + pathParts.slice(3).join("/");
            const queryString = url.search;

            const response = await fetchVideoFromInstance(
              INVIDIOUS_INSTANCES[instanceIdx],
              `${endpointPath}${queryString}`
            );
            const buffer = await response.arrayBuffer();

            res.writeHead(200, {
              "Content-Type": response.headers.get("content-type") || "application/octet-stream",
              "Content-Length": buffer.byteLength,
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=86400"
            });
            res.end(Buffer.from(buffer));
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            console.error(`[Video Proxy] ${errorMsg}`);

            res.writeHead(502);
            res.end(`Error: ${errorMsg}`);
          }
        });
      };
    }
  };
}
