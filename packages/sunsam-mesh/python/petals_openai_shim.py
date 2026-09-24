#!/usr/bin/env python3
"""Expone un modelo del enjambre Petals como API OpenAI mínima para Sunsam Mesh (tier `swarm`).

    pip install petals fastapi uvicorn
    python petals_openai_shim.py --model meta-llama/Meta-Llama-3.1-70B-Instruct --port 8090

Registra el peer en ~/.sunsam/mesh.json con baseUrl http://127.0.0.1:8090/v1 y tier "swarm".
Streaming simplificado: se genera la respuesta completa y se envía como un único chunk SSE.
"""
from __future__ import annotations

import argparse
import json
import time
import uuid

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from petals import AutoDistributedModelForCausalLM
from transformers import AutoTokenizer


def create_app(model_name: str) -> FastAPI:
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoDistributedModelForCausalLM.from_pretrained(model_name)  # capas repartidas en la DHT
    app = FastAPI()

    @app.get("/v1/models")
    def models():
        return {"object": "list", "data": [{"id": model_name, "object": "model"}]}

    @app.post("/v1/chat/completions")
    async def chat(request: Request):
        body = await request.json()
        messages = [{"role": m["role"], "content": m.get("content") or ""} for m in body.get("messages", [])]
        inputs = tokenizer.apply_chat_template(messages, add_generation_prompt=True, return_tensors="pt")
        max_new = int(body.get("max_tokens") or 512)
        temperature = float(body.get("temperature") or 0)
        output = model.generate(inputs, max_new_tokens=max_new, do_sample=temperature > 0, temperature=temperature or None)
        text = tokenizer.decode(output[0, inputs.shape[1]:], skip_special_tokens=True)
        completion_id = f"chatcmpl-{uuid.uuid4().hex}"
        if body.get("stream"):
            def events():
                chunk = {"id": completion_id, "object": "chat.completion.chunk", "created": int(time.time()), "model": model_name,
                         "choices": [{"index": 0, "delta": {"role": "assistant", "content": text}, "finish_reason": "stop"}]}
                yield f"data: {json.dumps(chunk)}\n\n"
                yield "data: [DONE]\n\n"
            return StreamingResponse(events(), media_type="text/event-stream")
        return JSONResponse({"id": completion_id, "object": "chat.completion", "created": int(time.time()), "model": model_name,
                             "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}]})

    return app


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="meta-llama/Meta-Llama-3.1-70B-Instruct")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8090)
    args = parser.parse_args()
    uvicorn.run(create_app(args.model), host=args.host, port=args.port)
