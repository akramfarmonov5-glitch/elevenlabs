const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { URL } = require("node:url");
const {
  handleHealth,
  handleModels,
  handleTextToSpeech,
  handleVoices,
  loadEnvFile,
  sendJson
} = require("./lib/elevenlabs");

loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);

    if (requestUrl.pathname === "/api/health") {
      return handleHealth(req, res);
    }

    if (requestUrl.pathname === "/api/models") {
      return handleModels(req, res);
    }

    if (requestUrl.pathname === "/api/voices") {
      return handleVoices(req, res);
    }

    if (requestUrl.pathname === "/api/tts") {
      return handleTextToSpeech(req, res);
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      return sendJson(res, 405, { error: "Method not allowed." });
    }

    return serveStaticFile(requestUrl.pathname, res, req.method === "HEAD");
  } catch (error) {
    console.error("Unexpected server error:", error);
    return sendJson(res, 500, {
      error: "Unexpected server error.",
      details: error.message
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`ElevenLabs TTS server is running at http://${HOST}:${PORT}`);
});

function serveStaticFile(requestPath, res, isHeadRequest) {
  const safePath = normalizePath(requestPath === "/" ? "/index.html" : requestPath);
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendJson(res, 403, { error: "Forbidden path." });
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return sendJson(res, 404, { error: "Not found." });
  }

  const extension = path.extname(filePath);
  const mimeType = MIME_TYPES[extension] || "application/octet-stream";
  const fileBuffer = fs.readFileSync(filePath);

  res.writeHead(200, {
    "Content-Type": mimeType,
    "Cache-Control": "no-store"
  });

  if (isHeadRequest) {
    return res.end();
  }

  return res.end(fileBuffer);
}

function normalizePath(inputPath) {
  return path.normalize(inputPath).replace(/^(\.\.[\\/])+/, "").replace(/^\\+/, "");
}
