#!/usr/bin/env python3
"""Entrena el SLM local con DPO sobre los pares RLCD que genera Sunsam Mesh (guía DeAI §4).

    python train_rlcd_dpo.py --data ~/.sunsam/mesh-data/rlcd-pairs.jsonl \
        --model Qwen/Qwen2.5-Coder-1.5B-Instruct --out ./slm_rlcd_final

Después exporta a GGUF (llama.cpp) o sírvelo con LM Studio/vLLM y regístralo como peer `local`.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import torch
from datasets import load_dataset
from transformers import AutoModelForCausalLM, AutoTokenizer
from trl import DPOConfig, DPOTrainer


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=Path("~/.sunsam/mesh-data/rlcd-pairs.jsonl").expanduser())
    parser.add_argument("--model", default="Qwen/Qwen2.5-Coder-1.5B-Instruct")
    parser.add_argument("--out", default="./slm_rlcd_final")
    parser.add_argument("--beta", type=float, default=0.1)
    parser.add_argument("--epochs", type=float, default=1.0)
    parser.add_argument("--lr", type=float, default=5e-6)
    args = parser.parse_args()

    # Formato conversacional (prompt/chosen/rejected) que TRL acepta directamente.
    dataset = load_dataset("json", data_files=str(args.data.expanduser()), split="train").remove_columns(["meta"])
    tokenizer = AutoTokenizer.from_pretrained(args.model)
    bf16 = torch.cuda.is_available() and torch.cuda.is_bf16_supported()
    model = AutoModelForCausalLM.from_pretrained(args.model, torch_dtype=torch.bfloat16 if bf16 else torch.float32)

    config = DPOConfig(
        output_dir=f"{args.out}-checkpoints",
        beta=args.beta,
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        learning_rate=args.lr,
        num_train_epochs=args.epochs,
        logging_steps=10,
        bf16=bf16,
    )
    # ref_model=None: TRL crea la referencia congelada a partir del modelo inicial.
    trainer = DPOTrainer(model=model, ref_model=None, args=config, train_dataset=dataset, processing_class=tokenizer)
    trainer.train()
    trainer.save_model(args.out)
    tokenizer.save_pretrained(args.out)
    print(f"Modelo RLCD guardado en {args.out}")


if __name__ == "__main__":
    main()
