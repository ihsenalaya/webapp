"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");

const ROOT_DIR = __dirname;
const INDEX_FILE = path.join(ROOT_DIR, "index.html");
const PORT = Number(process.env.PORT || 8080);
const ALLOWED_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; connect-src 'self' https://login.microsoftonline.com https://graph.microsoft.com https://*.microsoftonline.com; frame-src 'self' https://login.microsoftonline.com https://*.microsoftonline.com; form-action 'self' https://login.microsoftonline.com https://*.microsoftonline.com",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

function writeCommonHeaders(res) {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

function writeTextResponse(res, statusCode, body) {
  writeCommonHeaders(res);
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}

function getCacheControl(filePath) {
  const baseName = path.basename(filePath);

  if (baseName === "index.html") {
    return "no-store";
  }

  if (/-[A-Z0-9]{8}\./i.test(baseName)) {
    return "public, max-age=31536000, immutable";
  }

  return "public, max-age=3600";
}

function sendFile(req, res, filePath, stat) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const cacheControl = getCacheControl(filePath);

  writeCommonHeaders(res);
  res.setHeader("Cache-Control", cacheControl);
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Length", stat.size);

  if (req.method === "HEAD") {
    res.writeHead(200);
    res.end();
    return;
  }

  res.writeHead(200);

  const stream = fs.createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) {
      writeTextResponse(res, 500, "Internal Server Error");
      return;
    }

    res.destroy();
  });

  stream.pipe(res);
}

function getSafeAbsolutePath(requestPath) {
  const normalized = path.normalize(requestPath);
  // Always resolve from ROOT_DIR, even when requestPath starts with "/".
  const relativePath = normalized.replace(/^[/\\]+/, "");
  return path.resolve(ROOT_DIR, relativePath);
}

function statOrNull(filePath, callback) {
  fs.stat(filePath, (err, stat) => {
    if (err) {
      callback(null);
      return;
    }

    callback(stat);
  });
}

function isInsideRoot(targetPath) {
  const rel = path.relative(ROOT_DIR, targetPath);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

const server = http.createServer((req, res) => {
  if (!ALLOWED_METHODS.has(req.method)) {
    res.setHeader("Allow", "GET, HEAD, OPTIONS");
    writeTextResponse(res, 405, "Method Not Allowed");
    return;
  }

  if (req.method === "OPTIONS") {
    writeCommonHeaders(res);
    res.setHeader("Allow", "GET, HEAD, OPTIONS");
    res.writeHead(204);
    res.end();
    return;
  }

  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  } catch {
    writeTextResponse(res, 400, "Bad Request");
    return;
  }

  let rawPath;
  try {
    rawPath = decodeURIComponent(url.pathname);
  } catch {
    writeTextResponse(res, 400, "Bad Request");
    return;
  }

  const requestedPath = rawPath === "/" ? "/index.html" : rawPath;
  const absolutePath = getSafeAbsolutePath(requestedPath);
  const hasExtension = path.extname(requestedPath) !== "";

  if (!isInsideRoot(absolutePath)) {
    writeTextResponse(res, 403, "Forbidden");
    return;
  }

  statOrNull(absolutePath, stat => {
    if (stat && stat.isFile()) {
      sendFile(req, res, absolutePath, stat);
      return;
    }

    if (!hasExtension) {
      statOrNull(INDEX_FILE, indexStat => {
        if (!indexStat || !indexStat.isFile()) {
          writeTextResponse(res, 500, "Internal Server Error");
          return;
        }

        sendFile(req, res, INDEX_FILE, indexStat);
      });
    } else {
      writeTextResponse(res, 404, "Not Found");
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Static SPA server running on port ${PORT}`);
});
