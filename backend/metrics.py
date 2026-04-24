"""
Voxel-to-metrics translation.

Takes TRIBE's (n_timesteps, 20484) prediction array and maps it onto six
neuromarketing-relevant cortical regions, returning 0-100 scores.

Region masks are cached at module import — your notebook recomputed them on
every call, which is pure waste.
"""
from __future__ import annotations

import numpy as np
from nilearn import datasets

# Destrieux atlas label substrings → our marketing metric buckets.
# Lowercased substring match against the actual label strings in the atlas.
REGION_KEYWORDS: dict[str, list[str]] = {
    # V1/V2 + extrastriate: occipital, calcarine, cuneus, lingual, fusiform (VWFA too)
    "visual":    ["occipital", "calcarine", "cuneus", "lingual", "fusifor"],
    # A1: superior temporal gyrus, Heschl / transverse temporal
    "auditory":  ["temp_sup", "temporal_transverse"],
    # Broca (IFG pars opercularis/triangularis), Wernicke (STS), angular, ITG
    "language":  ["opercular", "triangul", "angular", "temporal_inf", "temp_sup-plan"],
    # Dorsal attention: parietal sup, precentral, middle frontal (FEF), IPS
    "attention": ["parietal_sup", "precentral", "front_middle", "intrapariet"],
    # vmPFC + ACC — reward / valuation
    "reward":    ["orbital", "rectus", "cingul-ant", "subcallosal"],
    # PPA, collateral sulcus, medial temporal — scene / episodic
    "memory":    ["parahip", "collat_transv", "temp_med"],
}

# One-time compute at import (takes ~1-2s and a network call to nilearn).
_REGION_MASKS: dict[str, np.ndarray] | None = None


def _build_region_masks() -> dict[str, np.ndarray]:
    destrieux = datasets.fetch_atlas_surf_destrieux()
    labels_lh = destrieux["map_left"]
    labels_rh = destrieux["map_right"]
    label_names = [
        n.decode() if isinstance(n, bytes) else n
        for n in destrieux["labels"]
    ]

    masks: dict[str, np.ndarray] = {}
    for metric, keywords in REGION_KEYWORDS.items():
        matching = [
            i for i, name in enumerate(label_names)
            if any(k.lower() in name.lower() for k in keywords)
        ]
        if not matching:
            masks[metric] = np.array([], dtype=int)
            continue
        lh = np.where(np.isin(labels_lh, matching))[0]
        rh = np.where(np.isin(labels_rh, matching))[0] + 10242  # fsaverage5 offset
        masks[metric] = np.concatenate([lh, rh])
    return masks


def get_region_masks() -> dict[str, np.ndarray]:
    global _REGION_MASKS
    if _REGION_MASKS is None:
        _REGION_MASKS = _build_region_masks()
    return _REGION_MASKS


def voxels_to_metrics(preds: np.ndarray) -> dict[str, int]:
    """
    preds: (n_timesteps, 20484) — TRIBE's output for fsaverage5.
    Returns: {visual, auditory, language, attention, reward, memory} → 0-100.

    Uses peak-over-time (80th pct across time) then top-10% within region
    (90th pct across vertices). Matches how neuromarketing research interprets
    stimulus responses: 'at the best moment, how hard did this region light up?'
    """
    if preds.ndim != 2 or preds.shape[1] != 20484:
        raise ValueError(f"expected (T, 20484), got {preds.shape}")

    vertex_peaks = np.percentile(preds, 80, axis=0)  # (20484,)
    masks = get_region_masks()

    scores: dict[str, int] = {}
    for metric, idx in masks.items():
        if idx.size == 0:
            scores[metric] = 0
            continue
        raw = float(np.percentile(vertex_peaks[idx], 90))
        # Map [0, 1] → [0, 100]
        scores[metric] = int(np.clip(raw * 100, 0, 100))
    return scores
