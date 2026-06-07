from __future__ import annotations

import argparse
import json
import math
import statistics
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Iterable

try:
    import cv2
except ImportError:
    cv2 = None

try:
    import numpy as np
except ImportError:
    np = None


VERSION = "0.1.0"


URINE_MARKERS = [
    "leukocytes",
    "nitrite",
    "urobilinogen",
    "protein",
    "ph",
    "blood",
    "specific_gravity",
    "ketones",
    "bilirubin",
    "glucose",
]


DEFAULT_URINE_CHARTS: dict[str, list[dict[str, Any]]] = {
    "leukocytes": [
        {"label": "negative", "value": "negative", "rgb": [238, 226, 201]},
        {"label": "trace", "value": "trace", "rgb": [220, 197, 221]},
        {"label": "small", "value": "small", "rgb": [183, 143, 197]},
        {"label": "moderate", "value": "moderate", "rgb": [142, 94, 171]},
        {"label": "large", "value": "large", "rgb": [102, 67, 143]},
    ],
    "nitrite": [
        {"label": "negative", "value": "negative", "rgb": [247, 238, 225]},
        {"label": "positive", "value": "positive", "rgb": [236, 141, 172]},
    ],
    "urobilinogen": [
        {"label": "normal", "value": "0.2-1.0 EU/dL", "rgb": [238, 190, 165]},
        {"label": "2", "value": "2 EU/dL", "rgb": [224, 154, 135]},
        {"label": "4", "value": "4 EU/dL", "rgb": [209, 119, 113]},
        {"label": "8", "value": "8 EU/dL", "rgb": [186, 86, 105]},
    ],
    "protein": [
        {"label": "negative", "value": "negative", "rgb": [231, 226, 126]},
        {"label": "trace", "value": "trace", "rgb": [205, 217, 112]},
        {"label": "30", "value": "30 mg/dL", "rgb": [159, 199, 103]},
        {"label": "100", "value": "100 mg/dL", "rgb": [105, 169, 111]},
        {"label": "300+", "value": ">=300 mg/dL", "rgb": [73, 131, 107]},
    ],
    "ph": [
        {"label": "5.0", "value": 5.0, "rgb": [232, 129, 66]},
        {"label": "6.0", "value": 6.0, "rgb": [220, 170, 59]},
        {"label": "6.5", "value": 6.5, "rgb": [193, 183, 65]},
        {"label": "7.0", "value": 7.0, "rgb": [141, 178, 79]},
        {"label": "7.5", "value": 7.5, "rgb": [90, 164, 98]},
        {"label": "8.0", "value": 8.0, "rgb": [63, 142, 119]},
        {"label": "8.5", "value": 8.5, "rgb": [53, 111, 139]},
    ],
    "blood": [
        {"label": "negative", "value": "negative", "rgb": [236, 195, 73]},
        {"label": "trace", "value": "trace", "rgb": [183, 169, 72]},
        {"label": "small", "value": "small", "rgb": [121, 139, 70]},
        {"label": "moderate", "value": "moderate", "rgb": [72, 111, 69]},
        {"label": "large", "value": "large", "rgb": [38, 80, 63]},
    ],
    "specific_gravity": [
        {"label": "1.000", "value": 1.000, "rgb": [59, 103, 125]},
        {"label": "1.005", "value": 1.005, "rgb": [65, 124, 117]},
        {"label": "1.010", "value": 1.010, "rgb": [91, 145, 104]},
        {"label": "1.015", "value": 1.015, "rgb": [125, 159, 86]},
        {"label": "1.020", "value": 1.020, "rgb": [161, 164, 72]},
        {"label": "1.025", "value": 1.025, "rgb": [188, 159, 63]},
        {"label": "1.030", "value": 1.030, "rgb": [205, 145, 59]},
    ],
    "ketones": [
        {"label": "negative", "value": "negative", "rgb": [238, 207, 183]},
        {"label": "trace", "value": "trace", "rgb": [229, 174, 173]},
        {"label": "small", "value": "15 mg/dL", "rgb": [210, 129, 157]},
        {"label": "moderate", "value": "40 mg/dL", "rgb": [170, 82, 133]},
        {"label": "large", "value": ">=80 mg/dL", "rgb": [120, 49, 101]},
    ],
    "bilirubin": [
        {"label": "negative", "value": "negative", "rgb": [234, 205, 151]},
        {"label": "small", "value": "small", "rgb": [220, 176, 126]},
        {"label": "moderate", "value": "moderate", "rgb": [194, 139, 103]},
        {"label": "large", "value": "large", "rgb": [158, 104, 90]},
    ],
    "glucose": [
        {"label": "negative", "value": "negative", "rgb": [99, 155, 111]},
        {"label": "100", "value": "100 mg/dL", "rgb": [122, 164, 83]},
        {"label": "250", "value": "250 mg/dL", "rgb": [170, 156, 68]},
        {"label": "500", "value": "500 mg/dL", "rgb": [189, 120, 61]},
        {"label": "1000+", "value": ">=1000 mg/dL", "rgb": [126, 72, 50]},
    ],
}


