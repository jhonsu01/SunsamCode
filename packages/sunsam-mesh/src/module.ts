export const sunsamMeshModule = {
  id: "sunsam-mesh",
  requires: [],
  provides: ["sunsam-mesh-gateway", "byte-logit-conversion", "bits-per-byte"],
  publicEntrypoints: ["contract.ts"],
} as const;
