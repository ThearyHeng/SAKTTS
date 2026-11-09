import io
import os
import re
import sys
import json
import time
import fcntl
import math
import hashlib
import threading
import subprocess
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CKPT_DIR = os.path.join(BASE_DIR, "checkpoints")
HF_CACHE = os.path.join(CKPT_DIR, "hf_cache_voxcpm")
HF_HUB_DIR = os.path.join(HF_CACHE, "hub")
REF_TMP_DIR = os.path.join(CKPT_DIR, "tmp_refs")
os.makedirs(HF_HUB_DIR, exist_ok=True)
os.makedirs(REF_TMP_DIR, exist_ok=True)

# Keep all HF weights/caches inside .voice-engine/checkpoints and disable stalled XET downloads
os.environ["HF_HOME"] = HF_CACHE
os.environ["HF_HUB_CACHE"] = HF_HUB_DIR
os.environ["HF_HUB_DISABLE_XET"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

import numpy as np
import soundfile as sf
import librosa
import mlx.core as mx
from mlx_audio.tts import load as load_mlx_tts

HOST = os.environ.get("SAKTTS_ENGINE_HOST", "127.0.0.1")
PORT = int(os.environ.get("SAKTTS_ENGINE_PORT", "8765"))
MODEL_ID = os.environ.get("SAKTTS_VOXCPM_MODEL", "mlx-community/VoxCPM2-8bit")

# Keep MLX buffer cache bounded on 16 GB Apple Silicon unified memory
if hasattr(mx, "set_cache_limit"):
    mx.set_cache_limit(1536 * 1024 * 1024)


def load_mono_audio(file_path: str, target_sr: int) -> np.ndarray:
    ext = os.path.splitext(file_path)[1].lower()
    if ext in (".wav", ".flac"):
        try:
            y, orig_sr = sf.read(file_path, dtype="float32", always_2d=False)
            if y.ndim > 1:
                y = np.mean(y, axis=1)
            if orig_sr != target_sr:
                y = librosa.resample(y, orig_sr=orig_sr, target_sr=target_sr)
            return np.asarray(y, dtype=np.float32)
        except Exception:
            pass

    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        file_path,
        "-ar",
        str(target_sr),
        "-ac",
        "1",
        "-f",
        "wav",
        "pipe:1",
    ]
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    y, _ = sf.read(io.BytesIO(proc.stdout), dtype="float32", always_2d=False)
    if y.ndim > 1:
        y = np.mean(y, axis=1)
    return np.asarray(y, dtype=np.float32)


def extract_median_f0(y: np.ndarray, sr: int) -> float:
    if len(y) < sr * 0.25:
        return 0.0
    if sr != 16000:
        y = librosa.resample(y, orig_sr=sr, target_sr=16000)
        sr = 16000
    intervals = librosa.effects.split(y, top_db=30)
    voiced_y = np.concatenate([y[s:e] for s, e in intervals]) if len(intervals) > 0 else y
    if len(voiced_y) < int(sr * 0.2):
        voiced_y = y

    f0 = librosa.yin(voiced_y, fmin=55, fmax=420, sr=sr, frame_length=2048, hop_length=512)
    rms = librosa.feature.rms(y=voiced_y, frame_length=2048, hop_length=512)[0]
    min_len = min(len(f0), len(rms))
    if min_len == 0:
        return 0.0
    f0 = f0[:min_len]
    rms = rms[:min_len]
    thr = max(float(np.percentile(rms, 30)), 1e-4)
    mask = (rms > thr) & (f0 >= 60.0) & (f0 <= 400.0)
    valid = f0[mask]
    if len(valid) == 0:
        return 0.0
    return float(np.median(valid))


