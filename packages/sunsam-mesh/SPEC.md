# Sunsam Mesh — especificación

Gateway local compatible con OpenAI (`/v1/chat/completions`) y Anthropic (`/v1/messages`) que
enruta cada petición de Sunsam Code entre máquinas de la red (LM Studio, Ollama, vLLM, llama.cpp,
Petals vía shim, u otros nodos Sunsam Mesh). Se integra en la app **sin tocar código de upstream**:
se añade como _Custom provider_ con Base URL `http://127.0.0.1:4141` y los modos de enrutado
aparecen como modelos seleccionables en el chat.

Implementa la arquitectura DeAI de la guía (Router + SLM destilado con RLCD + enjambre P2P) y dos
técnicas del paper _Breaking the Token Ceiling: Distilling Smaller, Stronger Byte Models_
(arXiv 2609.12303): conversión token→byte **End-Of-Token / Marginalize-It** y la métrica
**bits-per-byte (BPB)**.

## 1. Producto

| Modelo virtual    | Comportamiento                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------ |
| `sunsam-auto`     | El router decide por petición: `p_local ≥ threshold` → tier `local`; si no → tier `swarm`. |
| `sunsam-local`    | Fuerza el tier `local` (SLM destilado / modelo pequeño en el edge).                        |
| `sunsam-swarm`    | Fuerza el tier `swarm` (modelo grande en red, Petals u otro nodo mesh).                    |
| `<peer>/<modelo>` | Envía directamente a un modelo concreto de un peer.                                        |

Opciones (fichero `~/.sunsam/mesh.json`, ver `mesh.example.json`):

- `router.classifier`: `heuristic` (cero dependencias, por defecto) o `laya` (endpoint
  `POST /v1/systemone` de Laya; probabilidades calibradas por RLCD). Si Laya no responde dentro de
  `router.laya.timeoutMs`, se usa la heurística y la decisión queda marcada `classifier=heuristic-fallback`.
- `router.threshold` (0.75 por defecto, igual que la guía). Con Laya la probabilidad está calibrada,
  así que el umbral equivale a "tasa de acierto esperada del tier local".
- `router.stickyTtlMs`: una conversación mantiene su tier mientras dure el bucle agente (ver §3).
- `router.heuristicWeights`: pesos del router logístico. `python/distill_router_weights.py` los
  re-ajusta con las etiquetas blandas del teacher (destilación a un router de latencia cero).
- `feedback.rlcd`: genera pares contrastivos `(prompt, chosen, rejected)` para DPO.
- `feedback.byteDistill`: vuelca distribuciones byte-level End-Of-Token del teacher.
- `feedback.layaSoftLabels`: etiquetas blandas del teacher para destilar un router Laya propio.
- `discovery`: descubrimiento LAN de otros nodos Sunsam Mesh (UDP firmado con HMAC).

## 2. Propietarios del estado

| Estado                                                          | Único propietario                  | Escritores                                          |
| --------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------- |
| Estado de peers (salud, TTFT EWMA, bytes/s EWMA, BPB, inflight) | `PeerRegistry` (app)               | Resultados de forward, sondas de salud, beacons LAN |
| Decisión de tier por conversación                               | `MeshRouter.stickyDecisions` (app) | Solo `MeshRouter.route`                             |
| Cola de trabajos de feedback                                    | `FeedbackJobs` (app)               | `MeshRouter` encola; la cola ejecuta en serie       |
| Datasets JSONL                                                  | `DatasetSink` (adapter)            | Solo `FeedbackJobs` y `/sunsam/feedback`            |

El gateway HTTP no guarda estado: traduce HTTP ⇄ `MeshRouter`.

## 3. Orden de eventos de una petición

```
app ──POST /v1/chat/completions──▶ gateway
gateway ─▶ MeshRouter.route(req)
   1. resolveVirtualModel(model)            → modo auto|local|swarm|direct
   2. conversationKey = hash(primer mensaje de usuario)
      sticky hit (no expirado)              → reutiliza tier (idempotente por conversación)
      sticky miss                           → Classifier.localProbability(features) → decideTier
   3. rankPeers(tier, formato API)          → candidatos ordenados por coste
   4. forward al primer candidato; si falla ANTES del primer byte → siguiente candidato
      (mismo tier y luego el otro tier). Tras el primer byte no hay reintento (evita respuestas
      duplicadas).
   5. stream observado (tee) → texto, TTFT, bytes/s → PeerRegistry.recordSuccess
   6. fin de stream → FeedbackJobs.enqueue(...) (muestreado, fuera del camino crítico)
gateway ◀─ respuesta (+ cabeceras x-sunsam-route, x-sunsam-peer, x-sunsam-decision-id, x-sunsam-p-local)
```

