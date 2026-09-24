# Sunsam Code — mejoras y cómo sacarle el máximo provecho

## 1. Qué está implementado ya

| Pieza                                                                                     | Estado | Dónde                                                    |
| ----------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| Router DeAI (SLM local ↔ enjambre) con modelos virtuales `sunsam-auto/local/swarm`        | ✅     | `packages/sunsam-mesh`                                   |
| Clasificador Laya (`/v1/systemone`, probabilidades calibradas) con fallback heurístico    | ✅     | `adapters/layaClassifier.ts`                             |
| Enrutado _sticky_ por conversación (el bucle agente no cambia de modelo a mitad de tarea) | ✅     | `app/meshRouter.ts`                                      |
| Fallback antes del primer byte, salud y métricas por peer                                 | ✅     | `app/peerRegistry.ts`                                    |
| P2P entre máquinas: descubrimiento LAN firmado + anti-bucle por hops                      | ✅     | `adapters/lanDiscovery.ts`                               |
| RLCD: pares contrastivos del teacher → DPO del SLM                                        | ✅     | `app/feedbackJobs.ts`, `python/train_rlcd_dpo.py`        |
| Paper 2609.12303 (1): conversión token→byte **End-Of-Token / Marginalize-It**             | ✅     | `domain/byteLogits.ts`, `python/distill_byte_student.py` |
| Paper 2609.12303 (2): **bits-per-byte** y throughput en **bytes/s** para rankear peers    | ✅     | `domain/bitsPerByte.ts`, `app/healthMonitor.ts`          |
| Destilado del router (teacher/Laya → router de latencia cero)                             | ✅     | `python/distill_router_weights.py`                       |
| Shim OpenAI para Petals                                                                   | ✅     | `python/petals_openai_shim.py`                           |

## 2. Las dos funciones adaptadas del paper _"Breaking the Token Ceiling"_

### 2.1 Conversión token → byte (End-Of-Token), en una sola pasada

El paper convierte la distribución del teacher sobre ~128K tokens en distribuciones sobre ~257
símbolos (256 bytes + `<eot>`), **sin inferencias extra** del teacher:

- _Marginalize-It_: en cada byte, suma la probabilidad de los tokens cuyo prefijo coincide y
  renormaliza (pierde la masa de los tokens que terminan justo ahí).
- _End-Of-Token_: esa masa va al símbolo `<eot>` → la distribución es **exacta**.

En Sunsam se usa de dos formas:

1. **Dataset byte-level barato**: `feedback.byteDistill` pide al teacher `top_logprobs` y guarda
   las distribuciones byte-level dispersas (≤ 257 entradas por posición, frente a top-k sobre
   128K tokens). El paper mide ≈ 1/5 del almacenamiento y ≈ 1/6 de los datos para igualar al
   estudiante de tokens. `distill_byte_student.py` entrena con KL por posición.
2. **Etiquetas blandas independientes del tokenizador**: para destilar el router, el teacher
   responde "A" (local) o "B" (swarm) y la probabilidad se lee de la **distribución del primer
   byte**, que es exacta en ambos métodos. Sirve igual para Llama, Qwen, GLM o Gemma aunque sus
   tokenizadores troceen distinto.

Limitación honesta: las APIs OpenAI sólo devuelven `top_logprobs ≤ 20`. Cada posición guarda su
`coverage` (masa conocida); el script ignora posiciones con cobertura baja. Con vLLM y acceso a
logits completos el truncado desaparece, que es el caso ideal del paper.

### 2.2 Bits-per-byte (BPB) y bytes/s como moneda común

Tokens/s y perplexity por token no son comparables entre modelos con tokenizadores distintos.
Sunsam Mesh mide:

- **BPB** de cada peer sobre el mismo texto de calibración (`peers[].bpbProbe`, vLLM/llama.cpp
  con `echo` + `logprobs`): calidad comparable entre modelos.
- **bytes/s** del texto generado y **TTFT** en cada respuesta (EWMA).

El coste de cada peer = `quality·BPB + latency·TTFT + throughput·(1000/bytes_s) + load·inflight`,
con pesos distintos por tier (el tier local prima velocidad; el swarm prima calidad).

## 3. Cómo sacarle el máximo provecho

### Topología recomendada para tu red

```text
 Portátil (Sunsam Code + Sunsam Mesh :4141)
   ├─ tier local : LM Studio 192.168.1.8:1234  (Qwen2.5-Coder 1.5B/3B, GLM-OCR para imágenes)
   ├─ tier swarm : PC con GPU (vLLM, Qwen2.5-Coder-32B / Gemma 27B)  bpbProbe: true
   ├─ tier swarm : Petals (Llama 70B) vía python/petals_openai_shim.py
   └─ discovery  : otros nodos Sunsam Mesh de la LAN (secreto compartido)
 Laya (:8000) como clasificador del router
```

1. Registra en Sunsam Code **un solo** Custom provider: el gateway (`http://127.0.0.1:4141`).
   Deja los peers directos también como providers si quieres elegirlos a mano.
