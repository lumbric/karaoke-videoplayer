export function getBasePath(): string {
  const base = import.meta.env.BASE_URL;
  if (!base) return "/";
  return base.endsWith("/") ? base : `${base}/`;
}

export function resolveUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("//")) {
    return path;
  }
  
  const base = getBasePath();
  const cleanPath = path.replace(/^\/+/, "");
  return `${base}${cleanPath}`;
}
