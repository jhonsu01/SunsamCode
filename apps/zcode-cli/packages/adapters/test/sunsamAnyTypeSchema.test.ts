import assert from "node:assert/strict";
import test from "node:test";
import { withExplicitAnyTypes } from "../src/model/sunsam-any-type-schema.js";

const ANY = ["string", "number", "integer", "boolean", "object", "array", "null"];

test("untyped 'any value' properties get an explicit JSON type union", () => {
  const schema = {
    type: "object",
    properties: {
      args: { description: "Optional input value" },
      name: { type: "string" },
      nested: { type: "array", items: { description: "any item" } },
      choice: { anyOf: [{ type: "string" }, { description: "anything" }] },
    },
    required: ["name"],
  };
  const result = withExplicitAnyTypes(schema) as typeof schema & Record<string, any>;
  assert.deepEqual(result.properties.args, { description: "Optional input value", type: ANY });
  assert.deepEqual(result.properties.name, { type: "string" });
  assert.deepEqual(result.properties.nested.items.type, ANY);
  assert.deepEqual(result.properties.choice.anyOf[1].type, ANY);
  assert.equal(result.properties.choice.type, undefined);
  // El schema original no se modifica.
  assert.equal((schema.properties.args as Record<string, unknown>).type, undefined);
});

test("typed, referenced and enumerated nodes are left untouched", () => {
  const schema = {
    type: "object",
    $defs: { id: { type: "string" } },
    properties: { ref: { $ref: "#/$defs/id" }, mode: { enum: ["a", "b"] }, fixed: { const: 1 } },
    additionalProperties: false,
  };
  assert.deepEqual(withExplicitAnyTypes(schema), schema);
});

test("draft-07 tuple items (z.tuple) become a single items schema accepted by Z.ai", () => {
  // Esquema real de FilmCraft Bridge 1.1.0 (edit_video → texts[].position) que causaba [1210].
  const position = {
    type: "array",
    items: [{ type: "number" }, { type: "number" }],
    additionalItems: false,
    minItems: 2,
    maxItems: 2,
  };
  const result = withExplicitAnyTypes({ type: "object", properties: { position } }) as Record<string, any>;
  assert.deepEqual(result.properties.position, {
    type: "array",
    items: { type: "number" },
    minItems: 2,
    maxItems: 2,
  });
  const mixed = withExplicitAnyTypes({
    type: "array",
    items: [{ type: "number" }, { type: "string" }],
    additionalItems: false,
  }) as Record<string, any>;
  assert.deepEqual(mixed.items, { anyOf: [{ type: "number" }, { type: "string" }] });
  assert.equal(mixed.maxItems, 2);
  assert.equal("additionalItems" in mixed, false);
  // prefixItems (2020-12) sí lo acepta Z.ai: se mantiene.
  const modern = { type: "array", prefixItems: [{ type: "number" }], items: false };
  assert.deepEqual(withExplicitAnyTypes(modern), modern);
});
