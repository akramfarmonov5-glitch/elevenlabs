const apiStatus = document.getElementById("apiStatus");
const reloadDataButton = document.getElementById("reloadDataButton");
const ttsForm = document.getElementById("ttsForm");
const textInput = document.getElementById("textInput");
const uzbekModeInput = document.getElementById("uzbekModeInput");
const normalizedPreview = document.getElementById("normalizedPreview");
const voiceSelect = document.getElementById("voiceSelect");
const voiceIdInput = document.getElementById("voiceIdInput");
const presetVoiceSelect = document.getElementById("presetVoiceSelect");
const applyPresetButton = document.getElementById("applyPresetButton");
const modelSelect = document.getElementById("modelSelect");
const outputFormatSelect = document.getElementById("outputFormatSelect");
const languageCodeInput = document.getElementById("languageCodeInput");
const speakerBoostInput = document.getElementById("speakerBoostInput");
const previewVoiceButton = document.getElementById("previewVoiceButton");
const audioPlayer = document.getElementById("audioPlayer");
const downloadLink = document.getElementById("downloadLink");
const messageBox = document.getElementById("messageBox");
const voiceInfo = document.getElementById("voiceInfo");
const characterCount = document.getElementById("characterCount");

const sliders = [
  ["stabilityInput", "stabilityValue"],
  ["similarityInput", "similarityValue"],
  ["styleInput", "styleValue"],
  ["speedInput", "speedValue"]
];

const fallbackModels = [
  { modelId: "eleven_v3", name: "Eleven v3" },
  { modelId: "eleven_multilingual_v2", name: "Eleven Multilingual v2" },
  { modelId: "eleven_turbo_v2_5", name: "Eleven Turbo v2.5" },
  { modelId: "eleven_flash_v2_5", name: "Eleven Flash v2.5" }
];

const freeVoicePresets = [
  { name: "Bella", voiceId: "EXAVITQu4vr4xnSDxMaL" },
  { name: "Antoni", voiceId: "ErXwobaYiN019PkySvjV" },
  { name: "Arnold", voiceId: "VR6AewLTigWG4xSOukaG" },
  { name: "Adam", voiceId: "pNInz6obpgDQGcFmaJgB" },
  { name: "Callum", voiceId: "N2lVS1w4EtoT3dr4eOWO" },
  { name: "Charlie", voiceId: "IKne3meq5aSn9XLyUdCD" },
  { name: "George", voiceId: "JBFqnCBsd6RMkjVDRZzb" },
  { name: "Matilda", voiceId: "Xb7hH8MSUJpSbSDYk0k2" },
  { name: "Brian", voiceId: "nPczCjzI2devNBz1zQrb" },
  { name: "Sarah", voiceId: "cgSgspJ2msm6clMCkdW9" },
  { name: "Laura", voiceId: "FGY2WhTYpPnrIDTdsKH5" },
  { name: "River", voiceId: "SAz9YHcvj6GT2YYXdXww" },
  { name: "Alice", voiceId: "XrExE9yKIg1WjnnlVkGX" }
];

const UZBEK_ONES = [
  "nol",
  "bir",
  "ikki",
  "uch",
  "to'rt",
  "besh",
  "olti",
  "yetti",
  "sakkiz",
  "to'qqiz"
];

const UZBEK_TENS = [
  "",
  "o'n",
  "yigirma",
  "o'ttiz",
  "qirq",
  "ellik",
  "oltmish",
  "yetmish",
  "sakson",
  "to'qson"
];

const UZBEK_SCALES = ["", "ming", "million", "milliard", "trillion"];

const UZBEK_MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr"
];

let voices = [];
let currentAudioUrl = "";
let partialConnection = false;

for (const [inputId, valueId] of sliders) {
  const input = document.getElementById(inputId);
  const value = document.getElementById(valueId);
  input.addEventListener("input", () => {
    value.textContent = input.value;
  });
}

textInput.addEventListener("input", () => {
  characterCount.textContent = `${textInput.value.length} ta belgi`;
  updateNormalizedPreview();
});

uzbekModeInput.addEventListener("change", updateNormalizedPreview);
voiceSelect.addEventListener("change", renderSelectedVoiceInfo);
previewVoiceButton.addEventListener("click", previewSelectedVoice);
reloadDataButton.addEventListener("click", loadInitialData);
ttsForm.addEventListener("submit", handleSubmit);
modelSelect.addEventListener("change", syncLanguageCodeField);
presetVoiceSelect.addEventListener("change", applySelectedPresetVoice);
applyPresetButton.addEventListener("click", applySelectedPresetVoice);

