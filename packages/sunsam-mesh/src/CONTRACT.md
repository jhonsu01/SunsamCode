# sunsam-mesh — contrato

- `startMesh(config, logger)` levanta el gateway; `MeshHandle.close()` es idempotente respecto a la cola
  (espera a que terminen los trabajos de feedback en curso).
- Estado de peers: único propietario `PeerRegistry`. Tier por conversación: único propietario
  `MeshRouter` (sticky). Datasets: sólo `FeedbackJobs` y el feedback explícito escriben.
- Fallback sólo antes del primer byte de respuesta; después, un fallo corta el stream sin reintentos.
- `endOfTokenByteDistributions` devuelve `bytes + 1` posiciones (la última predice `<eot>` = 256);
  `marginalizeItByteDistributions` devuelve `bytes` posiciones. Ambas son exactas en el primer byte.
- `bitsPerByte` ignora tokens sin bytes o con logprob no finita; `null` si no queda nada que puntuar.
- Exponer el gateway fuera de loopback exige `server.apiKey`; el descubrimiento LAN exige secreto compartido.
