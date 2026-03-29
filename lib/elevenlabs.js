const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");

let envLoaded = false;

function loadEnvFile(filePath = path.join(process.cwd(), ".env")) {
  if (envLoaded) {
    return;
  }

  if (!fs.existsSync(filePath)) {
    envLoaded = true;
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }

    let value = trimmedLine.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }

  envLoaded = true;
}

function getDefaultModelId() {
  return process.env.ELEVENLABS_MODEL_ID || "eleven_v3";
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}

function methodNotAllowed(res, methods) {
  res.setHeader("Allow", methods.join(", "));
  return sendJson(res, 405, { error: "Method not allowed." });
}

async function handleHealth(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  return sendJson(res, 200, {
    ok: true,
    keyConfigured: Boolean(process.env.ELEVENLABS_API_KEY),
    defaultModelId: getDefaultModelId()
  });
}

async function handleModels(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return sendJson(res, 400, {
      error: "ELEVENLABS_API_KEY is missing. Add it to your .env file."
    });
  }

  const response = await fetch("https://api.elevenlabs.io/v1/models", {
    headers: {
      "xi-api-key": apiKey
    }
  });

  const payload = await readUpstreamBody(response);

  if (!response.ok) {
    return sendJson(res, response.status, {
      error: "Failed to load models from ElevenLabs.",
      details: payload
    });
  }

  const parsedPayload = tryParseJson(payload);
  if (!Array.isArray(parsedPayload)) {
    return sendJson(res, 502, {
      error: "ElevenLabs models response was not valid JSON.",
      details: payload
    });
  }

  const models = parsedPayload
    .filter((model) => model.can_do_text_to_speech)
    .map((model) => ({
      modelId: model.model_id,
      name: model.name,
      description: model.description,
      maxCharacters:
        model.maximum_text_length_per_request ||
        model.max_characters_request_subscribed_user ||
        model.max_characters_request_free_user ||
        null
    }));

  return sendJson(res, 200, {
    defaultModelId: getDefaultModelId(),
    models
  });
}

async function handleVoices(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return sendJson(res, 400, {
      error: "ELEVENLABS_API_KEY is missing. Add it to your .env file."
    });
  }

  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: {
      "xi-api-key": apiKey
    }
  });

  const payload = await readUpstreamBody(response);

  if (!response.ok) {
    return sendJson(res, response.status, {
      error: "Failed to load voices from ElevenLabs.",
      details: payload
    });
  }

  const data = tryParseJson(payload);
  if (!data || typeof data !== "object") {
    return sendJson(res, 502, {
      error: "ElevenLabs voices response was not valid JSON.",
      details: payload
    });
  }

  const voices = Array.isArray(data.voices) ? data.voices : [];

  return sendJson(res, 200, {
    voices: voices.map((voice) => ({
      voiceId: voice.voice_id,
      name: voice.name,
      category: voice.category,
      description: voice.description || "",
      previewUrl: voice.preview_url || "",
      labels: voice.labels || {}
    }))
  });
}

async function handleTextToSpeech(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return sendJson(res, 400, {
      error: "ELEVENLABS_API_KEY is missing. Add it to your .env file."
    });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    return sendJson(res, 400, {
      error: "Request body must be valid JSON.",
      details: error instanceof Error ? error.message : String(error)
    });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const voiceId = typeof body.voiceId === "string" ? body.voiceId.trim() : "";
  const modelId =
    typeof body.modelId === "string" && body.modelId.trim()
      ? body.modelId.trim()
      : getDefaultModelId();
  const outputFormat =
    typeof body.outputFormat === "string" && body.outputFormat.trim()
      ? body.outputFormat.trim()
      : "mp3_44100_128";
  const applyTextNormalization =
    body.applyTextNormalization === "on" ||
    body.applyTextNormalization === "off" ||
    body.applyTextNormalization === "auto"
      ? body.applyTextNormalization
      : "auto";

  if (!text) {
    return sendJson(res, 400, { error: "Text is required." });
  }

  if (!voiceId) {
    return sendJson(res, 400, { error: "voiceId is required." });
  }

  const upstreamPayload = {
    text,
    model_id: modelId,
    apply_text_normalization: applyTextNormalization
  };

  if (typeof body.languageCode === "string" && body.languageCode.trim()) {
    upstreamPayload.language_code = body.languageCode.trim();
  }

  const voiceSettings = sanitizeVoiceSettings(body.voiceSettings);
  if (voiceSettings) {
    upstreamPayload.voice_settings = voiceSettings;
  }

  const endpoint = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`);
  endpoint.searchParams.set("output_format", outputFormat);

  let response = await requestSpeech({
    apiKey,
    endpoint,
    payload: upstreamPayload
  });
  let errorPayload = "";

  if (!response.ok) {
    errorPayload = await readUpstreamBody(response);
    const parsedError = tryParseJson(errorPayload);

    const shouldRetryWithoutLanguageCode =
      upstreamPayload.language_code &&
      parsedError?.detail?.param === "language_code";

    if (shouldRetryWithoutLanguageCode) {
      delete upstreamPayload.language_code;
      response = await requestSpeech({
        apiKey,
        endpoint,
        payload: upstreamPayload
      });

      if (!response.ok) {
        errorPayload = await readUpstreamBody(response);
      }
    }

    if (!response.ok) {
      return sendJson(res, response.status, {
        error: "ElevenLabs audio generation failed.",
        details: errorPayload
      });
    }
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Content-Disposition", 'inline; filename="speech.mp3"');
  res.setHeader("Cache-Control", "no-store");

  if (!response.body) {
    return res.end();
  }

  Readable.fromWeb(response.body).pipe(res);
}

async function requestSpeech({ apiKey, endpoint, payload }) {
  return fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "audio/mpeg",
      "Content-Type": "application/json",
      "xi-api-key": apiKey
    },
    body: JSON.stringify(payload)
  });
}

function sanitizeVoiceSettings(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const settings = {};
  const allowedKeys = ["stability", "similarity_boost", "style", "speed"];

  for (const key of allowedKeys) {
    const raw = value[key];
    if (raw === undefined || raw === null || raw === "") {
      continue;
    }

    const numericValue = Number(raw);
    if (!Number.isFinite(numericValue)) {
      continue;
    }

    settings[key] = numericValue;
  }

  if (typeof value.use_speaker_boost === "boolean") {
    settings.use_speaker_boost = value.use_speaker_boost;
  }

  return Object.keys(settings).length > 0 ? settings : null;
}

async function readJsonBody(req) {
  if (req.body !== undefined) {
    if (typeof req.body === "string") {
      return req.body ? JSON.parse(req.body) : {};
    }

    if (Buffer.isBuffer(req.body)) {
      const raw = req.body.toString("utf8");
      return raw ? JSON.parse(raw) : {};
    }

    if (typeof req.body === "object" && req.body !== null) {
      return req.body;
    }
  }

  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > 1024 * 1024) {
      throw new Error("Request body is too large.");
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw);
}

async function readUpstreamBody(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return JSON.stringify(await response.json());
  }

  return response.text();
}

function tryParseJson(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

module.exports = {
  getDefaultModelId,
  handleHealth,
  handleModels,
  handleTextToSpeech,
  handleVoices,
  loadEnvFile,
  sendJson
};
