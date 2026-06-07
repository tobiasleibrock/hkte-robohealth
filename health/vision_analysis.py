#!/usr/bin/env python3
"""
Video-based health screening analysis for the Hong Kong HealthBot project.

This module estimates measurements that are realistic from raw RGB video and
marks measurements that need extra hardware. It is intended for demo/screening
workflows, not diagnosis or clinical decision making.

Core video measurements:
  - Face rPPG heart rate from RGB face video using POS/CHROM-style processing.
  - Approximate pulse irregularity and HRV proxies from rPPG peak intervals.
  - Respiratory rate from low-frequency motion in a chest/torso ROI.
  - Respiratory-rate fallback from low-frequency rPPG modulation.
  - Facial color metrics for pallor/redness/yellowness screening.
  - Blink rate and eye-aspect-ratio fatigue proxy when MediaPipe is installed.
  - Basic pixel-space pupillometry when a close face/eye view is present.
  - Basic gait/frailty motion proxies when full-body pose landmarks are visible.

Optional dependencies:
  pip install opencv-python numpy scipy mediapipe
"""

from __future__ import annotations

import argparse
import json
import math
import statistics
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Iterable, Optional

try:
    import cv2
except ImportError as exc:  # pragma: no cover - exercised at runtime
    raise SystemExit("opencv-python is required: pip install opencv-python") from exc

try:
    import numpy as np
except ImportError as exc:  # pragma: no cover - exercised at runtime
    raise SystemExit("numpy is required: pip install numpy") from exc

try:
    from scipy import signal
except ImportError:  # pragma: no cover - graceful fallback
    signal = None

try:
    import mediapipe as mp
except ImportError:  # pragma: no cover - optional feature
    mp = None


MIN_RPPG_SECONDS = 12.0
DEFAULT_MAX_FRAMES = 3600


@dataclass
class Estimate:
    value: Optional[float]
    unit: str
    confidence: str
    method: str
    limitations: list[str] = field(default_factory=list)


@dataclass
class VideoMetadata:
    path: str
    fps: float
    frames_processed: int
    duration_seconds: float
    width: int
    height: int


@dataclass
class AnalysisResult:
    video: VideoMetadata
    estimates: dict[str, Estimate]
    metrics: dict[str, Any]
    non_video_measurements: dict[str, str]
    warnings: list[str]

    def to_json(self) -> str:
        payload = asdict(self)
        return json.dumps(payload, indent=2, sort_keys=True)


def _median(values: Iterable[float], default: float = 0.0) -> float:
    values = [float(v) for v in values if math.isfinite(float(v))]
    return statistics.median(values) if values else default


def _bandpass(data: np.ndarray, fps: float, low_hz: float, high_hz: float) -> np.ndarray:
    data = np.asarray(data, dtype=np.float64)
    if data.size < 8:
        return data - np.mean(data)
    data = data - np.mean(data)
    if signal is None:
        return data

    nyquist = fps / 2.0
    if high_hz >= nyquist:
        high_hz = nyquist * 0.95
    if low_hz <= 0 or low_hz >= high_hz:
        return data

    b, a = signal.butter(3, [low_hz / nyquist, high_hz / nyquist], btype="bandpass")
    padlen = min(data.size - 1, 3 * max(len(a), len(b)))
    if padlen <= 0:
        return data
    return signal.filtfilt(b, a, data, padlen=padlen)


def _dominant_rate_bpm(trace: np.ndarray, fps: float, low_bpm: float, high_bpm: float) -> tuple[Optional[float], float]:
    trace = np.asarray(trace, dtype=np.float64)
    trace = trace[np.isfinite(trace)]
    if trace.size < max(8, int(fps * 4)):
        return None, 0.0

    low_hz = low_bpm / 60.0
    high_hz = high_bpm / 60.0
    filtered = _bandpass(trace, fps, low_hz, high_hz)

    if signal is not None:
        freqs, power = signal.welch(filtered, fs=fps, nperseg=min(filtered.size, int(fps * 12)))
    else:
        power = np.abs(np.fft.rfft(filtered)) ** 2
        freqs = np.fft.rfftfreq(filtered.size, d=1.0 / fps)

    mask = (freqs >= low_hz) & (freqs <= high_hz)
    if not np.any(mask):
        return None, 0.0

    band_freqs = freqs[mask]
    band_power = power[mask]
    peak_index = int(np.argmax(band_power))
    total_power = float(np.sum(band_power))
    confidence_score = float(band_power[peak_index] / total_power) if total_power > 0 else 0.0
    return float(band_freqs[peak_index] * 60.0), confidence_score