populatePresetVoices();
updateNormalizedPreview();
loadInitialData();

async function loadInitialData() {
  partialConnection = false;
  setMessage("Sozlamalar tekshirilmoqda...", "info");

  try {
    const healthResponse = await fetch("/api/health");
    const health = await healthResponse.json();

    if (!health.keyConfigured) {
      apiStatus.textContent = "API key topilmadi";
      apiStatus.dataset.status = "warn";
      fillFallbackOptions();
      setMessage("`.env` fayliga `ELEVENLABS_API_KEY` qo'shing va serverni qayta ishga tushiring.", "warn");
      return;
    }

    apiStatus.textContent = "API ulandi";
    apiStatus.dataset.status = "ok";

    await loadModels(health.defaultModelId);
    await loadVoices();

    if (partialConnection) {
      apiStatus.textContent = "Qisman ulandi";
      apiStatus.dataset.status = "warn";
      setMessage(
        "API key audio yaratadi, lekin voices/models ro'yxatini o'qish ruxsati yo'q. Manual Voice ID bilan davom eting.",
        "warn"
      );
      return;
    }

    setMessage("Hammasi tayyor. Matn yozib audio yarating.", "success");
  } catch (error) {
    apiStatus.textContent = "Qisman ulandi";
    apiStatus.dataset.status = "warn";
    fillFallbackOptions();
    setMessage(`Boshlang'ich yuklashda xato: ${error.message}`, "warn");
  }
}

async function loadVoices() {
  try {
    const response = await fetch("/api/voices");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(normalizeErrorDetails(data.details) || data.error || "Voicesni yuklab bo'lmadi.");
    }

    const items = Array.isArray(data.voices) ? data.voices : [];
    voices = items;
    voiceSelect.innerHTML = "";

    if (!items.length) {
      ensureManualVoiceMode();
      return;
    }

    for (const voice of items) {
      const label = voice.category ? `${voice.name} (${voice.category})` : voice.name;
      voiceSelect.append(new Option(label, voice.voiceId));
    }

    voiceIdInput.value = voiceSelect.value || voiceIdInput.value;
    voiceSelect.disabled = false;
    renderSelectedVoiceInfo();
  } catch (error) {
    partialConnection = true;
    ensureManualVoiceMode();
    setMessage(
      "Voices ro'yxatini o'qib bo'lmadi. Sizning API key'da 'voices_read' ruxsati yo'q bo'lishi mumkin. Manual Voice ID bilan davom eting.",
      "warn"
    );
    console.warn(error);
  }
}

async function loadModels(defaultModelId) {
  try {
    const response = await fetch("/api/models");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(normalizeErrorDetails(data.details) || data.error || "Modelsni yuklab bo'lmadi.");
    }

    const items = Array.isArray(data.models) ? data.models : [];
    modelSelect.innerHTML = "";

    for (const model of items) {
      const label = model.maxCharacters
        ? `${model.name} (${model.maxCharacters} chars)`
        : model.name;
      modelSelect.append(new Option(label, model.modelId));
    }

    if (defaultModelId) {
      modelSelect.value = defaultModelId;
    }

    syncLanguageCodeField();
  } catch (error) {
    partialConnection = true;
    fillFallbackModels(defaultModelId);
    setMessage(
      "Models ro'yxatini o'qib bo'lmadi. Sizning API key'da 'models_read' ruxsati yo'q bo'lishi mumkin. Default model bilan davom eting.",
      "warn"
    );
    console.warn(error);
  }
}

function fillFallbackOptions() {
  ensureManualVoiceMode();
  fillFallbackModels("eleven_v3");
}

function fillFallbackModels(defaultModelId = "eleven_v3") {
  modelSelect.innerHTML = "";
  for (const model of fallbackModels) {
    modelSelect.append(new Option(model.name, model.modelId));
  }
  modelSelect.value = defaultModelId || "eleven_v3";
  syncLanguageCodeField();
}

function ensureManualVoiceMode() {
  voiceSelect.innerHTML = "";
  voiceSelect.append(new Option("Manual Voice ID ishlatiladi", ""));
  voiceSelect.disabled = true;
  voiceInfo.innerHTML = `
    <div class="voice-name-row">
      <strong>Manual Voice ID mode</strong>
    </div>
    <p>API key'da voices ro'yxatini o'qish ruxsati bo'lmasa ham, pastdagi <code>Voice ID</code> maydoni orqali audio yaratish mumkin.</p>
  `;
}

