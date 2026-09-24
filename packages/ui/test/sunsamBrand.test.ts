import assert from "node:assert/strict";
import test from "node:test";
import { applySunsamBrandToText } from "../../shared/src/sunsamBrand.js";
import { getDesktopMenuMessage } from "../../shared/src/desktopMenu.js";
import { applySunsamBrandToMessages } from "../src/sunsam/brand.js";

test("visible product names are rebranded to Sunsam Code", () => {
  assert.equal(applySunsamBrandToText("Welcome to ZCode"), "Welcome to Sunsam Code");
  assert.equal(applySunsamBrandToText("About Z Code"), "About Sunsam Code");
  assert.equal(
    applySunsamBrandToText("Restart ZCode, then ZCode Agent"),
    "Restart Sunsam Code, then Sunsam Code Agent",
  );
});

test("upstream identifiers, binary and infrastructure names are preserved", () => {
  assert.equal(applySunsamBrandToText("useZCodeStore"), "useZCodeStore");
  assert.equal(applySunsamBrandToText("~/.zcode/v2"), "~/.zcode/v2");
  assert.equal(applySunsamBrandToText("reach the ZCode CDN"), "reach the ZCode CDN");
  assert.equal(applySunsamBrandToText("install the ZCode CLI"), "install the ZCode CLI");
});

test("message tables are branded once and extended with Sunsam messages", () => {
  const messages = { "a.title": "About ZCode", "a.id": "{name} in ZCode" };
  const branded = applySunsamBrandToMessages(messages, "en-US");
  assert.equal(branded["a.title"], "About Sunsam Code");
  assert.equal(branded["a.id"], "{name} in Sunsam Code");
  assert.ok(branded["sunsam.modelProvider.customOnlyEmpty"]);
  assert.equal(applySunsamBrandToMessages(messages, "en-US"), branded);
  assert.equal(messages["a.title"], "About ZCode");
});

test("native desktop menu and tray use the Sunsam brand", () => {
  assert.equal(getDesktopMenuMessage("en-US", "tray.tooltip"), "Sunsam Code");
  assert.equal(getDesktopMenuMessage("en-US", "titleBar.menu.help.about"), "About Sunsam Code");
  assert.equal(getDesktopMenuMessage("zh-CN", "tray.menu.openZCode"), "打开 Sunsam Code");
});