def _confidence_from_score(score: float, minimum: float = 0.18, strong: float = 0.35) -> str:
    if score >= strong:
        return "high"
    if score >= minimum:
        return "medium"
    return "low"


class FaceTracker:
    def __init__(self) -> None:
        self.cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        self.last_face: Optional[tuple[int, int, int, int]] = None

    def detect(self, gray: np.ndarray) -> Optional[tuple[int, int, int, int]]:
        faces = self.cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(80, 80))
        if len(faces) == 0:
            return self.last_face
        x, y, w, h = max(faces, key=lambda box: box[2] * box[3])
        self.last_face = (int(x), int(y), int(w), int(h))
        return self.last_face


class OptionalMediaPipe:
    def __init__(self, use_mediapipe: bool) -> None:
        self.enabled = bool(use_mediapipe and mp is not None)
        self.face_mesh = None
        self.pose = None
        if self.enabled:
            self.face_mesh = mp.solutions.face_mesh.FaceMesh(  # type: ignore[union-attr]
                static_image_mode=False,
                refine_landmarks=True,
                max_num_faces=1,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
            self.pose = mp.solutions.pose.Pose(  # type: ignore[union-attr]
                static_image_mode=False,
                model_complexity=1,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )

    def close(self) -> None:
        if self.face_mesh is not None:
            self.face_mesh.close()
        if self.pose is not None:
            self.pose.close()


def _skin_roi_from_face(frame: np.ndarray, face: tuple[int, int, int, int]) -> Optional[np.ndarray]:
    x, y, w, h = face
    # Use cheek/forehead-heavy central face while avoiding hair, mouth, and image edges.
    x0 = max(0, x + int(w * 0.25))
    x1 = min(frame.shape[1], x + int(w * 0.75))
    y0 = max(0, y + int(h * 0.18))
    y1 = min(frame.shape[0], y + int(h * 0.58))
    if x1 <= x0 or y1 <= y0:
        return None
    return frame[y0:y1, x0:x1]


def _torso_roi_from_face(frame: np.ndarray, face: tuple[int, int, int, int]) -> Optional[np.ndarray]:
    x, y, w, h = face
    x0 = max(0, x - int(w * 0.35))
    x1 = min(frame.shape[1], x + int(w * 1.35))
    y0 = min(frame.shape[0], y + int(h * 1.05))
    y1 = min(frame.shape[0], y + int(h * 2.35))
    if x1 <= x0 or y1 <= y0 or (y1 - y0) < 20:
        return None
    return frame[y0:y1, x0:x1]


def _mean_rgb(roi_bgr: np.ndarray) -> Optional[np.ndarray]:
    if roi_bgr is None or roi_bgr.size == 0:
        return None
    roi_rgb = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2RGB)
    return np.mean(roi_rgb.reshape(-1, 3), axis=0)


def _pos_rppg(rgb_series: np.ndarray, fps: float) -> np.ndarray:
    rgb = np.asarray(rgb_series, dtype=np.float64)
    if rgb.shape[0] < max(8, int(fps * 4)):
        return np.array([], dtype=np.float64)

    eps = 1e-8
    normalized = rgb / (np.mean(rgb, axis=0, keepdims=True) + eps) - 1.0
    x = normalized[:, 0] - normalized[:, 1]
    y = normalized[:, 0] + normalized[:, 1] - 2.0 * normalized[:, 2]
    alpha = np.std(x) / (np.std(y) + eps)
    pulse = x - alpha * y
    return _bandpass(pulse, fps, 0.7, 3.0)