LIMITATIONS = {
    "manufacturer_calibration": (
        "Generic reference colors are included for prototyping only. Production "
        "must load the exact strip manufacturer's color chart."
    ),
    "illumination": (
        "Reliable colorimetry needs controlled lighting plus white/black or "
        "color reference targets in the cartridge."
    ),
    "read_time": (
        "Each reagent pad has a required read time after wetting. The script "
        "does not infer wetting time from video unless the capture workflow "
        "already controls it."
    ),
    "diagnosis": (
        "Results are screening outputs. UTI, CKD, diabetes, liver disease, or "
        "hematuria diagnosis requires clinical context and confirmatory tests."
    ),
}


@dataclass
class Measurement:
    name: str
    value: Any
    unit: str | None = None
    confidence: float | None = None
    method: str | None = None
    notes: list[str] = field(default_factory=list)


@dataclass
class VideoMetadata:
    path: str
    fps: float
    frame_count: int
    duration_s: float
    width: int
    height: int
    sampled_frames: int


@dataclass
class AnalysisResult:
    version: str
    metadata: VideoMetadata
    measurements: dict[str, Measurement]
    limitations: dict[str, str]
    warnings: list[str] = field(default_factory=list)


def require_video_deps() -> None:
    if cv2 is None or np is None:
        raise SystemExit(
            "This script requires opencv-python and numpy. Install with: "
            "python3 -m pip install opencv-python numpy"
        )


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def normalized_roi_to_pixels(roi: Iterable[float], width: int, height: int) -> tuple[int, int, int, int]:
    x, y, w, h = [float(v) for v in roi]
    if max(x, y, w, h) <= 1.0:
        return (
            int(round(x * width)),
            int(round(y * height)),
            int(round(w * width)),
            int(round(h * height)),
        )
    return int(round(x)), int(round(y)), int(round(w)), int(round(h))


def crop(frame: Any, roi: tuple[int, int, int, int]) -> Any:
    x, y, w, h = roi
    height, width = frame.shape[:2]
    x0 = int(clamp(x, 0, width - 1))
    y0 = int(clamp(y, 0, height - 1))
    x1 = int(clamp(x + w, x0 + 1, width))
    y1 = int(clamp(y + h, y0 + 1, height))
    return frame[y0:y1, x0:x1]


def open_video(path: Path) -> Any:
    require_video_deps()
    if not path.exists():
        raise SystemExit(f"Video not found: {path}")
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise SystemExit(f"Could not open video: {path}")
    return cap


def sample_video(path: Path, max_frames: int = 600, stride: int | None = None) -> tuple[list[Any], VideoMetadata]:
    cap = open_video(path)
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    if stride is None:
        stride = max(1, math.floor(max(frame_count, 1) / max_frames)) if frame_count else 1

    frames: list[Any] = []
    index = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if index % stride == 0:
            frames.append(frame)
            if len(frames) >= max_frames:
                break
        index += 1
    cap.release()
    if not frames:
        raise SystemExit(f"No frames decoded from video: {path}")

    if frame_count <= 0:
        frame_count = index
    duration_s = frame_count / fps if fps > 0 else 0.0
    metadata = VideoMetadata(
        path=str(path),
        fps=fps / stride if stride > 0 else fps,
        frame_count=frame_count,
        duration_s=duration_s,
        width=width or int(frames[0].shape[1]),
        height=height or int(frames[0].shape[0]),
        sampled_frames=len(frames),
    )
    return frames, metadata


def load_config(path: Path | None) -> dict[str, Any]:
    if path is None:
        return {}
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def bgr_to_rgb(color: Any) -> list[float]:
    return [float(color[2]), float(color[1]), float(color[0])]


def rgb_to_lab(rgb: Iterable[float]) -> Any:
    arr = np.array([[list(rgb)]], dtype=np.uint8)
    lab = cv2.cvtColor(arr, cv2.COLOR_RGB2LAB)[0, 0].astype(float)
    return lab


def median_rgb(frame: Any, roi: tuple[int, int, int, int]) -> list[float]:
    patch = crop(frame, roi)
    if patch.size == 0:
        return [0.0, 0.0, 0.0]
    median_bgr = np.median(patch.reshape(-1, 3), axis=0)
    return bgr_to_rgb(median_bgr)


