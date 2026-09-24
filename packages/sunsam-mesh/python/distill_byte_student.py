#!/usr/bin/env python3
"""Destila un estudiante *byte-level* a partir de `byte-distill.jsonl` (arXiv 2609.12303).

Cada registro trae, por token del teacher, las distribuciones sobre bytes convertidas con
End-Of-Token (bytes + <eot>) o Marginalize-It. El estudiante (vocabulario de 256 bytes + <eot> +
<bos> + <pad>) aprende con KL(teacher ‖ estudiante) en cada posición de la respuesta; el prompt
sólo aporta contexto. Con End-Of-Token la secuencia es [bytes del token, <eot>, ...] como en §2.2.

    python distill_byte_student.py --data ~/.sunsam/mesh-data/byte-distill.jsonl --out ./byte-student
"""
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import torch
import torch.nn.functional as F
from transformers import LlamaConfig, LlamaForCausalLM

EOT, BOS, PAD = 256, 257, 258
VOCAB = 259


def build_example(record: dict, max_prompt_bytes: int, min_coverage: float):
    prompt = "".join(f"{m['role']}: {m['text']}\n" for m in record["prompt"]) + "assistant: "
    context = [BOS] + list(prompt.encode("utf-8")[-max_prompt_bytes:])
    targets, dists = [], []
    for token in record["tokens"]:
        for position in token["positions"]:
            targets.append(position["target"])
            dense = torch.zeros(VOCAB)
            if position["coverage"] >= min_coverage and position["dist"]:
                for byte, prob in position["dist"]:
                    dense[byte] = prob
            else:
                dense[position["target"]] = 1.0  # sin señal fiable: cae a entropía cruzada normal
            dists.append(dense)
    # Entrada = contexto + objetivos desplazados; se predice cada objetivo desde lo anterior.
    input_ids = context + targets[:-1]
    return torch.tensor(input_ids), len(context) - 1, torch.stack(dists)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=Path("~/.sunsam/mesh-data/byte-distill.jsonl").expanduser())
    parser.add_argument("--student", default=None, help="checkpoint existente; si no, se crea uno pequeño")
    parser.add_argument("--out", default="./byte-student")
    parser.add_argument("--layers", type=int, default=8)
    parser.add_argument("--hidden", type=int, default=512)
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--lr", type=float, default=3e-4)
    parser.add_argument("--max-prompt-bytes", type=int, default=2048)
    parser.add_argument("--min-coverage", type=float, default=0.5)
    args = parser.parse_args()

    lines = args.data.expanduser().read_text(encoding="utf-8").splitlines()
    examples = [build_example(json.loads(line), args.max_prompt_bytes, args.min_coverage) for line in lines if line.strip()]
    device = "cuda" if torch.cuda.is_available() else "cpu"
    if args.student:
        model = LlamaForCausalLM.from_pretrained(args.student)
    else:
        config = LlamaConfig(
            vocab_size=VOCAB, hidden_size=args.hidden, intermediate_size=args.hidden * 4,
            num_hidden_layers=args.layers, num_attention_heads=8, num_key_value_heads=8,
            max_position_embeddings=8192, bos_token_id=BOS, eos_token_id=EOT, pad_token_id=PAD,
        )
        model = LlamaForCausalLM(config)
    model.to(device).train()
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)

    for epoch in range(args.epochs):
        random.shuffle(examples)
        total = 0.0
        for input_ids, start, teacher in examples:
            logits = model(input_ids=input_ids[None].to(device)).logits[0, start:]
            log_probs = F.log_softmax(logits.float(), dim=-1)
            # KL(teacher ‖ student) = Σ p_t (log p_t − log p_s); el término de entropía es constante.
            loss = -(teacher.to(device) * log_probs).sum(-1).mean()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            optimizer.zero_grad()
            total += loss.item()
        print(f"epoch {epoch + 1}: loss={total / max(1, len(examples)):.4f}")

    model.save_pretrained(args.out)
    print(f"Estudiante byte-level guardado en {args.out}")


if __name__ == "__main__":
    main()
