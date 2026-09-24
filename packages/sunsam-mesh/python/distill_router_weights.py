#!/usr/bin/env python3
"""Destila el juicio del teacher (o de Laya) en el router heurístico de latencia cero.

Lee `laya-soft-labels.jsonl` (etiquetas blandas P(local) del teacher) y, opcionalmente,
`feedback.jsonl` + `decisions.jsonl` (etiquetas explícitas), y ajusta por regresión logística
con objetivos blandos los pesos de `router.heuristicWeights` de Sunsam Mesh.

    python distill_router_weights.py --data ~/.sunsam/mesh-data --out weights.json

Copia el JSON resultante en `router.heuristicWeights` de ~/.sunsam/mesh.json.
Las transformaciones de entrada replican `heuristicFeatureVector` (src/domain/complexity.ts).
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np

FEATURES = ["userBytes", "conversationBytes", "codeBlocks", "complexHits", "simpleHits", "hasImage", "toolCount"]


def vector(ctx: dict) -> list[float]:
    return [
        math.log2(1 + ctx.get("userBytes", 0) / 400),
        math.log2(1 + ctx.get("conversationBytes", 0) / 20_000),
        min(ctx.get("codeBlocks", 0), 3),
        min(ctx.get("complexHits", 0), 3),
        min(ctx.get("simpleHits", 0), 2),
        1.0 if ctx.get("hasImage") else 0.0,
        math.log2(1 + ctx.get("toolCount", 0)),
    ]


def read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def load_examples(data: Path, feedback_weight: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    xs, ys, ws = [], [], []
    for record in read_jsonl(data / "laya-soft-labels.jsonl"):
        c = record["state"]["context"]
        ctx = {
            "userBytes": c.get("user_bytes", 0), "conversationBytes": c.get("conversation_bytes", 0),
            "codeBlocks": c.get("code_blocks", 0), "complexHits": c.get("complex_hits", 0),
            "simpleHits": c.get("simple_hits", 0), "hasImage": c.get("has_image", False), "toolCount": c.get("tools", 0),
        }
        xs.append(vector(ctx)); ys.append(record["soft_labels"]["route"]["local"]); ws.append(1.0)
    decisions = {d["id"]: d for d in read_jsonl(data / "decisions.jsonl")}
    for fb in read_jsonl(data / "feedback.jsonl"):
        decision = decisions.get(fb["decisionId"])
        if decision:
            xs.append(vector(decision["features"])); ys.append(1.0 if fb["localSufficient"] else 0.0); ws.append(feedback_weight)
    return np.array(xs, dtype=float), np.array(ys, dtype=float), np.array(ws, dtype=float)


def fit(x: np.ndarray, y: np.ndarray, w: np.ndarray, l2: float, steps: int, lr: float) -> np.ndarray:
    """Regresión logística con objetivos blandos (entropía cruzada = regla de puntuación propia)."""
    xb = np.hstack([np.ones((len(x), 1)), x])
    theta = np.zeros(xb.shape[1])
    for _ in range(steps):
        p = 1 / (1 + np.exp(-xb @ theta))
        grad = xb.T @ (w * (p - y)) / w.sum() + l2 * np.r_[0, theta[1:]]
        theta -= lr * grad
    return theta


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=Path("~/.sunsam/mesh-data").expanduser())
    parser.add_argument("--out", type=Path, default=Path("router-weights.json"))
    parser.add_argument("--feedback-weight", type=float, default=3.0, help="peso de etiquetas humanas frente a blandas")
    parser.add_argument("--l2", type=float, default=1e-3)
    parser.add_argument("--steps", type=int, default=5000)
    parser.add_argument("--lr", type=float, default=0.1)
    args = parser.parse_args()

    x, y, w = load_examples(args.data.expanduser(), args.feedback_weight)
    if len(x) < 20:
        raise SystemExit(f"Sólo {len(x)} ejemplos; activa feedback.layaSoftLabels y acumula más datos.")
    theta = fit(x, y, w, args.l2, args.steps, args.lr)
    p = 1 / (1 + np.exp(-(np.hstack([np.ones((len(x), 1)), x]) @ theta)))
    brier = float(np.average((p - y) ** 2, weights=w))
    weights = {"intercept": round(float(theta[0]), 4), **{k: round(float(v), 4) for k, v in zip(FEATURES, theta[1:])}}
    args.out.write_text(json.dumps(weights, indent=2) + "\n", encoding="utf-8")
    print(f"{len(x)} ejemplos · Brier={brier:.4f} → {args.out}")
    print(json.dumps({"router": {"heuristicWeights": weights}}, indent=2))


if __name__ == "__main__":
    main()
