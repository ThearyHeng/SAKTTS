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