function populatePresetVoices() {
  presetVoiceSelect.innerHTML = "";

  for (const preset of freeVoicePresets) {
    presetVoiceSelect.append(
      new Option(`${preset.name} - ${preset.voiceId}`, preset.voiceId)
    );
  }

  const current = freeVoicePresets.find((item) => item.voiceId === voiceIdInput.value);
  presetVoiceSelect.value = current ? current.voiceId : freeVoicePresets[0].voiceId;
}

function applySelectedPresetVoice() {
  if (!presetVoiceSelect.value) {
    return;
  }

  voiceIdInput.value = presetVoiceSelect.value;
  const preset = freeVoicePresets.find((item) => item.voiceId === presetVoiceSelect.value);
  setMessage(`${preset?.name || "Preset"} voice ID qo'yildi. Endi audio yaratib ko'ring.`, "info");
}

function renderSelectedVoiceInfo() {
  if (voiceSelect.disabled) {
    return;
  }

  const voice = voices.find((item) => item.voiceId === voiceSelect.value);

  if (!voice) {
    voiceInfo.innerHTML = "";
    return;
  }

  const tags = Object.entries(voice.labels || {})
    .filter(([, value]) => value)
    .map(([key, value]) => `<span class="tag">${key}: ${value}</span>`)
    .join("");

  const preview = voice.previewUrl
    ? `<button class="inline-button" type="button" data-preview-url="${voice.previewUrl}">Preview sample</button>`
    : "";

  voiceInfo.innerHTML = `
    <div class="voice-name-row">
      <strong>${escapeHtml(voice.name)}</strong>
      ${preview}
    </div>
    <p>${escapeHtml(voice.description || "Bu voice uchun tavsif berilmagan.")}</p>
    <div class="tag-list">${tags}</div>
  `;

  const previewButton = voiceInfo.querySelector("[data-preview-url]");
  if (previewButton) {
    previewButton.addEventListener("click", () => {
      playAudioUrl(previewButton.dataset.previewUrl, false);
      setMessage("Voice sample preview ijro qilinmoqda.", "info");
    });
  }
}

function previewSelectedVoice() {
  if (voiceSelect.disabled) {
    setMessage("Manual Voice ID mode yoqilgan. Preview uchun voices_read ruxsati kerak.", "warn");
    return;
  }

  const voice = voices.find((item) => item.voiceId === voiceSelect.value);

  if (!voice || !voice.previewUrl) {
    setMessage("Tanlangan voice uchun preview URL yo'q.", "warn");
    return;
  }

  playAudioUrl(voice.previewUrl, false);
  setMessage("Voice preview ijro qilinmoqda.", "info");
}

async function handleSubmit(event) {
  event.preventDefault();

  const effectiveVoiceId = voiceSelect.disabled
    ? voiceIdInput.value.trim()
    : voiceSelect.value || voiceIdInput.value.trim();

  if (!effectiveVoiceId) {
    setMessage("Voice ID kiriting yoki voice tanlang.", "warn");
    return;
  }

  if (!textInput.value.trim()) {
    setMessage("Audio yaratish uchun matn kiriting.", "warn");
    return;
  }

  const preparedText = buildSpeechText(textInput.value);

  const payload = {
    text: preparedText,
    voiceId: effectiveVoiceId,
    modelId: modelSelect.value,
    outputFormat: outputFormatSelect.value,
    languageCode: supportsLanguageCode(modelSelect.value)
      ? languageCodeInput.value.trim()
      : "",
    applyTextNormalization: resolveTextNormalization(modelSelect.value, uzbekModeInput.checked),
    voiceSettings: {
      stability: Number(document.getElementById("stabilityInput").value),
      similarity_boost: Number(document.getElementById("similarityInput").value),
      style: Number(document.getElementById("styleInput").value),
      speed: Number(document.getElementById("speedInput").value),
      use_speaker_boost: speakerBoostInput.checked
    }
  };

  setMessage("Audio yaratilmoqda...", "info");

  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(getFriendlyTtsError(errorData));
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    playAudioUrl(objectUrl, true);
    setMessage("Audio tayyor. Pastdagi player orqali tinglashingiz mumkin.", "success");
  } catch (error) {
    setMessage(`Xato: ${error.message}`, "error");
  }
}

