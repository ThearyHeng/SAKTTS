import io
import os
import sys
import json
import time
import fcntl
import math
import threading
import subprocess
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SEED_VC_DIR = os.path.join(BASE_DIR, "seed-vc")
CKPT_DIR = os.path.join(BASE_DIR, "checkpoints")
HF_CACHE = os.path.join(CKPT_DIR, "hf_cache")
os.makedirs(HF_CACHE, exist_ok=True)

# Keep all HF/PyTorch weights & cache local to .voice-engine/checkpoints and avoid stalled XET streams
os.environ["HF_HOME"] = HF_CACHE
os.environ["HF_HUB_CACHE"] = HF_CACHE
os.environ["TORCH_HOME"] = CKPT_DIR
os.environ["HF_HUB_DISABLE_XET"] = "1"
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

if SEED_VC_DIR not in sys.path:
    sys.path.insert(0, SEED_VC_DIR)

import numpy as np
import soundfile as sf
import librosa
import torch
import torchaudio
import yaml
from huggingface_hub import hf_hub_download
from transformers import AutoFeatureExtractor, WhisperModel

from modules.commons import build_model, load_checkpoint, recursive_munch
from modules.campplus.DTDNN import CAMPPlus
from modules.bigvgan import bigvgan
from modules.audio import mel_spectrogram

HOST = os.environ.get("SAKTTS_ENGINE_HOST", "127.0.0.1")
PORT = int(os.environ.get("SAKTTS_ENGINE_PORT", "8765"))
USE_FP16 = os.environ.get("SAKTTS_ENGINE_FP16", "1") == "1"


def get_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


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


def prepare_reference_speech(ref_y: np.ndarray, sr: int, max_sec: float = 17.0) -> np.ndarray:
    intervals = librosa.effects.split(ref_y, top_db=28)
    gap = np.zeros(int(sr * 0.04), dtype=np.float32)
    segments = []
    total_len = 0
    max_samples = int(sr * max_sec)
    if len(intervals) > 0:
        for s, e in intervals:
            seg = ref_y[s:e]
            if len(seg) < int(sr * 0.08):
                continue
            segments.append(seg)
            segments.append(gap)
            total_len += len(seg) + len(gap)
            if total_len >= max_samples:
                break
    cleaned = np.concatenate(segments) if segments else ref_y
    cleaned = cleaned[:max_samples]
    peak = float(np.max(np.abs(cleaned))) if len(cleaned) > 0 else 1.0
    if peak > 1e-4:
        cleaned = cleaned * (0.92 / peak)
    return np.asarray(cleaned, dtype=np.float32)


def crossfade(chunk1: np.ndarray, chunk2: np.ndarray, overlap: int) -> np.ndarray:
    fade_out = np.cos(np.linspace(0, np.pi / 2, overlap)) ** 2
    fade_in = np.cos(np.linspace(np.pi / 2, 0, overlap)) ** 2
    if len(chunk2) < overlap:
        chunk2[:overlap] = chunk2[:overlap] * fade_in[:len(chunk2)] + (chunk1[-overlap:] * fade_out)[:len(chunk2)]
    else:
        chunk2[:overlap] = chunk2[:overlap] * fade_in + chunk1[-overlap:] * fade_out
    return chunk2


