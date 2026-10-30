import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import {
  createSunsamLocalRemoteServer,
  listSunsamRemoteAddresses,
  resolveSunsamRemoteHost,
} from "../src/main/sunsamLocalRemoteRelay.js";

type Message = Record<string, unknown>;

class Client {
  private readonly queue: Message[] = [];
  private waiters: Array<(message: Message) => void> = [];
  constructor(readonly socket: WebSocket) {
    socket.on("message", (raw) => {
      const message = JSON.parse(String(raw)) as Message;
      const waiter = this.waiters.shift();
      if (waiter) waiter(message);
      else this.queue.push(message);
    });
  }
  static open(url: string): Promise<Client> {
    const socket = new WebSocket(url);
    return new Promise((resolve, reject) => {
      socket.once("open", () => resolve(new Client(socket)));
      socket.once("error", reject);
      socket.once("unexpected-response", (_request, response) =>
        reject(new Error(`HTTP ${response.statusCode}`)),
      );
    });
  }
  send(message: Message): void {
    this.socket.send(JSON.stringify(message));
  }
  next(): Promise<Message> {
    const queued = this.queue.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), 3000);
      this.waiters.push((message) => {
        clearTimeout(timer);
        resolve(message);
      });
    });
  }
  close(): void {
    this.socket.close();
  }
}

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()?.();
});

async function startServer(config?: Record<string, unknown>) {
  const dir = await mkdtemp(join(tmpdir(), "sunsam-remote-"));
  const webRoot = join(dir, "web");
  await mkdir(join(webRoot, "assets"), { recursive: true });
  await writeFile(join(webRoot, "index.html"), "<!doctype html><title>remote</title>");
  await writeFile(join(webRoot, "assets", "app.js"), "console.log(1)");
  const configDir = join(dir, "config");
  await mkdir(configDir, { recursive: true });
  await writeFile(
    join(configDir, "sunsam-remote-control.json"),
    JSON.stringify({ port: 47950 + Math.floor(Math.random() * 40), host: "lan", ...config }),
  );
  const server = createSunsamLocalRemoteServer({
    webRoot,
    configDir,
    logger: { info: () => {}, warn: () => {} },
  });
  cleanups.push(async () => {
    await server.stop();
    await rm(dir, { recursive: true, force: true });
  });
  const endpoints = await server.getEndpoints();
  const port = new URL(endpoints.relayWsUrl).port;
  const api = async (path: string, body?: unknown, jwt = endpoints.login.jwt) => {
    const response = await fetch(`${endpoints.origin}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: (await response.json()) as Message };
  };
  const token = async (role: "device" | "terminal") =>
    String(((await api("/api/v1/remote/token", { role })).body.data as Message).token);
  const connect = async (role: "device" | "terminal", deviceSid: string) => {
    const client = await Client.open(`${endpoints.relayWsUrl}?token=${await token(role)}`);
    cleanups.push(async () => client.close());
    client.send({ type: "auth_init", device_sid: deviceSid, client_ts: 1 });
    return { client, ack: await client.next() };
  };
  return { server, endpoints, port, configDir, api, token, connect };
}

describe("Sunsam local remote relay (Relay V2)", () => {
  it("requires the local secret for every API call", async () => {
    const { api } = await startServer();
    expect((await api("/api/v1/remote/device", undefined, "wrong")).status).toBe(401);
    expect((await api("/api/v1/remote/token", { role: "device" }, "")).status).toBe(401);
    expect((await api("/api/v1/remote/token", { role: "admin" })).body.code).toBe(3001);
    // Las notificaciones push necesitan un servicio externo: se informan como no disponibles.
    expect((await api("/api/v1/remote/notification/status")).status).toBe(404);
  });

  it("pairs desktop and phone, notifies status changes and forwards data both ways", async () => {
    const { api, connect } = await startServer();
    const sid = String(
      ((await api("/api/v1/remote/device", { device_mid: "m" })).body.data as Message).device_sid,
    );
    const desktop = await connect("device", sid);
    expect(desktop.ack).toMatchObject({ type: "auth_ack", pair_status: "waiting" });

    const phone = await connect("terminal", sid);
    expect(phone.ack).toMatchObject({ type: "auth_ack", pair_status: "matched" });
    expect(String(phone.ack.terminal_sid)).toMatch(/^t_/);
    expect(await desktop.client.next()).toMatchObject({
      type: "pair_status_ack",
      pair_status: "matched",
    });
    // V2: marcas de tiempo en segundos.
    expect(Number(phone.ack.server_ts)).toBeLessThan(1e11);

    phone.client.send({ type: "data", payload: { zcode_type: "bootstrap-request" } });
    expect(await desktop.client.next()).toMatchObject({
      type: "data",
      payload: { zcode_type: "bootstrap-request" },
    });
    desktop.client.send({ type: "data", payload: { zcode_type: "bootstrap-response" } });
    expect(await phone.client.next()).toMatchObject({ type: "data" });

    const listed = (await api("/api/v1/remote/device")).body.data as Message[];
    expect(listed[0]).toMatchObject({ device_sid: sid, online: true });

    phone.client.close();
    expect(await desktop.client.next()).toMatchObject({
      type: "pair_status_ack",
      pair_status: "waiting",
    });
  });

  it("accepts each token once, kicks a replaced phone and tells the phone when the desktop leaves", async () => {
    const { api, token, connect, endpoints } = await startServer();
    const sid = String(
      ((await api("/api/v1/remote/device", { device_mid: "m" })).body.data as Message).device_sid,
    );
    const once = await token("terminal");
    const first = await Client.open(`${endpoints.relayWsUrl}?token=${once}`);
    cleanups.push(async () => first.close());
    await expect(Client.open(`${endpoints.relayWsUrl}?token=${once}`)).rejects.toThrow(/401/);

    const desktop = await connect("device", sid);
    const oldPhone = await connect("terminal", sid);
    expect(await desktop.client.next()).toMatchObject({ pair_status: "matched" });
    const newPhone = await connect("terminal", sid);
    expect(await oldPhone.client.next()).toMatchObject({ type: "error", code: "KICKED" });
    expect(newPhone.ack).toMatchObject({ pair_status: "matched" });

    desktop.client.close();
    expect(await newPhone.client.next()).toMatchObject({ pair_status: "waiting" });
    expect(await newPhone.client.next()).toMatchObject({ type: "error", code: "DEVICE_OFFLINE" });
  });

  it("rejects unknown devices and keeps the secret and devices across restarts", async () => {
    const { api, connect, configDir } = await startServer();
    expect((await connect("terminal", "nope")).ack).toMatchObject({
      type: "error",
      code: "AUTH_FAILED",
    });
    const sid = String(
      ((await api("/api/v1/remote/device", { device_mid: "m" })).body.data as Message).device_sid,
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    const saved = JSON.parse(
      await readFile(join(configDir, "sunsam-remote-devices.json"), "utf8"),
    ) as Record<string, Message>;
    expect(saved[sid]).toMatchObject({ device_mid: "m" });
    expect(
      (await readFile(join(configDir, "sunsam-remote-secret"), "utf8")).length,
    ).toBeGreaterThan(30);
  });

  it("serves the mobile page and its assets, and nothing outside it", async () => {
    const { endpoints, port } = await startServer();
    expect(endpoints.remoteUrl).toMatch(new RegExp(`^http://.+:${port}/remote/v4#k=`));
    const base = `http://127.0.0.1:${port}`;
    const page = await fetch(`${base}/remote/v4?sid=x`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("<title>remote</title>");
    const asset = await fetch(`${base}/remote/v4/assets/app.js`);
    expect(asset.headers.get("content-type")).toContain("javascript");
    expect((await fetch(`${base}/remote/v4/../../config/x`)).status).not.toBe(200);
    expect((await fetch(`${base}/other`)).status).toBe(404);
  });
});