def _chrom_rppg(rgb_series: np.ndarray, fps: float) -> np.ndarray:
    rgb = np.asarray(rgb_series, dtype=np.float64)
    if rgb.shape[0] < max(8, int(fps * 4)):
        return np.array([], dtype=np.float64)

    eps = 1e-8
    normalized = rgb / (np.mean(rgb, axis=0, keepdims=True) + eps) - 1.0
    x = 2.0 * normalized[:, 0] - normalized[:, 1] - normalized[:, 2]
    y = normalized[:, 0] - 2.0 * normalized[:, 1] + normalized[:, 2]
    alpha = np.std(x) / (np.std(y) + eps)
    pulse = x - alpha * y
    return _bandpass(pulse, fps, 0.7, 3.0)


def _rppg_hrv(pulse: np.ndarray, fps: float) -> dict[str, Optional[float]]:
    if pulse.size < max(8, int(fps * MIN_RPPG_SECONDS)):
        return {"rmssd_ms": None, "sdnn_ms": None, "pulse_irregularity_index": None}

    filtered = _bandpass(pulse, fps, 0.7, 3.0)
    min_distance = max(1, int(fps * 0.33))
    prominence = max(1e-8, float(np.std(filtered) * 0.45))
    if signal is not None:
        peaks, _ = signal.find_peaks(filtered, distance=min_distance, prominence=prominence)
    else:
        peaks = np.array(
            [
                i
                for i in range(1, filtered.size - 1)
                if filtered[i - 1] < filtered[i] > filtered[i + 1]
            ],
            dtype=int,
        )
    if peaks.size < 5:
        return {"rmssd_ms": None, "sdnn_ms": None, "pulse_irregularity_index": None}

    intervals_ms = np.diff(peaks) / fps * 1000.0
    intervals_ms = intervals_ms[(intervals_ms >= 300.0) & (intervals_ms <= 1500.0)]
    if intervals_ms.size < 4:
        return {"rmssd_ms": None, "sdnn_ms": None, "pulse_irregularity_index": None}

    diffs = np.diff(intervals_ms)
    rmssd = float(np.sqrt(np.mean(diffs * diffs)))
    sdnn = float(np.std(intervals_ms, ddof=1)) if intervals_ms.size > 1 else None
    irregularity = float(np.std(intervals_ms) / (np.mean(intervals_ms) + 1e-8))
    return {"rmssd_ms": rmssd, "sdnn_ms": sdnn, "pulse_irregularity_index": irregularity}


def _frame_motion_trace(rois: list[np.ndarray]) -> np.ndarray:
    if len(rois) < 2:
        return np.array([], dtype=np.float64)
    values: list[float] = []
    previous = cv2.cvtColor(rois[0], cv2.COLOR_BGR2GRAY)
    previous = cv2.GaussianBlur(previous, (5, 5), 0)
    for roi in rois[1:]:
        current = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        current = cv2.GaussianBlur(current, (5, 5), 0)
        if current.shape != previous.shape:
            previous = current
            continue
        diff = cv2.absdiff(current, previous)
        values.append(float(np.mean(diff)))
        previous = current
    return np.asarray(values, dtype=np.float64)


def _vertical_optical_flow_trace(rois: list[np.ndarray]) -> np.ndarray:
    if len(rois) < 2:
        return np.array([], dtype=np.float64)
    values: list[float] = []
    previous = cv2.cvtColor(rois[0], cv2.COLOR_BGR2GRAY)
    previous = cv2.GaussianBlur(previous, (5, 5), 0)
    for roi in rois[1:]:
        current = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        current = cv2.GaussianBlur(current, (5, 5), 0)
        if current.shape != previous.shape:
            previous = current
            continue
        flow = cv2.calcOpticalFlowFarneback(previous, current, None, 0.5, 3, 21, 3, 5, 1.2, 0)
        values.append(float(np.median(flow[:, :, 1])))
        previous = current
    return np.asarray(values, dtype=np.float64)