def robust_frame(frames: list[Any]) -> Any:
    if len(frames) == 1:
        return frames[0]
    indices = np.linspace(0, len(frames) - 1, min(len(frames), 31)).astype(int)
    stack = np.stack([frames[int(i)] for i in indices], axis=0)
    return np.median(stack, axis=0).astype(np.uint8)


def apply_color_calibration(rgb: list[float], config: dict[str, Any], frame: Any | None = None) -> list[float]:
    calibration = config.get("calibration") or {}
    white = calibration.get("white_rgb")
    black = calibration.get("black_rgb", [0, 0, 0])
    if frame is not None and calibration.get("white_roi"):
        white = median_rgb(frame, normalized_roi_to_pixels(calibration["white_roi"], frame.shape[1], frame.shape[0]))
    if frame is not None and calibration.get("black_roi"):
        black = median_rgb(frame, normalized_roi_to_pixels(calibration["black_roi"], frame.shape[1], frame.shape[0]))
    if not white:
        return rgb
    calibrated: list[float] = []
    for idx, channel in enumerate(rgb):
        low = float(black[idx])
        high = max(float(white[idx]), low + 1.0)
        calibrated.append(clamp((channel - low) * 255.0 / (high - low), 0.0, 255.0))
    return calibrated


def nearest_chart_value(marker: str, rgb: list[float], charts: dict[str, list[dict[str, Any]]]) -> tuple[dict[str, Any], float]:
    chart = charts.get(marker)
    if not chart:
        return {"label": "unknown", "value": None, "rgb": [0, 0, 0]}, 0.0
    lab = rgb_to_lab(rgb)
    distances: list[tuple[float, dict[str, Any]]] = []
    for entry in chart:
        ref = rgb_to_lab(entry["rgb"])
        distances.append((float(np.linalg.norm(lab - ref)), entry))
    distances.sort(key=lambda item: item[0])
    best_distance, best_entry = distances[0]
    second_distance = distances[1][0] if len(distances) > 1 else best_distance + 50.0
    separation = max(0.0, second_distance - best_distance)
    confidence = clamp(1.0 - (best_distance / 80.0), 0.05, 0.99)
    if separation < 8:
        confidence *= 0.65
    return best_entry, confidence


def infer_pad_rois(frame: Any, expected: int = 10) -> list[tuple[int, int, int, int]]:
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    saturation = hsv[:, :, 1]
    value = hsv[:, :, 2]
    mask = cv2.inRange(saturation, 35, 255)
    mask = cv2.bitwise_and(mask, cv2.inRange(value, 45, 255))
    kernel = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    candidates: list[tuple[int, int, int, int]] = []
    area_min = frame.shape[0] * frame.shape[1] * 0.0002
    area_max = frame.shape[0] * frame.shape[1] * 0.03
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        area = w * h
        aspect = w / max(h, 1)
        if area_min <= area <= area_max and 0.35 <= aspect <= 2.8:
            candidates.append((x, y, w, h))

    if len(candidates) < expected:
        return []

    candidates.sort(key=lambda r: (r[1], r[0]))
    xs = [x + w / 2 for x, y, w, h in candidates]
    ys = [y + h / 2 for x, y, w, h in candidates]
    if statistics.pstdev(xs) >= statistics.pstdev(ys):
        candidates.sort(key=lambda r: r[0] + r[2] / 2)
    else:
        candidates.sort(key=lambda r: r[1] + r[3] / 2)
    return candidates[:expected]


