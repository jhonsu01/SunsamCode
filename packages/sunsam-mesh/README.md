# Sunsam Mesh

Router P2P para Sunsam Code: decide por petición si la resuelve un **modelo pequeño local**
(SLM destilado con RLCD) o un **modelo grande en la red** (otra máquina, Petals, u otro nodo Sunsam
Mesh), y genera en segundo plano los datasets para mejorar ese SLM y el propio router.

Especificación completa: [SPEC.md](SPEC.md). Contrato del módulo: [src/CONTRACT.md](src/CONTRACT.md).

## Arranque rápido

```bash
pnpm sunsam:mesh:init          # crea ~/.sunsam/mesh.json a partir de mesh.example.json
# edita peers: tus LM Studio / vLLM / Ollama en la LAN (tier "local" o "swarm")
pnpm sunsam:mesh               # escucha en http://127.0.0.1:4141
```

En Sunsam Code → **Model settings → Add provider**:

| Campo      | Valor                                                               |
| ---------- | ------------------------------------------------------------------- |
| Base URL   | `http://127.0.0.1:4141`                                             |
| API format | OpenAI chat completions o Anthropic messages                        |
| API key    | `server.apiKey` (si lo configuraste)                                |
| Modelos    | `sunsam-auto`, `sunsam-local`, `sunsam-swarm` (y `<peer>/<modelo>`) |

Elegir el modelo en el chat **es** elegir el modo de enrutado.

## Opciones de la red P2P

| Opción                           | Qué hace                                                                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `router.classifier: "heuristic"` | Router de latencia cero sin dependencias.                                                                                                                                                        |
| `router.classifier: "laya"`      | Usa [Laya](https://huggingface.co/convaiinnovations/laya) (`pip install "laya[serve]"`, `/v1/systemone`): probabilidades calibradas por RLCD; si no responde en `timeoutMs` cae a la heurística. |
| `router.threshold`               | Umbral de `p_local` (0.75 por defecto, como la guía DeAI).                                                                                                                                       |
| `router.heuristicWeights`        | Pesos del router heurístico; se re-ajustan con `python/distill_router_weights.py`.                                                                                                               |
| `feedback.rlcd`                  | Pares `(prompt, chosen, rejected)` del teacher → `python/train_rlcd_dpo.py` (DPO).                                                                                                               |
| `feedback.byteDistill`           | Distribuciones **End-Of-Token** byte-level del teacher → `python/distill_byte_student.py`.                                                                                                       |
| `feedback.layaSoftLabels`        | Etiquetas blandas P(local) del teacher (marginal exacta del primer byte) para destilar el router / Laya.                                                                                         |
| `discovery`                      | Descubrimiento LAN de otros nodos (UDP firmado HMAC; requiere `sharedSecret`).                                                                                                                   |
| `peers[].bpbProbe`               | Mide **bits-per-byte** del peer (vLLM/llama.cpp) para rankear por calidad independiente del tokenizador.                                                                                         |

Los datasets se guardan en `feedback.dataDir` (`~/.sunsam/mesh-data/*.jsonl`) y nunca salen de la máquina.

## Endpoints

- `POST /v1/chat/completions`, `POST /v1/messages` — enrutado (stream incluido).
- `GET /v1/models` — modelos virtuales y directos.
- `GET /sunsam/status` — peers (salud, TTFT, bytes/s, BPB), calibración y cola de feedback.
- `POST /sunsam/feedback` `{ "decisionId": "...", "localSufficient": true }` — etiqueta explícita
  (el `decisionId` viene en la cabecera `x-sunsam-decision-id`).

## Pipeline de auto-mejora

```text
peticiones ─▶ router ─▶ peers
                 │
                 ├─ rlcd-pairs.jsonl ───────▶ train_rlcd_dpo.py ────────▶ SLM local mejor (tier local)
                 ├─ byte-distill.jsonl ─────▶ distill_byte_student.py ──▶ estudiante byte-level
                 ├─ laya-soft-labels.jsonl ─▶ distill_router_weights.py ▶ router.heuristicWeights
                 └─ decisions + feedback ───▶ /sunsam/status (Brier, ECE, umbral sugerido)
```

## Tests

```bash
pnpm --filter @sunsam/mesh test
```
