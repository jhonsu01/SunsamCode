// Sunsam: el relay local tiene que entenderse con los clientes y transportes reales de upstream
// (Relay V2: HTTP de registro/tokens del escritorio, lista de equipos y tokens del móvil, y los
// transportes WebSocket de ambos), no sólo con un cliente de prueba.
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import type { WebRemoteControlAppPayload } from "@zcode/shared";
import { createSunsamLocalRemoteServer } from "../src/main/sunsamLocalRemoteRelay.js";
import { createWebRemoteControlV2Http } from "../src/main/web-remote-relay/webRemoteControlV2Http.js";
import { WebRemoteControlDeviceTransport } from "../src/main/web-remote-relay/webRemoteControlTransport.js";
import { WebRemoteControlTerminalTransport } from "../../web/src/web-remote-control/adapters/webRemoteControlTransport.js";
import { createWebRemoteControlV2TokenClient } from "../../web/src/web-remote-control/adapters/webRemoteControlV2Token.js";
import { createWebRemoteControlDeviceClient } from "../../web/src/web-remote-control/adapters/webRemoteControlDeviceClient.js";

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()?.();
});

function waitFor(check: () => boolean, label: string, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (check()) return resolve();
      if (Date.now() - started > timeoutMs) return reject(new Error(`timeout: ${label}`));
      setTimeout(tick, 20);
    };
    tick();
  });
}

const silent = { info: () => {}, warn: () => {}, error: () => {} };

describe("Sunsam local relay with the real upstream Relay V2 clients", () => {
  it("registers the desktop, lists it on the phone, pairs both and delivers payloads", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sunsam-remote-e2e-"));
    await mkdir(join(dir, "web"), { recursive: true });
    await writeFile(join(dir, "web", "index.html"), "<!doctype html>");
    await writeFile(
      join(dir, "sunsam-remote-control.json"),
      JSON.stringify({ port: 48110 + Math.floor(Math.random() * 40), host: "lan" }),
    );
    const server = createSunsamLocalRemoteServer({
      webRoot: join(dir, "web"),
      configDir: dir,
      logger: silent,
    });
    cleanups.push(async () => {
      await server.stop();
      await rm(dir, { recursive: true, force: true });
    });
    const endpoints = await server.getEndpoints();
    const jwt = endpoints.login.jwt;
    // El QR lleva el secreto en el fragmento, nunca en la query.
    expect(new URL(endpoints.remoteUrl).hash).toBe(`#k=${encodeURIComponent(jwt)}`);
    expect(new URL(endpoints.remoteUrl).search).toBe("");

    // Escritorio: cliente HTTP V2 de upstream contra el origen local.
    const http = createWebRemoteControlV2Http(endpoints.origin);
    const controller = new AbortController();
    cleanups.push(() => controller.abort());
    const deviceSid = await http.register("test-mid", jwt, controller.signal);

    const deviceStates: string[] = [];
    const desktopReceived: WebRemoteControlAppPayload[] = [];
    const device = new WebRemoteControlDeviceTransport({
      relayWsUrl: endpoints.relayWsUrl,
      deviceMid: "test-mid",
      meta: { platform: "win32", version: "3.17.1-sunsam.1", name: "pc" },
      getToken: (signal) => http.token(jwt, signal),
      resolveDeviceSid: async () => deviceSid,
      logger: silent,
      onStateChange: (state) => deviceStates.push(state),
      onPayload: (payload) => desktopReceived.push(payload),
      onError: () => {},
    });
    cleanups.push(() => device.dispose());
    device.start();
    await waitFor(() => deviceStates.includes("waiting_terminal"), "desktop waiting for phone");

    // Móvil: la lista de equipos y los tokens usan el mismo secreto (origen de la página).
    const phoneOrigin = endpoints.origin;
    const devices = await createWebRemoteControlDeviceClient(phoneOrigin)(jwt, controller.signal);
    expect(devices).toEqual([
      expect.objectContaining({ device_sid: deviceSid, online: true, device_mid: "test-mid" }),
    ]);
    const phoneToken = createWebRemoteControlV2TokenClient(phoneOrigin);

    const phoneStates: string[] = [];
    const phoneReceived: WebRemoteControlAppPayload[] = [];
    const phone = new WebRemoteControlTerminalTransport({
      relayWsUrl: endpoints.relayWsUrl,
      deviceSid,
      deviceMid: "test-mid",
      getToken: (signal) => phoneToken(jwt, signal),
      WebSocketCtor: WebSocket as unknown as typeof globalThis.WebSocket,
      onPayload: (payload) => phoneReceived.push(payload),
      onStateChange: (state) => phoneStates.push(state),
      onFailure: () => {},
      onError: () => {},
      reloadPage: () => {},
    });
    cleanups.push(() => phone.dispose());
    phone.start();

    await waitFor(() => phoneStates.includes("paired"), "phone paired");
    await waitFor(() => deviceStates.includes("paired"), "desktop paired");

    const request = {
      zcode_type: "workspace-list-request",
      requestId: "r1",
    } as WebRemoteControlAppPayload;
    expect(phone.sendPayload(request)).toBe(true);
    await waitFor(() => desktopReceived.length > 0, "desktop received request");
    expect(desktopReceived[0]).toMatchObject({ zcode_type: "workspace-list-request" });

    const reply = {
      zcode_type: "app-error",
      requestId: "r1",
      reason: "relay-unavailable",
      error: "test",
    } as WebRemoteControlAppPayload;
    expect(device.sendPayload(reply)).toBe(true);
    await waitFor(() => phoneReceived.length > 0, "phone received reply");
    expect(phoneReceived[0]).toMatchObject({ zcode_type: "app-error", requestId: "r1" });
  });
});