def _facial_color_metrics(rgb_series: np.ndarray) -> dict[str, Optional[float]]:
    if rgb_series.size == 0:
        return {
            "mean_red": None,
            "mean_green": None,
            "mean_blue": None,
            "brightness": None,
            "red_green_ratio": None,
            "blue_green_ratio": None,
            "relative_redness": None,
            "relative_yellowness_index": None,
            "pallor_index": None,
            "relative_pallor_index": None,
        }

    mean_rgb = np.mean(rgb_series, axis=0)
    red, green, blue = [float(v) for v in mean_rgb]
    brightness = float(np.mean(mean_rgb))
    rg = red / (green + 1e-8)
    bg = blue / (green + 1e-8)
    total = max(red + green + blue, 1e-8)
    relative_redness = red / total
    relative_pallor = 1.0 - (red - blue) / 255.0
    relative_yellowness = (red + green - 2.0 * blue) / 510.0
    # Screening-only proxy: lower red/green and lower brightness can be consistent with pallor.
    pallor_index = float((1.0 / (rg + 1e-8)) * (1.0 / (brightness + 1e-8)) * 100.0)
    return {
        "mean_red": red,
        "mean_green": green,
        "mean_blue": blue,
        "brightness": brightness,
        "red_green_ratio": float(rg),
        "blue_green_ratio": float(bg),
        "relative_redness": float(relative_redness),
        "relative_yellowness_index": float(np.clip(relative_yellowness, -1.0, 1.0)),
        "pallor_index": pallor_index,
        "relative_pallor_index": float(np.clip(relative_pallor, 0.0, 1.5)),
    }


def _landmark_xy(landmarks: Any, index: int, width: int, height: int) -> np.ndarray:
    lm = landmarks[index]
    return np.array([lm.x * width, lm.y * height], dtype=np.float64)


def _eye_aspect_ratio(landmarks: Any, width: int, height: int, eye: str) -> Optional[float]:
    # MediaPipe Face Mesh landmarks around each eye.
    indices = {
        "left": (33, 160, 158, 133, 153, 144),
        "right": (362, 385, 387, 263, 373, 380),
    }[eye]
    try:
        p1, p2, p3, p4, p5, p6 = [_landmark_xy(landmarks, i, width, height) for i in indices]
    except Exception:
        return None
    horizontal = np.linalg.norm(p1 - p4)
    vertical = np.linalg.norm(p2 - p6) + np.linalg.norm(p3 - p5)
    if horizontal <= 1e-8:
        return None
    return float(vertical / (2.0 * horizontal))


def _pose_metric(landmarks: Any, width: int, height: int) -> dict[str, Optional[float]]:
    indices = {
        "left_shoulder": 11,
        "right_shoulder": 12,
        "left_hip": 23,
        "right_hip": 24,
        "left_ankle": 27,
        "right_ankle": 28,
    }
    pts: dict[str, np.ndarray] = {}
    for name, index in indices.items():
        lm = landmarks[index]
        if getattr(lm, "visibility", 1.0) < 0.45:
            return {"torso_sway_px": None, "ankle_separation_px": None, "body_center_x": None}
        pts[name] = np.array([lm.x * width, lm.y * height], dtype=np.float64)

    shoulder_center = (pts["left_shoulder"] + pts["right_shoulder"]) / 2.0
    hip_center = (pts["left_hip"] + pts["right_hip"]) / 2.0
    ankle_sep = float(np.linalg.norm(pts["left_ankle"] - pts["right_ankle"]))
    center = (shoulder_center + hip_center) / 2.0
    return {
        "torso_sway_px": float(center[0]),
        "ankle_separation_px": ankle_sep,
        "body_center_x": float(center[0]),
    }


def _blink_stats(eye_trace: list[float], fps: float, duration_seconds: float) -> dict[str, Optional[float]]:
    if len(eye_trace) < max(10, int(fps * 5)):
        return {"blink_count": None, "blink_rate_per_min": None, "mean_eye_aspect_ratio": None}
    arr = np.asarray(eye_trace, dtype=np.float64)
    threshold = max(0.12, float(np.percentile(arr, 20)))
    closed = arr < threshold
    blink_count = 0
    in_blink = False
    for state in closed:
        if state and not in_blink:
            blink_count += 1
            in_blink = True
        elif not state:
            in_blink = False
    rate = float(blink_count / max(duration_seconds, 1e-8) * 60.0)
    return {
        "blink_count": float(blink_count),
        "blink_rate_per_min": rate,
        "mean_eye_aspect_ratio": float(np.mean(arr)),
    }


