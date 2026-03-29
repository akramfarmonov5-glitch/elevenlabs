# ElevenLabs Text-to-Speech Demo

Minimal loyiha: local Node server orqali ElevenLabs Text-to-Speech API'ga ulanadi va browser ichida audio yaratadi.

## Nimalar bor

- `GET /api/health` - konfiguratsiya holatini tekshiradi
- `GET /api/models` - Text-to-Speech uchun mavjud modellerni olib keladi
- `GET /api/voices` - account'dagi voices ro'yxatini olib keladi
- `POST /api/tts` - matndan MP3 audio yaratadi
- Browser UI - matn, model, voice va voice settings bilan ishlash
- Uzbek mode preview - sana, vaqt, foiz va pul yozuvlarini talaffuzga moslaydi

## Ishga tushirish

1. `.env` ichiga `ELEVENLABS_API_KEY` yozing.
2. Serverni ishga tushiring:

```powershell
node server.js
```

Windows uchun eng oson usul:

```bat
start.cmd
```

Yoki serverni yangi alohida oynada ochish uchun:

```bat
launch.cmd
```

3. Browserda `http://127.0.0.1:3000` ni oching.

## Vercel uchun tayyorlash

Loyiha endi Vercel uchun quyidagi formatda moslangan:

- `public/` - statik frontend fayllar
- `api/*.js` - Vercel serverless function endpointlari
- `vercel.json` - function runtime va duration sozlamalari
- `.vercelignore` - lokal `.env` va Windows start fayllarini deploy'dan chiqaradi

Vercel dashboard'da quyidagi env varlarni qo'shing:

- `ELEVENLABS_API_KEY`
- `ELEVENLABS_MODEL_ID=eleven_v3` (ixtiyoriy, lekin tavsiya etiladi)

Deploydan oldin lokal tekshiruv uchun:

```powershell
node server.js
```

Yoki Vercel local emulation uchun:

```powershell
npm run vercel:dev
```

## `.env` namunasi

```env
ELEVENLABS_API_KEY=your_api_key_here
ELEVENLABS_MODEL_ID=eleven_v3
PORT=3000
HOST=127.0.0.1
```

## Local API misollar

Voices olish:

```powershell
Invoke-RestMethod http://localhost:3000/api/voices
```

Text-to-Speech yaratish:

```powershell
$body = @{
  text = "Bugun 28.03.2026 kuni soat 14:30 da 15% chegirma va 120 000 so'mlik taklif bor."
  voiceId = "VOICE_ID_HERE"
  modelId = "eleven_v3"
  outputFormat = "mp3_44100_128"
  applyTextNormalization = "on"
  voiceSettings = @{
    stability = 0.5
    similarity_boost = 0.75
    style = 0.2
    speed = 0.95
    use_speaker_boost = $true
  }
} | ConvertTo-Json -Depth 4

Invoke-WebRequest `
  -Uri http://localhost:3000/api/tts `
  -Method POST `
  -ContentType "application/json" `
  -Body $body `
  -OutFile .\speech.mp3
```

## Muhim eslatma

- Agar `.env` ichida API key bo'lmasa, UI ochiladi, lekin voices va TTS so'rovlari bajarilmaydi.
- Agar API key cheklangan scope bilan yaratilgan bo'lsa, `voices_read` va `models_read` ishlamasligi mumkin. Bu holatda UI manual `Voice ID` rejimiga o'tadi va TTS baribir ishlaydi.
- O'zbekcha talaffuz uchun `Eleven v3` tavsiya etiladi. `Language code` maydonini bo'sh qoldiring.
- Uzbek mode preview audio yuborilishidan oldin matn qanday tayyorlanganini ko'rsatadi.
- `28.03.2026`, `14:30`, `15%`, `120 000 so'm` kabi yozuvlar Uzbek mode ichida o'qishga qulay ko'rinishga o'tadi.
- Qisqartma va raqamlarni imkon qadar matn ko'rinishida yozing: `AI` o'rniga `ey-ay`, `IT` o'rniga `ay-ti`, `2026` o'rniga `ikki ming yigirma olti`.
- `npm install` kerak emas, loyiha Node 18+ dagi built-in `fetch` bilan ishlaydi.
- Agar ElevenLabs account tier cheklovi bo'lsa, ba'zi voices yoki output formatlar ishlamasligi mumkin.