describe("Sunsam remote host selection", () => {
  const interfaces = {
    "vEthernet (WSL)": [{ family: "IPv4", internal: false, address: "172.20.0.1" }],
    "Wi-Fi": [{ family: "IPv4", internal: false, address: "192.168.1.20" }],
    Tailscale: [{ family: "IPv4", internal: false, address: "100.101.102.103" }],
    Loopback: [{ family: "IPv4", internal: true, address: "127.0.0.1" }],
  } as unknown as Parameters<typeof listSunsamRemoteAddresses>[0];

  it("puts the default-route address first, ahead of VirtualBox's 192.168.56.x", () => {
    const pc = {
      Ethernet: [{ family: "IPv4", internal: false, address: "192.168.1.8" }],
      "Ethernet 2": [{ family: "IPv4", internal: false, address: "192.168.56.1" }],
    } as unknown as Parameters<typeof listSunsamRemoteAddresses>[0];
    expect(listSunsamRemoteAddresses(pc).lan).toEqual(["192.168.1.8", "192.168.56.1"]);
    expect(listSunsamRemoteAddresses(pc, "192.168.56.1").lan[0]).toBe("192.168.56.1");
  });

  it("puts Wi-Fi before virtual adapters and recognises Tailscale", () => {
    expect(listSunsamRemoteAddresses(interfaces)).toEqual({
      lan: ["192.168.1.20", "172.20.0.1"],
      tailscale: ["100.101.102.103"],
    });
  });

  it("uses Tailscale in auto mode when present, the LAN otherwise, or a fixed host", () => {
    const addresses = listSunsamRemoteAddresses(interfaces);
    expect(resolveSunsamRemoteHost({}, addresses)).toBe("100.101.102.103");
    expect(resolveSunsamRemoteHost({ host: "lan" }, addresses)).toBe("192.168.1.20");
    expect(resolveSunsamRemoteHost({}, { lan: ["192.168.1.20"], tailscale: [] })).toBe(
      "192.168.1.20",
    );
    expect(resolveSunsamRemoteHost({ host: "pc.tail1234.ts.net" }, addresses)).toBe(
      "pc.tail1234.ts.net",
    );
  });
});