2. Usa `sunsam-auto` por defecto; fuerza `sunsam-swarm` para refactors grandes y
   `sunsam-local` para ediciones rápidas o trabajo sin red.
3. Activa `router.classifier: "laya"`: con probabilidades calibradas, `threshold: 0.75` significa
   literalmente "sólo mando a local si espero acertar ≥ 75 % de las veces".
4. Mira `GET /sunsam/status`: Brier/ECE altos o `suggestedThreshold` lejos de tu umbral indican
   deriva del router → re-destila (sección 4).

### Ciclo de mejora continua (semanal)

```bash
# 1) Acumular datos (en ~/.sunsam/mesh.json)
#    feedback.rlcd.enabled / byteDistill.enabled / layaSoftLabels.enabled = true
# 2) Router de latencia cero destilado del teacher
python packages/sunsam-mesh/python/distill_router_weights.py --out weights.json
# 3) SLM local mejor con RLCD + DPO
python packages/sunsam-mesh/python/train_rlcd_dpo.py --model Qwen/Qwen2.5-Coder-1.5B-Instruct
#    → convertir a GGUF (llama.cpp) y cargar en LM Studio como peer "local"
# 4) (experimental) estudiante byte-level con End-Of-Token
python packages/sunsam-mesh/python/distill_byte_student.py
```

## 4. Destilados de Laya

Laya (0.4B, no autoregresivo) responde preguntas tipadas con probabilidades calibradas en un solo
forward (~33 ms). En Sunsam cumple el papel de "Clasificador / Router" de la guía DeAI:

| Paso                              | Cómo                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| Servir Laya                       | `pip install "laya[serve]"` y su `examples/server.py` → `http://127.0.0.1:8000/v1/systemone`      |
| Preguntas del router              | `LAYA_ROUTE_QUESTIONS` (choice `local` / `swarm`), estado = texto del usuario + contexto numérico |
| Datos para especializarlo         | `laya-soft-labels.jsonl`: `{state, questions, soft_labels}` en el formato de Laya                 |
| Especializar Laya                 | Notebook oficial de fine-tuning (RLCD + calibración de temperatura) con esos registros            |
| Destilar Laya → router sin modelo | `distill_router_weights.py` sobre las mismas etiquetas → `router.heuristicWeights`                |

Así hay tres niveles: **teacher grande** (juez caro) → **Laya especializado** (33 ms, calibrado) →
**router logístico** (µs, sin GPU) como fallback cuando Laya no está disponible.

## 5. Opciones de mejora siguientes (por impacto / esfuerzo)

| #   | Mejora                                                                                                                                                | Impacto | Esfuerzo                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------- |
| 1   | **Panel "Sunsam Mesh" en Settings** (estado de peers, umbral, toggles de feedback) leyendo `/sunsam/status`                                           | Alto    | Medio                        |
| 2   | **Escalado automático**: si el SLM local devuelve tool-calls inválidos o el usuario reintenta, re-enviar al swarm y etiquetar `localSufficient=false` | Alto    | Medio                        |
| 3   | **Evaluación en sombra**: una fracción de peticiones locales también va al swarm y Laya (`noul`) juzga si eran equivalentes → etiquetas automáticas   | Alto    | Medio                        |
| 4   | **Speculative decoding en red**: el SLM local propone y el modelo grande verifica (vLLM)                                                              | Alto    | Alto                         |
| 5   | **Caché semántica** por conversación (respuestas repetidas de herramientas)                                                                           | Medio   | Bajo                         |
| 6   | **Logits completos con vLLM** (`logprobs=-1`) para End-Of-Token sin truncado top-k                                                                    | Medio   | Bajo                         |
| 7   | **Arrancar Sunsam Mesh desde la app** (proceso gestionado por Main, como los demás servicios)                                                         | Medio   | Medio                        |
| 8   | **Cuantización del SLM RLCD** a GGUF Q4_K_M / ONNX INT4 para portátiles sin GPU                                                                       | Medio   | Bajo                         |
| 9   | **Mesh fuera de la LAN** (WireGuard/Tailscale + `advertiseUrl`)                                                                                       | Medio   | Bajo                         |
| 10  | **Firma de binarios** (Apple Developer ID, certificado Windows) en el workflow                                                                        | Medio   | Bajo (requiere certificados) |
| 11  | **zkML / pruebas de ejecución** (guía §7.3): publicar sólo hashes de validación                                                                       | Bajo    | Alto                         |

## 6. Lo que queda fuera de esta versión (honestidad)

- La pantalla de bienvenida sigue ofreciendo _Connect to Z.ai / BigModel_ además de _Use API key_;
  sólo Model settings se limitó a Custom providers. Se puede ocultar con el mismo flag si lo prefieres.
- Los instaladores de Windows y macOS se compilan en GitHub Actions; en este entorno sólo se pudo
  compilar y arrancar la versión Linux (AppImage + deb).
- El entrenamiento (DPO, estudiante byte-level) requiere GPU y no se ejecutó aquí; los scripts se
  validaron sintácticamente y el destilado del router con datos sintéticos.