def analyze_urine_strip(frames: list[Any], config: dict[str, Any]) -> dict[str, Measurement]:
    frame = robust_frame(frames)
    height, width = frame.shape[:2]
    urine_config = config.get("urine_strip", config)
    markers = urine_config.get("markers", URINE_MARKERS)
    chart_config = urine_config.get("charts") or DEFAULT_URINE_CHARTS

    rois: dict[str, tuple[int, int, int, int]] = {}
    if urine_config.get("pad_rois"):
        for marker, roi in urine_config["pad_rois"].items():
            rois[marker] = normalized_roi_to_pixels(roi, width, height)
    elif urine_config.get("strip_roi") and urine_config.get("pad_count"):
        x, y, w, h = normalized_roi_to_pixels(urine_config["strip_roi"], width, height)
        pad_count = int(urine_config["pad_count"])
        axis = urine_config.get("axis", "vertical")
        pad_fraction = float(urine_config.get("pad_fraction", 0.72))
        for idx, marker in enumerate(markers[:pad_count]):
            if axis == "horizontal":
                cell_w = w / pad_count
                pad_w = cell_w * pad_fraction
                px = int(x + idx * cell_w + (cell_w - pad_w) / 2)
                rois[marker] = (px, int(y + h * 0.14), int(pad_w), int(h * 0.72))
            else:
                cell_h = h / pad_count
                pad_h = cell_h * pad_fraction
                py = int(y + idx * cell_h + (cell_h - pad_h) / 2)
                rois[marker] = (int(x + w * 0.14), py, int(w * 0.72), int(pad_h))
    else:
        detected = infer_pad_rois(frame, expected=len(markers))
        for marker, roi in zip(markers, detected):
            rois[marker] = roi

    measurements: dict[str, Measurement] = {}
    if not rois:
        measurements["urine_strip_status"] = Measurement(
            name="urine_strip_status",
            value="not_detected",
            confidence=0.0,
            method="colorimetric urine dipstick",
            notes=[
                "No pad ROIs were configured and automatic detection failed.",
                "Use --config with fixed cartridge pad_rois for reliable results.",
            ],
        )
        return measurements

    for marker in markers:
        if marker not in rois:
            continue
        rgb = median_rgb(frame, rois[marker])
        calibrated_rgb = apply_color_calibration(rgb, urine_config, frame)
        entry, confidence = nearest_chart_value(marker, calibrated_rgb, chart_config)
        measurements[f"urine_{marker}"] = Measurement(
            name=f"urine_{marker}",
            value=entry.get("value"),
            confidence=round(confidence, 3),
            method="calibrated Lab nearest-neighbor reagent-pad colorimetry",
            notes=[
                f"matched_label={entry.get('label')}",
                f"sample_rgb={[round(v, 1) for v in calibrated_rgb]}",
                "Use reagent-specific color charts and read-time control before clinical use.",
            ],
        )

    nitrite = measurements.get("urine_nitrite")
    leukocytes = measurements.get("urine_leukocytes")
    if nitrite and leukocytes:
        nitrite_pos = str(nitrite.value).lower() not in {"negative", "none", "0"}
        leuk_pos = str(leukocytes.value).lower() not in {"negative", "none", "0"}
        if nitrite_pos and leuk_pos:
            value = "positive_screen"
            confidence = min(nitrite.confidence or 0.0, leukocytes.confidence or 0.0)
        elif nitrite_pos or leuk_pos:
            value = "possible_screen"
            confidence = 0.5 * max(nitrite.confidence or 0.0, leukocytes.confidence or 0.0)
        else:
            value = "negative_screen"
            confidence = min(nitrite.confidence or 0.0, leukocytes.confidence or 0.0)
        measurements["urine_uti_screen"] = Measurement(
            name="urine_uti_screen",
            value=value,
            confidence=round(confidence, 3),
            method="nitrite plus leukocyte esterase rule",
            notes=["Screening only; symptoms and culture/PCR determine diagnosis."],
        )

    return measurements


def analyze_video(path: Path, config: dict[str, Any], max_frames: int) -> AnalysisResult:
    frames, metadata = sample_video(path, max_frames=max_frames)
    measurements = analyze_urine_strip(frames, config)

    return AnalysisResult(
        version=VERSION,
        metadata=metadata,
        measurements=measurements,
        limitations=LIMITATIONS,
        warnings=[],
    )


def result_to_json(result: AnalysisResult) -> str:
    data = asdict(result)
    return json.dumps(data, indent=2, sort_keys=True)


def write_example_config(path: Path) -> None:
    example = {
        "urine_strip": {
            "markers": URINE_MARKERS,
            "strip_roi": [0.45, 0.12, 0.10, 0.76],
            "axis": "vertical",
            "pad_count": 10,
            "pad_fraction": 0.70,
            "calibration": {
                "white_roi": [0.10, 0.10, 0.05, 0.05],
                "black_roi": [0.10, 0.18, 0.05, 0.05],
            },
        },
    }
    path.write_text(json.dumps(example, indent=2) + "\n", encoding="utf-8")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Calculate urine-strip screening measurements from HealthBot cartridge video."
    )
    parser.add_argument("video", nargs="?", type=Path, help="Path to raw video file.")
    parser.add_argument("--config", type=Path, help="Optional JSON config with ROIs and urine color charts.")
    parser.add_argument("--output", type=Path, help="Write JSON result to this path instead of stdout.")
    parser.add_argument("--max-frames", type=int, default=600, help="Maximum sampled frames. Default: 600.")
    parser.add_argument(
        "--write-example-config",
        type=Path,
        help="Write an example ROI/calibration config and exit.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.write_example_config:
        write_example_config(args.write_example_config)
        return 0
    if args.video is None:
        parser.error("video is required unless --write-example-config is used")

    config = load_config(args.config)
    result = analyze_video(args.video, config, max_frames=args.max_frames)
    output = result_to_json(result)
    if args.output:
        args.output.write_text(output + "\n", encoding="utf-8")
    else:
        print(output)
    return 0


if __name__ == "__main__":
    sys.exit(main())