class SeedVCEngine:
    def __init__(self):
        self.device = get_device()
        self.ready = False
        self.loading = True
        self.error = None
        self.ready_event = threading.Event()
        self.infer_lock = threading.Lock()
        self.ref_cache: OrderedDict = OrderedDict()

        self.model = None
        self.campplus = None
        self.vocoder = None
        self.whisper_model = None
        self.whisper_fe = None
        self.sr = 22050
        self.hop_length = 256
        self.mel_fn_args = None

    def load_models_background(self):
        thread = threading.Thread(target=self._load_models, daemon=True)
        thread.start()

    def _load_models(self):
        try:
            os.chdir(SEED_VC_DIR)
            t0 = time.time()
            dit_ckpt = hf_hub_download(
                "Plachta/Seed-VC",
                "DiT_seed_v2_uvit_whisper_small_wavenet_bigvgan_pruned.pth",
                cache_dir=HF_CACHE,
            )
            dit_cfg = hf_hub_download(
                "Plachta/Seed-VC",
                "config_dit_mel_seed_uvit_whisper_small_wavenet.yml",
                cache_dir=HF_CACHE,
            )
            config = yaml.safe_load(open(dit_cfg, "r"))
            model_params = recursive_munch(config["model_params"])
            model_params.dit_type = "DiT"

            model = build_model(model_params, stage="DiT")
            model, _, _, _ = load_checkpoint(
                model,
                None,
                dit_ckpt,
                load_only_params=True,
                ignore_modules=[],
                is_distributed=False,
            )
            for key in model:
                model[key].eval()
                model[key].to(self.device)
            model.cfm.estimator.setup_caches(max_batch_size=1, max_seq_length=8192)

            local_campplus = os.path.join(SEED_VC_DIR, "campplus_cn_common.bin")
            if os.path.exists(local_campplus) and os.path.getsize(local_campplus) > 1_000_000:
                campplus_path = local_campplus
            else:
                campplus_path = hf_hub_download(
                    "funasr/campplus", "campplus_cn_common.bin", cache_dir=HF_CACHE
                )
            campplus = CAMPPlus(feat_dim=80, embedding_size=192)
            campplus.load_state_dict(torch.load(campplus_path, map_location="cpu"))
            campplus.eval().to(self.device)

            bigvgan_name = model_params.vocoder.name
            vocoder = bigvgan.BigVGAN.from_pretrained(
                bigvgan_name, use_cuda_kernel=False, cache_dir=HF_CACHE
            )
            vocoder.remove_weight_norm()
            vocoder = vocoder.eval().to(self.device)

            whisper_name = model_params.speech_tokenizer.name
            whisper_model = WhisperModel.from_pretrained(
                whisper_name, torch_dtype=torch.float32, cache_dir=HF_CACHE
            ).to(self.device)
            del whisper_model.decoder
            whisper_fe = AutoFeatureExtractor.from_pretrained(whisper_name, cache_dir=HF_CACHE)

            self.sr = int(config["preprocess_params"]["sr"])
            self.hop_length = int(config["preprocess_params"]["spect_params"]["hop_length"])
            self.mel_fn_args = {
                "n_fft": config["preprocess_params"]["spect_params"]["n_fft"],
                "win_size": config["preprocess_params"]["spect_params"]["win_length"],
                "hop_size": self.hop_length,
                "num_mels": config["preprocess_params"]["spect_params"]["n_mels"],
                "sampling_rate": self.sr,
                "fmin": config["preprocess_params"]["spect_params"].get("fmin", 0),
                "fmax": None
                if config["preprocess_params"]["spect_params"].get("fmax", "None") == "None"
                else 8000,
                "center": False,
            }

            self.model = model
            self.campplus = campplus
            self.vocoder = vocoder
            self.whisper_model = whisper_model
            self.whisper_fe = whisper_fe
            self.ready = True
            self.loading = False
            self.ready_event.set()
            print(f"[SAKTTS Voice Engine] Seed-VC ready on {self.device} in {time.time() - t0:.2f}s")
        except Exception as exc:
            self.error = str(exc)
            self.loading = False
            self.ready_event.set()
            print(f"[SAKTTS Voice Engine] Load error: {exc}", file=sys.stderr)

    @torch.no_grad()
    def _semantic_features(self, waves_16k: torch.Tensor) -> torch.Tensor:
        inputs = self.whisper_fe(
            [waves_16k.squeeze(0).cpu().numpy()],
            sampling_rate=16000,
            return_tensors="pt",
            return_attention_mask=True,
        )
        feats = self.whisper_model._mask_input_features(
            inputs.input_features, attention_mask=inputs.attention_mask
        ).to(self.device)
        out = self.whisper_model.encoder(
            feats.to(self.whisper_model.encoder.dtype),
            head_mask=None,
            output_attentions=False,
            output_hidden_states=False,
            return_dict=True,
        )
        S = out.last_hidden_state.to(torch.float32)
        return S[:, : waves_16k.size(-1) // 320 + 1]

    @torch.no_grad()
    def _get_reference_conditioning(self, target_path: str):
        stat = os.stat(target_path)
        cache_key = (os.path.abspath(target_path), stat.st_mtime_ns, stat.st_size)
        if cache_key in self.ref_cache:
            self.ref_cache.move_to_end(cache_key)
            return self.ref_cache[cache_key]

        raw_ref = load_mono_audio(target_path, self.sr)
        clean_ref = prepare_reference_speech(raw_ref, self.sr, max_sec=17.0)
        ref_f0 = extract_median_f0(clean_ref, self.sr)

        ref_t = torch.tensor(clean_ref).unsqueeze(0).float().to(self.device)
        ref_16k = torchaudio.functional.resample(ref_t, self.sr, 16000)

        if ref_16k.size(-1) <= 16000 * 30:
            S_ori = self._semantic_features(ref_16k)
        else:
            S_ori = self._semantic_features(ref_16k[:, : 16000 * 30])

        mel2 = mel_spectrogram(ref_t, **self.mel_fn_args)
        target2_lengths = torch.LongTensor([mel2.size(2)]).to(self.device)

        feat2 = torchaudio.compliance.kaldi.fbank(
            ref_16k.cpu(), num_mel_bins=80, dither=0, sample_frequency=16000
        ).to(self.device)
        feat2 = feat2 - feat2.mean(dim=0, keepdim=True)
        style2 = self.campplus(feat2.unsqueeze(0))

        prompt_condition, *_ = self.model.length_regulator(
            S_ori, ylens=target2_lengths, n_quantizers=3, f0=None
        )

        entry = (mel2, prompt_condition, style2, ref_f0)
        self.ref_cache[cache_key] = entry
        if len(self.ref_cache) > 16:
            self.ref_cache.popitem(last=False)
        return entry

    def convert(
        self,
        source_path: str,
        target_path: str,
        output_path: str,
        diffusion_steps: int = 28,
        inference_cfg_rate: float = 0.7,
        length_adjust: float = 1.0,
        pitch_shift: float = 0.0,
    ) -> dict:
        if not self.ready_event.wait(timeout=120):
            raise RuntimeError("Seed-VC model initialization timed out")
        if not self.ready:
            raise RuntimeError(self.error or "Seed-VC failed to initialize")

        t0 = time.time()
        src_y = load_mono_audio(source_path, self.sr)
        if len(src_y) < int(self.sr * 0.05):
            raise ValueError("Source audio is empty or too short")

        src_peak = float(np.max(np.abs(src_y)))
        if src_peak > 1e-4:
            src_y = np.asarray(src_y * (0.92 / src_peak), dtype=np.float32)
        src_f0 = extract_median_f0(src_y, self.sr)

        with self.infer_lock:
            with torch.no_grad():
                mel2, prompt_condition, style2, target_f0 = self._get_reference_conditioning(
                    target_path
                )

                src_t = torch.tensor(src_y).unsqueeze(0).float().to(self.device)
                converted_16k = torchaudio.functional.resample(src_t, self.sr, 16000)

                if converted_16k.size(-1) <= 16000 * 30:
                    S_alt = self._semantic_features(converted_16k)
                else:
                    overlapping_time = 5
                    S_alt_list = []
                    buffer = None
                    traversed_time = 0
                    while traversed_time < converted_16k.size(-1):
                        if buffer is None:
                            chunk = converted_16k[:, traversed_time : traversed_time + 16000 * 30]
                        else:
                            chunk = torch.cat(
                                [
                                    buffer,
                                    converted_16k[
                                        :,
                                        traversed_time : traversed_time
                                        + 16000 * (30 - overlapping_time),
                                    ],
                                ],
                                dim=-1,
                            )
                        S_chunk = self._semantic_features(chunk)
                        if traversed_time == 0:
                            S_alt_list.append(S_chunk)
                        else:
                            S_alt_list.append(S_chunk[:, 50 * overlapping_time :])
                        buffer = chunk[:, -16000 * overlapping_time :]
                        traversed_time += (
                            30 * 16000
                            if traversed_time == 0
                            else chunk.size(-1) - 16000 * overlapping_time
                        )
                    S_alt = torch.cat(S_alt_list, dim=1)

                mel = mel_spectrogram(src_t, **self.mel_fn_args)
                target_lengths = torch.LongTensor([max(1, int(mel.size(2) * length_adjust))]).to(
                    self.device
                )

                cond, *_ = self.model.length_regulator(
                    S_alt, ylens=target_lengths, n_quantizers=3, f0=None
                )

                max_context_window = (self.sr // self.hop_length) * 30
                overlap_frame_len = 16
                overlap_wave_len = overlap_frame_len * self.hop_length
                max_source_window = max(400, max_context_window - mel2.size(2))

                processed_frames = 0
                generated_chunks = []
                previous_chunk = None
                amp_dtype = torch.float16 if USE_FP16 else torch.float32

                while processed_frames < cond.size(1):
                    chunk_cond = cond[:, processed_frames : processed_frames + max_source_window]
                    is_last = processed_frames + max_source_window >= cond.size(1)
                    cat_cond = torch.cat([prompt_condition, chunk_cond], dim=1)

                    if USE_FP16 and self.device.type in ("cuda", "mps"):
                        with torch.autocast(device_type=self.device.type, dtype=amp_dtype):
                            vc_target = self.model.cfm.inference(
                                cat_cond,
                                torch.LongTensor([cat_cond.size(1)]).to(self.device),
                                mel2,
                                style2,
                                None,
                                int(diffusion_steps),
                                inference_cfg_rate=float(inference_cfg_rate),
                            )
                            vc_target = vc_target[:, :, mel2.size(-1) :]
                        if torch.isnan(vc_target).any():
                            vc_target = self.model.cfm.inference(
                                cat_cond,
                                torch.LongTensor([cat_cond.size(1)]).to(self.device),
                                mel2,
                                style2,
                                None,
                                int(diffusion_steps),
                                inference_cfg_rate=float(inference_cfg_rate),
                            )
                            vc_target = vc_target[:, :, mel2.size(-1) :]
                    else:
                        vc_target = self.model.cfm.inference(
                            cat_cond,
                            torch.LongTensor([cat_cond.size(1)]).to(self.device),
                            mel2,
                            style2,
                            None,
                            int(diffusion_steps),
                            inference_cfg_rate=float(inference_cfg_rate),
                        )
                        vc_target = vc_target[:, :, mel2.size(-1) :]

                    vc_wave = self.vocoder(vc_target.float()).squeeze()
                    if vc_wave.ndim == 0:
                        vc_wave = vc_wave.unsqueeze(0)
                    vc_np = vc_wave.detach().cpu().numpy()

                    if processed_frames == 0:
                        if is_last or len(vc_np) <= overlap_wave_len:
                            generated_chunks.append(vc_np)
                            break
                        generated_chunks.append(vc_np[:-overlap_wave_len])
                        previous_chunk = vc_np[-overlap_wave_len:]
                        processed_frames += vc_target.size(2) - overlap_frame_len
                    elif is_last:
                        generated_chunks.append(
                            crossfade(previous_chunk, vc_np, overlap_wave_len)
                        )
                        break
                    else:
                        generated_chunks.append(
                            crossfade(previous_chunk, vc_np[:-overlap_wave_len], overlap_wave_len)
                        )
                        previous_chunk = vc_np[-overlap_wave_len:]
                        processed_frames += vc_target.size(2) - overlap_frame_len

        out_wave = np.concatenate(generated_chunks).astype(np.float32)

        if abs(float(pitch_shift)) >= 0.25:
            out_wave = librosa.effects.pitch_shift(out_wave, sr=self.sr, n_steps=float(pitch_shift))
            out_wave = np.asarray(out_wave, dtype=np.float32)

        # Gentle RMS & peak normalization so output matches studio loudness without clipping
        rms = float(np.sqrt(np.mean(np.square(out_wave)))) if len(out_wave) > 0 else 0.0
        if rms > 1e-4:
            gain = min(0.085 / rms, 0.94 / max(float(np.max(np.abs(out_wave))), 1e-4))
            out_wave = np.clip(out_wave * gain, -0.96, 0.96).astype(np.float32)

        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        out_ext = os.path.splitext(output_path)[1].lower()
        if out_ext == ".mp3":
            tmp_wav = output_path + ".tmp.wav"
            sf.write(tmp_wav, out_wave, self.sr)
            subprocess.run(
                ["ffmpeg", "-y", "-i", tmp_wav, "-ar", "24000", "-ac", "1", "-c:a", "libmp3lame", "-q:a", "2", output_path],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            if os.path.exists(tmp_wav):
                os.unlink(tmp_wav)
        else:
            sf.write(output_path, out_wave, self.sr)

        out_f0 = extract_median_f0(out_wave, self.sr)
        elapsed = time.time() - t0
        return {
            "ok": True,
            "output_path": output_path,
            "duration_sec": round(len(out_wave) / self.sr, 2),
            "elapsed_sec": round(elapsed, 2),
            "source_f0_hz": round(src_f0, 1),
            "target_f0_hz": round(target_f0, 1),
            "output_f0_hz": round(out_f0, 1),
            "device": str(self.device),
        }


ENGINE = SeedVCEngine()


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
                    "device": str(ENGINE.device),
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

            if self.path == "/convert":
                source_path = data.get("source_path")
                target_path = data.get("target_path")
                output_path = data.get("output_path")
                if not source_path or not target_path or not output_path:
                    self._send_json(
                        400, {"ok": False, "error": "source_path, target_path, and output_path are required"}
                    )
                    return
                res = ENGINE.convert(
                    source_path=source_path,
                    target_path=target_path,
                    output_path=output_path,
                    diffusion_steps=int(data.get("diffusion_steps", 28)),
                    inference_cfg_rate=float(data.get("inference_cfg_rate", 0.7)),
                    length_adjust=float(data.get("length_adjust", 1.0)),
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
        print("[SAKTTS Voice Engine] Already running on another process; exiting cleanly.")
        sys.exit(0)

    ThreadingHTTPServer.allow_reuse_address = True
    try:
        server = ThreadingHTTPServer((HOST, PORT), VoiceEngineHandler)
    except OSError as exc:
        print(f"[SAKTTS Voice Engine] Port {PORT} already in use ({exc}); exiting.")
        sys.exit(0)

    ENGINE.load_models_background()
    print(f"[SAKTTS Voice Engine] Listening on http://{HOST}:{PORT} (device={ENGINE.device})")
    server.serve_forever()


if __name__ == "__main__":
    main()