def analyze_audio(file_path: str) -> dict:
    sr = 16000
    y = load_mono_audio(file_path, sr)
    duration_sec = float(len(y) / sr) if len(y) > 0 else 0.0

    intervals = librosa.effects.split(y, top_db=30) if len(y) > 0 else np.empty((0, 2), dtype=int)
    speech_samples = int(sum(e - s for s, e in intervals))
    silence_ratio = float(max(0.02, min(0.9, 1.0 - (speech_samples / max(len(y), 1)))))

    voiced_y = np.concatenate([y[s:e] for s, e in intervals]) if len(intervals) > 0 else y
    if len(voiced_y) < 1024:
        voiced_y = y

    rms_val = float(np.sqrt(np.mean(np.square(voiced_y)))) if len(voiced_y) > 0 else 0.05
    peak_val = float(np.max(np.abs(voiced_y))) if len(voiced_y) > 0 else 0.5
    mean_db = float(20.0 * math.log10(max(rms_val, 1e-5)))
    max_db = float(20.0 * math.log10(max(peak_val, 1e-5)))
    dynamic_range_db = float(max(4.0, min(36.0, abs(max_db - mean_db))))

    median_f0 = extract_median_f0(voiced_y, sr)
    centroid = (
        float(np.median(librosa.feature.spectral_centroid(y=voiced_y, sr=sr)))
        if len(voiced_y) >= 2048
        else 1800.0
    )

    suggested_gender = "male" if (0.0 < median_f0 < 162.0) else "female"
    baseline_hz = 122.0 if suggested_gender == "male" else 208.0
    if median_f0 > 0:
        semi = 12.0 * math.log2(median_f0 / baseline_hz)
        suggested_pitch_semitones = round(max(-2.5, min(2.5, semi)), 2)
    else:
        suggested_pitch_semitones = -0.5 if suggested_gender == "male" else 0.4

    if (median_f0 > 0 and median_f0 < 125.0) or centroid < 1350.0:
        suggested_timbre = "deep"
    elif centroid > 2250.0:
        suggested_timbre = "bright"
    elif dynamic_range_db > 18.0:
        suggested_timbre = "crisp"
    elif silence_ratio > 0.28:
        suggested_timbre = "soft"
    else:
        suggested_timbre = "warm"

    return {
        "ok": True,
        "duration_sec": round(duration_sec, 2),
        "median_f0_hz": round(median_f0, 1),
        "spectral_centroid_hz": round(centroid, 1),
        "rms_level": round(rms_val, 4),
        "mean_volume_db": round(mean_db, 1),
        "max_volume_db": round(max_db, 1),
        "dynamic_range_db": round(dynamic_range_db, 1),
        "silence_ratio": round(silence_ratio, 3),
        "suggested_pitch_semitones": suggested_pitch_semitones,
        "suggested_timbre": suggested_timbre,
        "suggested_gender": suggested_gender,
    }


def split_text_segments(text: str) -> list[str]:
    """Split text along Khmer & English sentence boundaries to keep KV cache bounded and cadence crisp."""
    cleaned = re.sub(r"[ \t]+", " ", text.strip())
    if not cleaned:
        return []

    raw_pieces = re.split(r"(?<=[\n។៕!?])\s*|(?<=\.)(?=\s|$)|(?<=[។៕])", cleaned)
    pieces = [p.strip() for p in raw_pieces if p and p.strip()]
    if not pieces:
        return [cleaned]

    grouped: list[str] = []
    for piece in pieces:
        has_khmer = bool(re.search(r"[\u1780-\u17FF]", piece))
        limit = 210 if has_khmer else 360
        if len(piece) <= limit:
            if grouped and len(grouped[-1]) + len(piece) + 1 <= limit and len(grouped[-1]) < 45:
                grouped[-1] = f"{grouped[-1]} {piece}"
            else:
                grouped.append(piece)
        else:
            # Split very long run by commas/spaces without chopping mid-word
            words = piece.split(" ")
            cur = ""
            for w in words:
                cand = f"{cur} {w}".strip() if cur else w
                if len(cand) > limit and cur:
                    grouped.append(cur)
                    cur = w
                else:
                    cur = cand
            if cur:
                grouped.append(cur)

    return grouped