function playAudioUrl(url, downloadable) {
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
  }

  currentAudioUrl = downloadable ? url : "";
  audioPlayer.src = url;
  audioPlayer.play().catch(() => {});

  if (downloadable) {
    downloadLink.href = url;
    downloadLink.classList.remove("hidden");
    return;
  }

  downloadLink.classList.add("hidden");
  downloadLink.removeAttribute("href");
}

function setMessage(text, tone) {
  messageBox.textContent = text;
  messageBox.dataset.tone = tone;
}

function normalizeErrorDetails(details) {
  if (!details) {
    return "";
  }

  try {
    const parsed = typeof details === "string" ? JSON.parse(details) : details;
    return parsed?.detail?.message || parsed?.message || details;
  } catch {
    return String(details);
  }
}

function supportsLanguageCode(modelId) {
  return /flash|turbo/i.test(modelId || "");
}

function syncLanguageCodeField() {
  const enabled = supportsLanguageCode(modelSelect.value);
  languageCodeInput.disabled = !enabled;

  if (enabled) {
    languageCodeInput.placeholder = "Masalan: en";
    return;
  }

  languageCodeInput.value = "";
  languageCodeInput.placeholder = "Bu modelda auto aniqlanadi";
}

function buildSpeechText(text) {
  const source = String(text || "").trim();

  if (!source) {
    return "";
  }

  return uzbekModeInput.checked ? normalizeUzbekText(source) : source;
}

function updateNormalizedPreview() {
  normalizedPreview.value = buildSpeechText(textInput.value);
}

function normalizeUzbekText(text) {
  return normalizeApostrophes(text)
    .replace(/\r\n/g, "\n")
    .replace(/\b24\s*\/\s*7\b/gi, "yigirma to'rt soat, haftasiga yetti kun")
    .replace(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/g, formatUzbekDate)
    .replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, formatUzbekTime)
    .replace(/\$(\d[\d\s.,]*)\b/g, (_, amount) => `${spellNumericExpression(amount)} dollar`)
    .replace(/\u20AC(\d[\d\s.,]*)\b/g, (_, amount) => `${spellNumericExpression(amount)} yevro`)
    .replace(/\b(\d[\d\s.,]*)\s*(so'm|som|sum|uzs)\b/gi, (_, amount) => `${spellNumericExpression(amount)} so'm`)
    .replace(/\b(\d[\d\s.,]*)\s*(usd|dollar)\b/gi, (_, amount) => `${spellNumericExpression(amount)} dollar`)
    .replace(/\b(\d[\d\s.,]*)\s*(eur|euro|yevro)\b/gi, (_, amount) => `${spellNumericExpression(amount)} yevro`)
    .replace(/\b(\d[\d\s.,]*)\s*%/g, (_, amount) => `${spellNumericExpression(amount)} foiz`)
    .replace(/\bAI\b/g, "ey-ay")
    .replace(/\bIT\b/g, "ay-ti")
    .replace(/\bSMM\b/g, "es-em-em")
    .replace(/\bCRM\b/g, "si-ar-em")
    .replace(/\b(\d[\d\s.,]*)\b/g, (match) => spellNumericExpression(match))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeApostrophes(text) {
  return text
    .replace(/[\u2018\u2019\u02bb\u02bc`\u00b4\u02bb\u02bc]/g, "'")
    .replace(/([oOgG])'/g, (_, letter) => `${letter}\u02bb`);
}

function formatUzbekDate(_, dayRaw, monthRaw, yearRaw) {
  const day = Number(dayRaw);
  const month = Number(monthRaw);

  if (!day || month < 1 || month > 12) {
    return `${dayRaw}.${monthRaw}.${yearRaw}`;
  }

  return `${spellInteger(dayRaw)} ${UZBEK_MONTHS[month - 1]} ${spellInteger(yearRaw)}-yil`;
}

function formatUzbekTime(_, hourRaw, minuteRaw) {
  const hourWords = spellInteger(hourRaw);

  if (minuteRaw === "00") {
    return `soat ${hourWords}`;
  }

  const minuteWords =
    minuteRaw.startsWith("0") && minuteRaw !== "00"
      ? spellDigits(minuteRaw)
      : spellInteger(minuteRaw);

  return `soat ${hourWords} ${minuteWords}`;
}

function spellNumericExpression(rawValue) {
  const parsed = parseNumericExpression(rawValue);

  if (!parsed) {
    return rawValue;
  }

  const integerWords = spellInteger(parsed.integerPart);

  if (!parsed.fractionalPart) {
    return integerWords;
  }

  return `${integerWords} butun ${spellFraction(parsed.fractionalPart)}`;
}

