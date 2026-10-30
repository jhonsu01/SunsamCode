/**
 * Sunsam: la página móvil la sirve la app de escritorio por HTTP en la red local
 * (`http://192.168.x.x:47831/remote/v4`). Fuera de HTTPS/localhost el navegador no expone
 * `crypto.subtle`, `crypto.randomUUID` ni `navigator.clipboard` (sólo existen en contextos seguros), así que aquí van
 * sustitutos equivalentes. `crypto.getRandomValues` sí existe en cualquier contexto.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** SHA-256 (FIPS 180-4) en JavaScript puro. */
export function sha256(message: Uint8Array): Uint8Array {
  const bitLength = message.length * 8;
  const paddedLength = Math.ceil((message.length + 9) / 64) * 64;
  const data = new Uint8Array(paddedLength);
  data.set(message);
  data[message.length] = 0x80;
  const view = new DataView(data.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h as unknown as number[];
    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(e!, 6) ^ rotr(e!, 11) ^ rotr(e!, 25);
      const ch = (e! & f!) ^ (~e! & g!);
      const t1 = (hh! + s1 + ch + K[i]! + w[i]!) >>> 0;
      const s0 = rotr(a!, 2) ^ rotr(a!, 13) ^ rotr(a!, 22);
      const maj = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const t2 = (s0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d! + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0]! + a!) >>> 0;
    h[1] = (h[1]! + b!) >>> 0;
    h[2] = (h[2]! + c!) >>> 0;
    h[3] = (h[3]! + d!) >>> 0;
    h[4] = (h[4]! + e!) >>> 0;
    h[5] = (h[5]! + f!) >>> 0;
    h[6] = (h[6]! + g!) >>> 0;
    h[7] = (h[7]! + hh!) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i += 1) outView.setUint32(i * 4, h[i]!);
  return out;
}

/**
 * `crypto.subtle` mínimo: sólo `digest("SHA-256")`, que usan los adjuntos (suma de verificación),
 * las vistas de plugins y las referencias de PPTX. El resto de operaciones se rechaza, así que el
 * código que dependa de ellas falla igual que sin `crypto.subtle`.
 */
export function createSunsamDigestOnlySubtle(): Pick<SubtleCrypto, "digest"> {
  const unsupported = () =>
    Promise.reject(
      new DOMException("Only SHA-256 digest is available over HTTP", "NotSupportedError"),
    );
  return new Proxy(
    {
      digest(algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer> {
        const name = typeof algorithm === "string" ? algorithm : algorithm?.name;
        if (String(name).toUpperCase().replace("_", "-") !== "SHA-256")
          return unsupported() as Promise<ArrayBuffer>;
        const bytes = ArrayBuffer.isView(data)
          ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
          : new Uint8Array(data as ArrayBuffer);
        const hash = sha256(bytes);
        return Promise.resolve(
          hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength) as ArrayBuffer,
        );
      },
    },
    { get: (target, prop) => (prop in target ? target[prop as "digest"] : unsupported) },
  );
}

function randomUuidFallback(): `${string}-${string}-${string}-${string}-${string}` {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Añade `crypto.randomUUID` cuando la página no está en un contexto seguro. */
export function installSunsamInsecureContextPolyfills(): void {
  const cryptoObject = globalThis.crypto as Crypto | undefined;
  if (cryptoObject && !cryptoObject.subtle) {
    try {
      Object.defineProperty(cryptoObject, "subtle", {
        value: createSunsamDigestOnlySubtle(),
        configurable: true,
      });
    } catch {
      // `crypto` congelado: los adjuntos muestran su error de siempre.
    }
  }
  if (cryptoObject && typeof cryptoObject.randomUUID !== "function") {
    try {
      Object.defineProperty(cryptoObject, "randomUUID", {
        value: randomUuidFallback,
        configurable: true,
        writable: true,
      });
    } catch {
      // Algunos navegadores congelan `crypto`: los llamadores ya tienen su propio respaldo.
    }
  }
}

/**
 * Copia texto sin la API Clipboard: textarea oculto + `execCommand("copy")`, que sí funciona por
 * HTTP mientras dure el gesto del usuario (el toque en el botón de copiar).
 */
export function copyTextWithExecCommand(text: string, doc: Document = document): boolean {
  const textarea = doc.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  // Fuera de pantalla y con 16px: en iOS un tamaño menor hace zoom al enfocar.
  textarea.style.cssText =
    "position:fixed;top:0;left:-9999px;opacity:0;font-size:16px;pointer-events:none;";
  doc.body.appendChild(textarea);
  const selection = doc.getSelection();
  const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  textarea.focus({ preventScroll: true });
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  let copied = false;
  try {
    copied = doc.execCommand("copy");
  } catch {
    copied = false;
  }
  textarea.remove();
  if (previousRange && selection) {
    selection.removeAllRanges();
    selection.addRange(previousRange);
  }
  return copied;
}

/**
 * Sin contexto seguro `navigator.clipboard` no existe y los botones de copiar (tablas, código,
 * mensajes) fallaban con "clipboard-unavailable". Se instala un `writeText` equivalente; leer del
 * portapapeles o copiar imágenes sigue sin ser posible por HTTP.
 */
export function installSunsamClipboardFallback(nav: Navigator = navigator): void {
  // `clipboard` no existe fuera de HTTPS aunque los tipos del DOM lo declaren siempre.
  if (typeof (nav.clipboard as Clipboard | undefined)?.writeText === "function") return;
  const fallback = {
    writeText: (text: string) =>
      copyTextWithExecCommand(String(text))
        ? Promise.resolve()
        : Promise.reject(new DOMException("Copy command was rejected", "NotAllowedError")),
    readText: () =>
      Promise.reject(new DOMException("Clipboard read needs HTTPS", "NotAllowedError")),
  };
  try {
    Object.defineProperty(nav, "clipboard", { value: fallback, configurable: true });
  } catch {
    // Navegador que no deja redefinirlo: los botones muestran su error de siempre.
  }
}

installSunsamInsecureContextPolyfills();
if (typeof navigator !== "undefined" && typeof document !== "undefined") {
  installSunsamClipboardFallback();
}
