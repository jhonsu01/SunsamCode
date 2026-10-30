import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  copyTextWithExecCommand,
  createSunsamDigestOnlySubtle,
  installSunsamClipboardFallback,
  sha256,
} from "../src/sunsamInsecureContext.js";
import { readSunsamLocalKey, resolveSunsamEntryAuth } from "../src/sunsamLocalAuth.js";

const encoder = new TextEncoder();
const hex = (bytes: Uint8Array | ArrayBuffer) => Buffer.from(new Uint8Array(bytes)).toString("hex");

describe("Sunsam insecure-context polyfills", () => {
  it("matches Node's SHA-256 for empty, short and multi-block inputs", () => {
    for (const input of ["", "abc", "x".repeat(55), "y".repeat(64), "z".repeat(1000)]) {
      expect(hex(sha256(encoder.encode(input)))).toBe(
        createHash("sha256").update(input).digest("hex"),
      );
    }
  });

  it("provides crypto.subtle.digest('SHA-256') for attachments over HTTP, and nothing else", async () => {
    const subtle = createSunsamDigestOnlySubtle() as SubtleCrypto;
    const data = encoder.encode("adjunto.png");
    expect(hex(await subtle.digest("SHA-256", data))).toBe(
      createHash("sha256").update("adjunto.png").digest("hex"),
    );
    expect(hex(await subtle.digest({ name: "SHA-256" }, data.buffer))).toBe(
      createHash("sha256").update("adjunto.png").digest("hex"),
    );
    await expect(subtle.digest("SHA-1", data)).rejects.toThrow();
    await expect(
      (subtle as unknown as { importKey: () => Promise<unknown> }).importKey(),
    ).rejects.toThrow();
  });

  it("copies text without the Clipboard API, as served over HTTP on the LAN", async () => {
    const copied: string[] = [];
    const appended: Array<{ value: string; remove: () => void }> = [];
    const doc = {
      createElement: () => {
        const el = {
          value: "",
          style: { cssText: "" },
          setAttribute: () => {},
          focus: () => {},
          select: () => {},
          setSelectionRange: () => {},
          remove: () => appended.splice(appended.indexOf(el), 1),
        };
        return el;
      },
      body: { appendChild: (el: { value: string; remove: () => void }) => appended.push(el) },
      getSelection: () => null,
      execCommand: (command: string) => {
        if (command !== "copy") return false;
        copied.push(appended.at(-1)?.value ?? "");
        return true;
      },
    } as unknown as Document;
    expect(copyTextWithExecCommand("| a | b |", doc)).toBe(true);
    expect(copied).toEqual(["| a | b |"]);
    expect(appended).toHaveLength(0);

    const nav = {} as Navigator;
    installSunsamClipboardFallback(nav);
    expect(typeof nav.clipboard.writeText).toBe("function");
    await expect(nav.clipboard.readText()).rejects.toThrow();

    const secure = { clipboard: { writeText: async () => {} } } as unknown as Navigator;
    const original = secure.clipboard;
    installSunsamClipboardFallback(secure);
    expect(secure.clipboard).toBe(original);
  });
});

describe("Sunsam local auth for the phone", () => {
  const memory = () => {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key),
    };
  };

  it("takes the secret from the QR fragment and remembers it for reloads", () => {
    const storage = memory();
    expect(readSunsamLocalKey({ hash: "#k=s3cr3t", hostname: "192.168.1.8" }, storage)).toBe(
      "s3cr3t",
    );
    expect(readSunsamLocalKey({ hash: "", hostname: "192.168.1.8" }, storage)).toBe("s3cr3t");
  });

  it("never uses a local secret on the official z.ai page", () => {
    const storage = memory();
    storage.setItem("sunsam-remote-local-key", "s3cr3t");
    expect(readSunsamLocalKey({ hash: "#k=x", hostname: "zcode.z.ai" }, storage)).toBeNull();
  });

  it("uses the secret as the relay JWT, and forgets it on 'switch account'", async () => {
    const storage = memory();
    storage.setItem("sunsam-remote-local-key", "s3cr3t");
    const base = {
      getZCodeJwtToken: () => null,
      getActiveAccount: () => null,
      startLogin: async () => {},
      logout: async () => {},
    } as unknown as Parameters<typeof resolveSunsamEntryAuth>[0];
    expect(resolveSunsamEntryAuth(base, null)).toBe(base);
    const auth = resolveSunsamEntryAuth(base, "s3cr3t", storage);
    expect(auth.getZCodeJwtToken()).toBe("s3cr3t");
    await auth.logout();
    expect(storage.getItem("sunsam-remote-local-key")).toBeNull();
  });
});