Regla de enrutado sticky: en un bucle agente las continuaciones (resultados de herramientas) no
deben cambiar de modelo a mitad de tarea. La clave es el hash del primer mensaje de usuario +
modelo virtual; expira tras `stickyTtlMs` sin uso.

## 4. Mesh P2P entre máquinas

- Un nodo Sunsam Mesh es, a su vez, un peer OpenAI/Anthropic compatible de otros nodos (`kind: "mesh"`).
- Beacons UDP (`discovery.port`, 41414 por defecto) cada `discovery.intervalMs` con
  `{nodeId, url, tiers, formats, ts}` firmados con HMAC-SHA256(`discovery.sharedSecret`).
  Beacons sin firma válida o con `ts` fuera de ±30 s se descartan (anti-replay básico).
- Anti-bucle: cabecera `x-sunsam-hops`. Un nodo que recibe `hops ≥ mesh.maxHops` solo enruta a
  peers directos (no `mesh`).
- Seguridad: si `server.host` no es loopback, `server.apiKey` es obligatorio (el arranque falla).

## 5. Funciones del paper

1. **Byte logits (End-Of-Token / Marginalize-It)** — `domain/byteLogits.ts`.
   - Marginalize-It: para el byte `j` del token objetivo `g`, candidatos = tokens cuyo prefijo
     coincide con `g[0..j)` y con longitud > j; se renormaliza (aproximado salvo para el primer byte).
   - End-Of-Token: candidatos = tokens con prefijo `g[0..j)` (incluidos los de longitud `j`); la masa
     de los que terminan exactamente ahí va a `<eot>` (índice 256). Exacto, sin inferencias extra.
   - Con APIs que solo dan top-k (`top_logprobs ≤ 20`) se registra `coverage` (masa conocida) por
     posición; el paper evita el truncado top-k con acceso a logits completos (vLLM `logprobs=-1`).
   - Uso: dataset byte-level para destilar un SLM byte-level, y **etiquetas blandas independientes
     del tokenizador** para destilar Laya (distribución exacta del primer byte sobre etiquetas).
2. **Bits-per-byte** — `domain/bitsPerByte.ts`. BPB = Σ −ln p / (ln 2 · Σ bytes). Permite comparar
   peers con tokenizadores distintos; junto con throughput en **bytes/s** (no tokens/s) alimenta el
   coste de `rankPeers`. Sonda opcional por peer: `/v1/completions` con `echo` + `logprobs`
   (vLLM, llama.cpp); si el peer no lo soporta, BPB queda desconocido y se usa `routing.defaultBpb`.

## 6. Fallos

| Caso                                              | Resultado                                               |
| ------------------------------------------------- | ------------------------------------------------------- |
| Ningún peer sano para el formato pedido           | 503 `{"error":{"type":"sunsam_no_peer"}}`               |
| Todos los candidatos fallan antes del primer byte | 502 con la lista de intentos                            |
| Laya caído / timeout                              | heurística, `classifier=heuristic-fallback`             |
| Fallo en un trabajo de feedback                   | log `warn`, no afecta a la respuesta                    |
| Peer falla tras el primer byte                    | se corta el stream; peer marcado no sano; sin reintento |

## 7. Aceptación

- Ejemplo "Tiramisu" del paper reproduce P(u)=0.667, P(k)=0.167, P(eot)=0.167 (End-Of-Token) y
  P(u)=0.8, P(k)=0.2 (Marginalize-It).
- Petición corta sin herramientas → `sunsam-auto` elige `local`; tarea multi-fichero → `swarm`.
- Continuación de la misma conversación mantiene tier (sticky).
- Peer local caído antes del primer byte → responde el siguiente candidato.
- Gateway real (HTTP) reenvía stream SSE de un upstream falso y añade cabeceras `x-sunsam-*`.
- Arranque con `host: 0.0.0.0` y sin `apiKey` → error.