function parseNumericExpression(rawValue) {
  const compact = String(rawValue || "")
    .trim()
    .replace(/\s+/g, "");

  if (!/^\d[\d.,]*$/.test(compact)) {
    return null;
  }

  let integerPart = compact;
  let fractionalPart = "";
  const separatorMatches = compact.match(/[.,]/g) || [];

  if (separatorMatches.length === 1) {
    const separator = compact.includes(",") ? "," : ".";
    const [left, right] = compact.split(separator);

    if (right.length > 0 && right.length <= 2) {
      integerPart = left;
      fractionalPart = right;
    } else {
      integerPart = left + right;
    }
  } else if (separatorMatches.length > 1) {
    const lastSeparatorIndex = Math.max(compact.lastIndexOf(","), compact.lastIndexOf("."));
    const left = compact.slice(0, lastSeparatorIndex);
    const right = compact.slice(lastSeparatorIndex + 1);

    if (right.length > 0 && right.length <= 2) {
      integerPart = left.replace(/[.,]/g, "");
      fractionalPart = right;
    } else {
      integerPart = compact.replace(/[.,]/g, "");
    }
  }

  integerPart = integerPart.replace(/[.,]/g, "").replace(/^0+(?!$)/, "");
  fractionalPart = fractionalPart.replace(/[.,]/g, "");

  if (!/^\d+$/.test(integerPart || "0")) {
    return null;
  }

  if (fractionalPart && !/^\d+$/.test(fractionalPart)) {
    return null;
  }

  return {
    integerPart: integerPart || "0",
    fractionalPart
  };
}

function spellFraction(fractionalPart) {
  if (!fractionalPart) {
    return "";
  }

  if (fractionalPart.startsWith("0")) {
    return spellDigits(fractionalPart);
  }

  return spellInteger(fractionalPart);
}

function spellDigits(value) {
  return String(value)
    .split("")
    .map((digit) => UZBEK_ONES[Number(digit)] || digit)
    .join(" ");
}

function spellInteger(value) {
  let digits = String(value || "0").replace(/\D/g, "").replace(/^0+(?!$)/, "");

  if (!digits) {
    return "nol";
  }

  const groups = [];
  while (digits.length > 0) {
    groups.unshift(digits.slice(-3));
    digits = digits.slice(0, -3);
  }

  const parts = [];

  groups.forEach((group, index) => {
    const groupValue = Number(group);
    if (!groupValue) {
      return;
    }

    const scaleIndex = groups.length - index - 1;
    const scaleWord = UZBEK_SCALES[scaleIndex] || "";
    const groupWords = spellThreeDigits(groupValue);

    if (scaleWord === "ming" && groupValue === 1) {
      parts.push("ming");
      return;
    }

    parts.push(scaleWord ? `${groupWords} ${scaleWord}` : groupWords);
  });

  return parts.join(" ").trim();
}

function spellThreeDigits(value) {
  const hundreds = Math.floor(value / 100);
  const tensUnits = value % 100;
  const tens = Math.floor(tensUnits / 10);
  const ones = tensUnits % 10;
  const parts = [];

  if (hundreds > 0) {
    if (hundreds > 1) {
      parts.push(UZBEK_ONES[hundreds]);
    }
    parts.push("yuz");
  }

  if (tens > 0) {
    parts.push(UZBEK_TENS[tens]);
  }

  if (ones > 0) {
    parts.push(UZBEK_ONES[ones]);
  }

  return parts.join(" ").trim();
}

function resolveTextNormalization(modelId, uzbekModeEnabled) {
  if (!uzbekModeEnabled) {
    return "auto";
  }

  if (/flash|turbo/i.test(modelId || "")) {
    return "auto";
  }

  return "on";
}

function getFriendlyTtsError(errorData) {
  const details = normalizeErrorDetails(errorData?.details);

  if (
    /paid_plan_required/i.test(details) ||
    /Free users cannot use library voices via the API/i.test(details) ||
    /library voices/i.test(details)
  ) {
    return "Tanlangan Voice ID library voice bo'lib, API orqali ishlatish uchun pullik ElevenLabs plan kerak. Bepul presetlardan birini tanlang yoki o'zingizning premade/cloned voice ID'ingizni kiriting.";
  }

  return details || errorData?.error || "TTS so'rovi bajarilmadi.";
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
