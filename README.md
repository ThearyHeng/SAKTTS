# SAKTTS — Khmer & English AI Voice Studio

SAKTTS is a local-first full-stack AI voice platform built with **Next.js 16 (App Router, TypeScript, Tailwind CSS v4)** and powered by **OpenBMB VoxCPM2 (48 kHz)** via **Apple Silicon MLX (`mlx-audio`)** alongside Edge TTS for low-latency built-in voices.

## Features

- **48 kHz Native Bilingual TTS (Khmer + English)**: Synthesizes natural Khmer and mixed Khmer-English speech with automatic Khmer number/currency expansion (`12.5` -> `ដប់ពីរចុចប្រាំ`) and `[break=Xs]` pause controls.
- **Zero-Shot Controllable Voice Cloning**: Clone any voice from 10–30 seconds of uploaded or microphone-recorded speech with `librosa.yin` pitch ($F_0$ Hz) analysis and emotion/style instructions.
- **Ultimate Hi-Fi Cloning**: Supply an optional verbatim transcript (`promptText`) for continuation-aligned prosody and accent fidelity.
- **VoxCPM2 Voice Design**: Create custom 48 kHz voices from natural-language descriptions without uploading audio.
- **Speech-to-Text, AI Voice Detector & OpenAI-Compatible API**: Includes `/api/v1/audio/speech`, `/api/v1/audio/transcriptions`, `/api/v1/voices`, and `/api/voice-clones`.

## Local Setup

### 1. Prerequisites
- Node.js 20+
- Python 3.11+ (Apple Silicon macOS recommended for MLX acceleration)
- `ffmpeg` and `ffprobe`

### 2. Install Frontend Dependencies
```bash
npm install
```

### 3. Set Up the Local VoxCPM2 MLX Engine
```bash
python3.11 -m venv .voice-engine/venv_voxcpm
.voice-engine/venv_voxcpm/bin/pip install mlx-audio librosa soundfile
```

Start the voice engine on port `8765`:
```bash
HF_HUB_DISABLE_XET=1 .voice-engine/venv_voxcpm/bin/python .voice-engine/voxcpm_server.py
```

### 4. Run SAKTTS
```bash
npm run build
npm run start
```

Open `http://localhost:3000`.

## Docker & Dokploy Deployment

The repository includes a production multi-stage [`Dockerfile`](./Dockerfile) (`node:22-bookworm-slim` + `ffmpeg` + `espeak-ng`) ready for Dokploy, Railway, Fly.io, or Docker Compose.

### Dokploy Settings
- **Build Type**: `Dockerfile` (uses `Dockerfile` at the repository root)
- **Port**: `3000`
- **Persistent Volume** (recommended): mount `/app/.saktts-data` (or set `SAKTTS_DATA_DIR`) so cloned voices, generated MP3/WAV files, history, and API keys persist across redeployments.

### Connecting VoxCPM2 (48 kHz Voice Cloning) in Docker
Because Apple MLX only runs on Apple Silicon Macs and PyTorch VoxCPM2 requires multi-gigabyte weights (and an NVIDIA GPU for low latency), the default `Dockerfile` keeps the web container lightweight (~250 MB) and automatically runs built-in Edge TTS voices, STT, AI Voice Detector, and Soundboard out of the box.

To enable true **48 kHz VoxCPM2 Voice Cloning & Voice Design** in a Dokploy deployment:
1. Run either:
   - Your local Mac engine (`.voice-engine/voxcpm_server.py`) exposed securely via a Cloudflare Tunnel / Tailscale, **or**
   - A separate Linux GPU/CPU container built with [`Dockerfile.voxcpm`](./Dockerfile.voxcpm) (`openbmb/VoxCPM2`).
2. Set these environment variables on the Dokploy web service:
   - `SAKTTS_VOICE_ENGINE_URL=https://your-voxcpm-endpoint` (or `http://voxcpm-engine:8765` on the same Docker network)
   - `SAKTTS_VOICE_ENGINE_TOKEN=<shared-secret>` (optional Bearer token; set the same value on both services)
