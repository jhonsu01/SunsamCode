import assert from "node:assert/strict";
import test from "node:test";
import {
  meshGatewayToken,
  peersFromBeacon,
  signBeacon,
  verifyBeacon,
} from "../src/adapters/lanDiscovery.js";

const payload = {
  v: 1 as const,
  nodeId: "gpu-rig",
  url: "http://192.168.1.20:4141",
  tiers: ["swarm" as const],
  ts: 1_000_000,
};

test("signed beacons verify only with the shared secret and within the time window", () => {
  const message = signBeacon(payload, "mesh-secret");
  assert.deepEqual(verifyBeacon(message, "mesh-secret", 1_000_500), payload);
  assert.equal(verifyBeacon(message, "other-secret", 1_000_500), null);
  assert.equal(verifyBeacon(message, "mesh-secret", 1_000_000 + 31_000), null);
  const tampered = message.replace("192.168.1.20", "10.0.0.66");
  assert.equal(verifyBeacon(tampered, "mesh-secret", 1_000_500), null);
  assert.equal(verifyBeacon("no-json", "mesh-secret", 1_000_500), null);
});

test("a beacon becomes mesh peers that call the remote node's virtual models", () => {
  const token = meshGatewayToken("mesh-secret");
  const [peer] = peersFromBeacon(payload, token);
  assert.equal(peer?.id, "gpu-rig:swarm");
  assert.equal(peer?.kind, "mesh");
  assert.deepEqual(peer?.models, ["sunsam-swarm"]);
  assert.equal(peer?.apiKey, token);
  assert.notEqual(token, meshGatewayToken("other"));
});