def _pupil_radius_from_face(frame: np.ndarray, face: tuple[int, int, int, int]) -> Optional[float]:
    x, y, w, h = face
    eye_band = frame[
        max(0, y + int(0.22 * h)) : min(frame.shape[0], y + int(0.45 * h)),
        max(0, x + int(0.12 * w)) : min(frame.shape[1], x + int(0.88 * w)),
    ]
    if eye_band.size == 0:
        return None

    gray = cv2.cvtColor(eye_band, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    circles = cv2.HoughCircles(
        gray,
        cv2.HOUGH_GRADIENT,
        dp=1.4,
        minDist=max(12, int(w * 0.18)),
        param1=70,
        param2=14,
        minRadius=max(2, int(w * 0.015)),
        maxRadius=max(4, int(w * 0.07)),
    )
    if circles is None:
        return None

    radii = [float(c[2]) for c in np.round(circles[0, :]).astype(int)]
    return float(statistics.median(radii)) if radii else None


def _gait_stats(pose_trace: list[dict[str, Optional[float]]], fps: float) -> dict[str, Optional[float]]:
    ankle = np.asarray([p["ankle_separation_px"] for p in pose_trace if p["ankle_separation_px"] is not None], dtype=np.float64)
    center = np.asarray([p["body_center_x"] for p in pose_trace if p["body_center_x"] is not None], dtype=np.float64)
    if ankle.size < max(10, int(fps * 4)):
        return {
            "step_rate_per_min": None,
            "ankle_separation_variability_px": None,
            "lateral_sway_px": None,
        }

    step_rate, step_score = _dominant_rate_bpm(ankle, fps, 40.0, 180.0)
    return {
        "step_rate_per_min": step_rate if step_score >= 0.12 else None,
        "ankle_separation_variability_px": float(np.std(ankle)),
        "lateral_sway_px": float(np.std(center)) if center.size else None,
    }


def analyze_video(
    video_path: str | Path,
    *,
    max_frames: int = DEFAULT_MAX_FRAMES,
    sample_every: int = 1,
    use_mediapipe: bool = True,
) -> AnalysisResult:
    path = Path(video_path)
    if not path.exists():
        raise FileNotFoundError(path)

    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {path}")

    fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

    face_tracker = FaceTracker()
    optional = OptionalMediaPipe(use_mediapipe)
    rgb_series: list[np.ndarray] = []
    torso_rois: list[np.ndarray] = []
    eye_trace: list[float] = []
    pupil_radii: list[float] = []
    pose_trace: list[dict[str, Optional[float]]] = []
    face_detections = 0
    frames_processed = 0
    warnings: list[str] = []

    try:
        frame_index = 0
        while frames_processed < max_frames:
            ok, frame = cap.read()
            if not ok:
                break
            frame_index += 1
            if sample_every > 1 and frame_index % sample_every:
                continue

            frames_processed += 1
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            face = face_tracker.detect(gray)
            if face is not None:
                face_detections += 1
                skin_roi = _skin_roi_from_face(frame, face)
                mean_rgb = _mean_rgb(skin_roi) if skin_roi is not None else None
                if mean_rgb is not None:
                    rgb_series.append(mean_rgb)

                torso_roi = _torso_roi_from_face(frame, face)
                if torso_roi is not None:
                    torso_rois.append(cv2.resize(torso_roi, (160, 120)))

                pupil_radius = _pupil_radius_from_face(frame, face)
                if pupil_radius is not None:
                    pupil_radii.append(pupil_radius)

            if optional.enabled:
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                face_result = optional.face_mesh.process(rgb_frame) if optional.face_mesh is not None else None
                if face_result and face_result.multi_face_landmarks:
                    landmarks = face_result.multi_face_landmarks[0].landmark
                    left = _eye_aspect_ratio(landmarks, width, height, "left")
                    right = _eye_aspect_ratio(landmarks, width, height, "right")
                    if left is not None and right is not None:
                        eye_trace.append((left + right) / 2.0)

                pose_result = optional.pose.process(rgb_frame) if optional.pose is not None else None
                if pose_result and pose_result.pose_landmarks:
                    pose_trace.append(_pose_metric(pose_result.pose_landmarks.landmark, width, height))
    finally:
        cap.release()
        optional.close()

    duration_seconds = frames_processed / fps if fps > 0 else 0.0
    effective_fps = fps / max(sample_every, 1)
    rgb_array = np.asarray(rgb_series, dtype=np.float64)

    if frames_processed == 0:
        warnings.append("No frames were processed.")
    if duration_seconds < MIN_RPPG_SECONDS:
        warnings.append(f"Video is shorter than {MIN_RPPG_SECONDS:g}s; rPPG/respiration estimates may be unstable.")
    if face_detections / max(frames_processed, 1) < 0.5:
        warnings.append("Face was detected in fewer than half of processed frames.")
    if mp is None and use_mediapipe:
        warnings.append("MediaPipe is not installed; blink and pose/gait measurements were skipped.")

    estimates: dict[str, Estimate] = {}
    metrics: dict[str, Any] = {
        "face_detection_rate": face_detections / max(frames_processed, 1),
        "facial_color": _facial_color_metrics(rgb_array),
    }

    if rgb_array.shape[0] >= int(effective_fps * 4):
        pos = _pos_rppg(rgb_array, effective_fps)
        chrom = _chrom_rppg(rgb_array, effective_fps)
        pos_hr, pos_score = _dominant_rate_bpm(pos, effective_fps, 42.0, 180.0)
        chrom_hr, chrom_score = _dominant_rate_bpm(chrom, effective_fps, 42.0, 180.0)

        if pos_hr is not None and chrom_hr is not None and abs(pos_hr - chrom_hr) <= 12.0:
            hr = float((pos_hr + chrom_hr) / 2.0)
            hr_score = max(pos_score, chrom_score)
        elif pos_score >= chrom_score:
            hr = pos_hr
            hr_score = pos_score
        else:
            hr = chrom_hr
            hr_score = chrom_score

        metrics["rppg"] = {
            "pos_heart_rate_bpm": pos_hr,
            "pos_confidence_score": pos_score,
            "chrom_heart_rate_bpm": chrom_hr,
            "chrom_confidence_score": chrom_score,
            **_rppg_hrv(pos if pos.size else chrom, effective_fps),
        }
        estimates["heart_rate"] = Estimate(
            value=hr,
            unit="bpm",
            confidence=_confidence_from_score(hr_score),
            method="RGB face rPPG, POS/CHROM spectral peak",
            limitations=[
                "Sensitive to motion, compression, lighting, skin visibility, and camera auto-exposure.",
                "Use for trend/demo screening only unless validated against ECG/PPG hardware.",
            ],
        )
        hrv = metrics["rppg"].get("rmssd_ms")
        estimates["hrv_rmssd"] = Estimate(
            value=hrv,
            unit="ms",
            confidence="low" if hrv is not None else "unavailable",
            method="Inter-peak intervals from rPPG waveform",
            limitations=[
                "RGB rPPG peak timing is much less reliable than ECG.",
                "Short recordings cannot support clinical HRV interpretation.",
            ],
        )
        irregularity = metrics["rppg"].get("pulse_irregularity_index")
        estimates["pulse_irregularity_index"] = Estimate(
            value=irregularity,
            unit="coefficient_of_variation",
            confidence="low" if irregularity is not None else "unavailable",
            method="Coefficient of variation of rPPG peak intervals",
            limitations=["Not an atrial-fibrillation detector; ECG is required for rhythm diagnosis."],
        )
    else:
        estimates["heart_rate"] = Estimate(
            value=None,
            unit="bpm",
            confidence="unavailable",
            method="RGB face rPPG",
            limitations=["Insufficient stable face-video samples."],
        )

    flow_trace = _vertical_optical_flow_trace(torso_rois)
    resp_rate, resp_score = _dominant_rate_bpm(flow_trace, effective_fps, 6.0, 40.0)
    resp_method = "Low-frequency vertical optical-flow spectrum in torso ROI"
    motion_trace = _frame_motion_trace(torso_rois)
    motion_resp_rate, motion_resp_score = _dominant_rate_bpm(motion_trace, effective_fps, 6.0, 40.0)
    if motion_resp_rate is not None and motion_resp_score > resp_score:
        resp_rate = motion_resp_rate
        resp_score = motion_resp_score
        resp_method = "Low-frequency frame-difference motion spectrum in torso ROI"

    rppg_resp_rate = None
    rppg_resp_score = 0.0
    if rgb_array.shape[0] >= int(effective_fps * 8):
        green_trace = rgb_array[:, 1]
        rppg_resp_rate, rppg_resp_score = _dominant_rate_bpm(green_trace, effective_fps, 6.0, 35.0)
        if rppg_resp_rate is not None and (resp_rate is None or rppg_resp_score > resp_score):
            resp_rate = rppg_resp_rate
            resp_score = rppg_resp_score
            resp_method = "Low-frequency green-channel rPPG respiratory modulation"
    metrics["respiration_motion"] = {
        "confidence_score": resp_score,
        "optical_flow_samples": int(flow_trace.size),
        "frame_difference_samples": int(motion_trace.size),
        "frame_difference_confidence_score": motion_resp_score,
        "rppg_modulation_rate_bpm": rppg_resp_rate,
        "rppg_modulation_confidence_score": rppg_resp_score,
    }
    estimates["respiratory_rate"] = Estimate(
        value=resp_rate,
        unit="breaths_per_min",
        confidence=_confidence_from_score(resp_score, minimum=0.12, strong=0.28) if resp_rate is not None else "unavailable",
        method=resp_method,
        limitations=[
            "Body sway, talking, clothing, camera motion, and poor torso framing can dominate breathing motion.",
            "Radar/depth/thermal sensors are more robust for respiration.",
        ],
    )

    color_metrics = metrics["facial_color"]
    estimates["facial_pallor_index"] = Estimate(
        value=color_metrics.get("pallor_index"),
        unit="arbitrary_index",
        confidence="low" if color_metrics.get("pallor_index") is not None else "unavailable",
        method="Mean RGB cheek/forehead color ratios",
        limitations=[
            "Not a hemoglobin measurement.",
            "Requires calibrated lighting and per-user baseline for meaningful screening.",
        ],
    )
    estimates["facial_redness_index"] = Estimate(
        value=color_metrics.get("relative_redness"),
        unit="arbitrary_index",
        confidence="low" if color_metrics.get("relative_redness") is not None else "unavailable",
        method="Mean RGB cheek/forehead relative red-channel ratio",
        limitations=[
            "Screening trend only.",
            "Affected by lighting, white balance, makeup, skin tone, camera settings, and motion.",
        ],
    )
    estimates["facial_yellowness_index"] = Estimate(
        value=color_metrics.get("relative_yellowness_index"),
        unit="arbitrary_index",
        confidence="low" if color_metrics.get("relative_yellowness_index") is not None else "unavailable",
        method="Mean RGB cheek/forehead red+green versus blue ratio",
        limitations=[
            "Not a bilirubin or jaundice measurement.",
            "Requires controlled lighting, color calibration, and baseline comparison.",
        ],
    )

    blink_metrics = _blink_stats(eye_trace, effective_fps, duration_seconds)
    metrics["blink"] = blink_metrics
    estimates["blink_rate"] = Estimate(
        value=blink_metrics["blink_rate_per_min"],
        unit="blinks_per_min",
        confidence="medium" if blink_metrics["blink_rate_per_min"] is not None else "unavailable",
        method="MediaPipe Face Mesh eye-aspect-ratio thresholding",
        limitations=["Skipped without MediaPipe; affected by glasses, gaze direction, face angle, and frame rate."],
    )
    median_pupil_radius = _median(pupil_radii, default=math.nan)
    pupil_value = median_pupil_radius if math.isfinite(median_pupil_radius) else None
    metrics["pupillometry"] = {
        "median_pupil_radius_px": pupil_value,
        "samples": len(pupil_radii),
    }
    estimates["pupil_radius"] = Estimate(
        value=pupil_value,
        unit="pixels",
        confidence="low" if pupil_value is not None else "unavailable",
        method="Hough circle detection in face-derived eye band",
        limitations=[
            "Pixel-space only; needs IR illumination and camera geometry calibration for millimeters.",
            "Affected by eyelids, glasses, gaze angle, reflections, and image sharpness.",
        ],
    )

    gait_metrics = _gait_stats(pose_trace, effective_fps)
    metrics["gait"] = gait_metrics
    estimates["step_rate"] = Estimate(
        value=gait_metrics["step_rate_per_min"],
        unit="steps_per_min",
        confidence="low" if gait_metrics["step_rate_per_min"] is not None else "unavailable",
        method="MediaPipe Pose ankle-separation periodicity",
        limitations=[
            "Needs a full-body walking view and camera geometry calibration for real gait speed/stride length.",
            "Use depth camera or calibrated multi-camera setup for clinical gait analysis.",
        ],
    )
    estimates["lateral_sway"] = Estimate(
        value=gait_metrics["lateral_sway_px"],
        unit="pixels",
        confidence="low" if gait_metrics["lateral_sway_px"] is not None else "unavailable",
        method="Frame-to-frame body-center variability from pose landmarks",
        limitations=["Pixel-space sway is not comparable across camera distances without calibration."],
    )

    non_video_measurements = {
        "spo2": "Requires multispectral/NIR calibration or pulse oximeter; RGB video alone is not reliable.",
        "skin_temperature": "Requires calibrated IR/thermal camera, not ordinary RGB video.",
        "blood_pressure": "Requires cuff, calibrated PPG/PTT hardware, or validated cuffless device; raw video is insufficient.",
        "glucose": "Requires CGM, blood, saliva, sweat, or validated spectroscopy hardware.",
        "urinalysis": "Requires urine strip/cartridge images with controlled lighting and reference calibration.",
        "saliva_diagnostics": "Requires biochemical assay/cartridge; video cannot infer cortisol/glucose/pathogens.",
        "breath_voc": "Requires gas sensors, e-nose, spectroscopy, or lab analysis.",
        "nasal_throat_pathogens": "Requires PCR/antigen/molecular assay.",
        "ecg_rhythm": "Requires electrodes or radar system validated for cardiac waveform recovery.",
        "fundus_retina": "Requires fundus optics/illumination; standard face video is not enough.",
        "tcm_tongue": "Possible from controlled tongue images, but needs a trained/validated model and lighting protocol.",
        "environment": "Requires environmental sensors for CO2, PM2.5, formaldehyde, humidity, noise, etc.",
    }

    metadata = VideoMetadata(
        path=str(path),
        fps=fps,
        frames_processed=frames_processed,
        duration_seconds=duration_seconds,
        width=width,
        height=height,
    )
    return AnalysisResult(
        video=metadata,
        estimates=estimates,
        metrics=metrics,
        non_video_measurements=non_video_measurements,
        warnings=warnings,
    )


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Estimate screenable health metrics from raw RGB video.")
    parser.add_argument("video", help="Path to the raw video file.")
    parser.add_argument("--output", "-o", help="Optional JSON output path.")
    parser.add_argument("--max-frames", type=int, default=DEFAULT_MAX_FRAMES, help="Maximum frames to process.")
    parser.add_argument("--sample-every", type=int, default=1, help="Process every Nth frame.")
    parser.add_argument("--no-mediapipe", action="store_true", help="Disable optional MediaPipe face/pose analysis.")
    return parser


def main() -> int:
    args = _build_parser().parse_args()
    result = analyze_video(
        args.video,
        max_frames=args.max_frames,
        sample_every=max(1, args.sample_every),
        use_mediapipe=not args.no_mediapipe,
    )
    output = result.to_json()
    if args.output:
        Path(args.output).write_text(output + "\n", encoding="utf-8")
    else:
        print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
