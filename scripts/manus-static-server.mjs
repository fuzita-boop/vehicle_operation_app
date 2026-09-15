import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const staticRoot = resolve(currentFile, "..", "public");
const port = Number(process.env.PORT ?? 3000);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function safeAssetPath(pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const decoded = decodeURIComponent(requested);
  const target = normalize(join(staticRoot, decoded));
  return target.startsWith(staticRoot) ? target : null;
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const candidate = safeAssetPath(url.pathname);
  const filePath = candidate && existsSync(candidate) && statSync(candidate).isFile()
    ? candidate
    : join(staticRoot, "index.html");

  if (!existsSync(filePath)) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Static application files were not found.");
    return;
  }

  const extension = extname(filePath).toLowerCase();
  response.writeHead(200, {
    "Content-Type": contentTypes[extension] ?? "application/octet-stream",
    "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Static PWA server listening on port ${port}`);
});