def apply_edge_fade(wave: np.ndarray, sr: int, fade_ms: float = 12.0) -> np.ndarray:
    fade_samples = min(int(sr * fade_ms / 1000.0), len(wave) // 4)
    if fade_samples <= 1:
        return wave
    out = wave.copy()
    fade_in = np.linspace(0.0, 1.0, fade_samples, dtype=np.float32)
    fade_out = np.linspace(1.0, 0.0, fade_samples, dtype=np.float32)
    out[:fade_samples] *= fade_in
    out[-fade_samples:] *= fade_out
    return out


class VoxCPMEngine:
    def __init__(self):
        self.device = "mlx"
        self.model_id = MODEL_ID
        self.ready = False
        self.loading = True
        self.error = None
        self.ready_event = threading.Event()
        self.infer_lock = threading.Lock()
        self.ref_cache: OrderedDict[str, tuple[str, float]] = OrderedDict()

        self.model = None
        self.sr = 48000

    def load_models_background(self):
        thread = threading.Thread(target=self._load_models, daemon=True)
        thread.start()

    def _resolve_local_or_repo(self) -> str:
        repo_dir = os.path.join(HF_HUB_DIR, f"models--{self.model_id.replace('/', '--')}", "snapshots")
        if os.path.isdir(repo_dir):
            snaps = sorted(os.listdir(repo_dir))
            for snap in reversed(snaps):
                cand = os.path.join(repo_dir, snap)
                if os.path.exists(os.path.join(cand, "config.json")):
                    return cand
        return self.model_id

    def _load_models(self):
        try:
            t0 = time.time()
            target = self._resolve_local_or_repo()
            model = load_mlx_tts(target)
            self.model = model
            self.sr = int(getattr(model, "sample_rate", 48000))
            self.ready = True
            self.loading = False
            self.ready_event.set()
            print(
                f"[SAKTTS VoxCPM2 Engine] Ready ({self.model_id}, sr={self.sr}Hz) in {time.time() - t0:.2f}s"
            )
        except Exception as exc:
            self.error = str(exc)
            self.loading = False
            self.ready_event.set()
            print(f"[SAKTTS VoxCPM2 Engine] Failed to load: {exc}", file=sys.stderr)

    def _prepare_ref_wav(self, audio_path: str, preserve_order: bool = False) -> tuple[str, float]:
        """Prepare a clean 16 kHz mono reference WAV for VoxCPM2 AudioVAE encoding."""
        stat = os.stat(audio_path)
        cache_key = f"{audio_path}:{stat.st_mtime_ns}:{stat.st_size}:{'full' if preserve_order else 'vad'}"
        if cache_key in self.ref_cache:
            cached_wav, cached_f0 = self.ref_cache[cache_key]
            if os.path.exists(cached_wav):
                self.ref_cache.move_to_end(cache_key)
                return cached_wav, cached_f0

        target_sr = 16000
        y = load_mono_audio(audio_path, target_sr)
        if len(y) == 0:
            raise ValueError("Reference audio contains no samples")

        if preserve_order:
            # Ultimate cloning: only trim leading/trailing silence so transcript alignment stays exact
            intervals = librosa.effects.split(y, top_db=35)
            if len(intervals) > 0:
                start = max(0, int(intervals[0][0]) - int(0.08 * target_sr))
                end = min(len(y), int(intervals[-1][1]) + int(0.08 * target_sr))
                cleaned = y[start:end]
            else:
                cleaned = y
            cleaned = cleaned[: int(target_sr * 14.0)]
        else:
            # Controllable cloning: keep up to 11s of clean active speech segments
            intervals = librosa.effects.split(y, top_db=28)
            gap = np.zeros(int(target_sr * 0.04), dtype=np.float32)
            segments = []
            total_len = 0
            max_samples = int(target_sr * 11.0)
            for s, e in intervals:
                seg = y[s:e]
                if len(seg) < int(target_sr * 0.08):
                    continue
                segments.append(seg)
                segments.append(gap)
                total_len += len(seg) + len(gap)
                if total_len >= max_samples:
                    break
            cleaned = np.concatenate(segments) if segments else y
            cleaned = cleaned[:max_samples]

        peak = float(np.max(np.abs(cleaned))) if len(cleaned) > 0 else 1.0
        if peak > 1e-4:
            cleaned = cleaned * (0.90 / peak)
        cleaned = np.asarray(cleaned, dtype=np.float32)

        digest = hashlib.sha256(cache_key.encode("utf-8")).hexdigest()[:16]
        out_wav = os.path.join(REF_TMP_DIR, f"ref-{digest}.wav")
        sf.write(out_wav, cleaned, target_sr)
        ref_f0 = extract_median_f0(cleaned, target_sr)

        self.ref_cache[cache_key] = (out_wav, ref_f0)
        while len(self.ref_cache) > 16:
            _, (old_wav, _) = self.ref_cache.popitem(last=False)
            try:
                if os.path.exists(old_wav):
                    os.unlink(old_wav)
            except OSError:
                pass

        return out_wav, ref_f0

    def synthesize(
        self,
        text: str,
        output_path: str,
        ref_audio_path: str | None = None,
        prompt_audio_path: str | None = None,
        prompt_text: str | None = None,
        instruct: str | None = None,
        inference_timesteps: int = 8,
        cfg_value: float = 2.0,
        speed: float = 1.0,
        pitch_shift: float = 0.0,
    ) -> dict:
        self.ready_event.wait(timeout=180)
        if not self.ready:
            raise RuntimeError(self.error or "VoxCPM2 model failed to load")

        clean_text = (text or "").strip()
        if not clean_text:
            raise ValueError("Text is required for synthesis")

        segments = split_text_segments(clean_text)
        if not segments:
            segments = [clean_text]

        steps = max(4, min(30, int(inference_timesteps)))
        cfg = max(2.0, min(3.0, float(cfg_value)))
        clean_instruct = (instruct or "").strip() or None
        clean_prompt_text = (prompt_text or "").strip() or None

        target_f0 = 0.0
        prepared_ref_wav = None
        prepared_prompt_wav = None
        synth_mode = "zero_shot"

        if ref_audio_path and os.path.exists(ref_audio_path) and clean_prompt_text:
            src_prompt = prompt_audio_path if (prompt_audio_path and os.path.exists(prompt_audio_path)) else ref_audio_path
            prepared_prompt_wav, target_f0 = self._prepare_ref_wav(src_prompt, preserve_order=True)
            prepared_ref_wav = prepared_prompt_wav
            synth_mode = "ultimate_clone"
        elif ref_audio_path and os.path.exists(ref_audio_path):
            prepared_ref_wav, target_f0 = self._prepare_ref_wav(ref_audio_path, preserve_order=False)
            synth_mode = "controllable_clone" if clean_instruct else "reference_clone"
        elif clean_instruct:
            synth_mode = "voice_design"

        t0 = time.time()
        rendered_chunks: list[np.ndarray] = []
        inter_gap = np.zeros(int(self.sr * 0.085), dtype=np.float32)

        with self.infer_lock:
            try:
                for idx, seg in enumerate(segments):
                    gen_kwargs: dict = {
                        "text": seg,
                        "inference_timesteps": steps,
                        "cfg_value": cfg,
                        "max_tokens": 1600,
                        "min_tokens": 2,
                    }

                    if synth_mode == "ultimate_clone":
                        gen_kwargs["ref_audio"] = prepared_ref_wav
                        gen_kwargs["prompt_audio"] = prepared_prompt_wav
                        gen_kwargs["prompt_text"] = clean_prompt_text
                        gen_kwargs["warmup_patches"] = 0
                    elif prepared_ref_wav:
                        gen_kwargs["ref_audio"] = prepared_ref_wav
                        if clean_instruct:
                            gen_kwargs["instruct"] = clean_instruct
                        gen_kwargs["warmup_patches"] = 1
                    else:
                        if clean_instruct:
                            gen_kwargs["instruct"] = clean_instruct
                        gen_kwargs["warmup_patches"] = 1

                    results = list(self.model.generate(**gen_kwargs))
                    if not results:
                        continue
                    audio_np = np.asarray(results[-1].audio, dtype=np.float32).flatten()
                    if len(audio_np) > 0:
                        audio_np = apply_edge_fade(audio_np, self.sr, fade_ms=10.0)
                        rendered_chunks.append(audio_np)
                        if idx < len(segments) - 1:
                            rendered_chunks.append(inter_gap)
            finally:
                mx.clear_cache()

        if not rendered_chunks:
            raise RuntimeError("VoxCPM2 produced empty audio")

        out_wave = np.concatenate(rendered_chunks).astype(np.float32)

        # Optional pitch shift only when explicitly requested
        if abs(float(pitch_shift)) >= 0.25:
            out_wave = librosa.effects.pitch_shift(out_wave, sr=self.sr, n_steps=float(pitch_shift))
            out_wave = np.asarray(out_wave, dtype=np.float32)

        # Gentle RMS/peak studio normalization
        rms = float(np.sqrt(np.mean(np.square(out_wave)))) if len(out_wave) > 0 else 0.0
        if rms > 1e-4:
            gain = min(0.095 / rms, 0.94 / max(float(np.max(np.abs(out_wave))), 1e-4))
            out_wave = np.clip(out_wave * gain, -0.96, 0.96).astype(np.float32)

        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        out_ext = os.path.splitext(output_path)[1].lower()
        needs_atempo = abs(float(speed) - 1.0) >= 0.03

        if out_ext == ".mp3" or needs_atempo:
            tmp_wav = output_path + ".tmp.wav"
            sf.write(tmp_wav, out_wave, self.sr)
            clamped_speed = max(0.7, min(1.3, float(speed)))
            af_args = ["-af", f"atempo={clamped_speed:.4f}"] if needs_atempo else []
            codec_args = (
                ["-c:a", "libmp3lame", "-q:a", "1"]
                if out_ext == ".mp3"
                else ["-c:a", "pcm_s16le"]
            )
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    tmp_wav,
                    *af_args,
                    "-ar",
                    str(self.sr),
                    "-ac",
                    "1",
                    *codec_args,
                    output_path,
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            if os.path.exists(tmp_wav):
                os.unlink(tmp_wav)
        else:
            sf.write(output_path, out_wave, self.sr)

        dur_sec = float(len(out_wave) / self.sr) / (max(0.7, min(1.3, float(speed))) if needs_atempo else 1.0)
        out_f0 = extract_median_f0(out_wave, self.sr)
        elapsed = time.time() - t0
        return {
            "ok": True,
            "output_path": output_path,
            "duration_sec": round(dur_sec, 2),
            "elapsed_sec": round(elapsed, 2),
            "sample_rate": self.sr,
            "target_f0_hz": round(target_f0, 1) if target_f0 else None,
            "output_f0_hz": round(out_f0, 1) if out_f0 else None,
            "mode": synth_mode,
            "model": self.model_id,
            "device": self.device,
        }


ENGINE = VoxCPMEngine()


class VoiceEngineHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def _send_json(self, code: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length > 0 else b"{}"
        return json.loads(raw.decode("utf-8"))

    def do_GET(self):
        if self.path == "/health":
            self._send_json(
                200,
                {
                    "ok": True,
                    "ready": ENGINE.ready,
                    "loading": ENGINE.loading,
                    "device": ENGINE.device,
                    "model": ENGINE.model_id,
                    "sample_rate": ENGINE.sr,
                    "error": ENGINE.error,
                },
            )
            return
        self._send_json(404, {"error": "Not found"})

    def do_POST(self):
        try:
            data = self._read_json()
            if self.path == "/analyze":
                file_path = data.get("file_path")
                if not file_path or not os.path.exists(file_path):
                    self._send_json(400, {"ok": False, "error": "Invalid file_path"})
                    return
                res = analyze_audio(file_path)
                self._send_json(200, res)
                return

            if self.path == "/synthesize":
                text = data.get("text")
                output_path = data.get("output_path")
                if not text or not output_path:
                    self._send_json(400, {"ok": False, "error": "text and output_path are required"})
                    return
                res = ENGINE.synthesize(
                    text=str(text),
                    output_path=str(output_path),
                    ref_audio_path=data.get("ref_audio_path"),
                    prompt_audio_path=data.get("prompt_audio_path"),
                    prompt_text=data.get("prompt_text"),
                    instruct=data.get("instruct"),
                    inference_timesteps=int(data.get("inference_timesteps", 8)),
                    cfg_value=float(data.get("cfg_value", 2.0)),
                    speed=float(data.get("speed", 1.0)),
                    pitch_shift=float(data.get("pitch_shift", 0.0)),
                )
                self._send_json(200, res)
                return

            self._send_json(404, {"ok": False, "error": "Not found"})
        except Exception as exc:
            self._send_json(500, {"ok": False, "error": str(exc)})


def main():
    lock_path = os.path.join(BASE_DIR, "server.lock")
    lock_fd = open(lock_path, "w")
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print("[SAKTTS VoxCPM2 Engine] Already running on another process; exiting cleanly.")
        sys.exit(0)

    ThreadingHTTPServer.allow_reuse_address = True
    try:
        server = ThreadingHTTPServer((HOST, PORT), VoiceEngineHandler)
    except OSError as exc:
        print(f"[SAKTTS VoxCPM2 Engine] Port {PORT} already in use ({exc}); exiting.")
        sys.exit(0)

    ENGINE.load_models_background()
    print(f"[SAKTTS VoxCPM2 Engine] Listening on http://{HOST}:{PORT} (model={MODEL_ID}, device=mlx)")
    server.serve_forever()


if __name__ == "__main__":
    main()
