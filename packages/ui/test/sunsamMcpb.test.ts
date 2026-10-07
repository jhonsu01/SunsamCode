import assert from "node:assert/strict";
import test from "node:test";
import {
  initialSunsamMcpbValues,
  isSunsamMcpbFileName,
  missingSunsamMcpbValues,
  parseSunsamMcpbManifest,
  resolveSunsamMcpbServerConfig,
  type SunsamMcpbResolveContext,
} from "@zcode/shared";
import { joinSunsamMcpArgs, splitSunsamMcpArgs } from "../src/sunsam/mcpArgs.ts";

// Mismo manifest que publica jhonsu01/audacity-mcp-server v1.1.0 (recortado).
const audacityManifest = {
  manifest_version: "0.3",
  name: "audacity-mcp-server",
  version: "1.1.0",
  display_name: "Audacity Bridge",
  server: {
    type: "node",
    entry_point: "dist/bundle.cjs",
    mcp_config: {
      command: "node",
      args: ["${__dirname}/dist/bundle.cjs"],
      env: {
        AUDACITY_DIR: "${user_config.audacity_dir}",
        FFMPEG_PATH: "${user_config.ffmpeg_path}",
      },
    },
  },
  user_config: {
    audacity_dir: { type: "directory", title: "Audacity 4 folder", required: false },
    ffmpeg_path: { type: "file", title: "FFmpeg executable (optional)", required: false },
  },
  compatibility: { platforms: ["win32"], runtimes: { node: ">=20.0.0" } },
};

const context: SunsamMcpbResolveContext = {
  installDir:
    "C:\\Users\\Jhon Supelano\\AppData\\Roaming\\Sunsam Code\\extensions\\audacity-mcp-server\\1.1.0-1",
  platform: "win32",
  pathSeparator: "\\",
  home: "C:\\Users\\Jhon Supelano",
  desktop: "C:\\Users\\Jhon Supelano\\Desktop",
  documents: "C:\\Users\\Jhon Supelano\\Documents",
  downloads: "C:\\Users\\Jhon Supelano\\Downloads",
};

test("recognises .mcpb and legacy .dxt files only", () => {
  assert.equal(isSunsamMcpbFileName("audacity-mcp-server.mcpb"), true);
  assert.equal(isSunsamMcpbFileName("OLD.DXT"), true);
  assert.equal(isSunsamMcpbFileName("server.zip"), false);
});

test("validates the manifest", () => {
  const manifest = parseSunsamMcpbManifest(audacityManifest);
  assert.equal(manifest.display_name, "Audacity Bridge");
  assert.throws(() => parseSunsamMcpbManifest({ ...audacityManifest, name: "  " }), /name/u);
  assert.throws(
    () =>
      parseSunsamMcpbManifest({ ...audacityManifest, server: { type: "node", mcp_config: {} } }),
    /command/u,
  );
});

test("resolves __dirname and drops empty optional env vars", () => {
  const manifest = parseSunsamMcpbManifest(audacityManifest);
  const config = resolveSunsamMcpbServerConfig(manifest, {}, context);
  assert.deepEqual(config, {
    type: "stdio",
    command: "node",
    args: [`${context.installDir}/dist/bundle.cjs`],
  });
});

test("fills user_config values and swaps node for the bundled runtime", () => {
  const manifest = parseSunsamMcpbManifest(audacityManifest);
  const config = resolveSunsamMcpbServerConfig(
    manifest,
    { audacity_dir: "D:\\Apps\\Audacity 4" },
    {
      ...context,
      nodeRuntime: {
        command: "C:\\Sunsam Code\\Sunsam Code.exe",
        env: { ELECTRON_RUN_AS_NODE: "1" },
      },
    },
  );
  assert.equal(config.command, "C:\\Sunsam Code\\Sunsam Code.exe");
  assert.deepEqual(config.env, { AUDACITY_DIR: "D:\\Apps\\Audacity 4", ELECTRON_RUN_AS_NODE: "1" });
});

test("expands list values, omits empty whole-placeholder args and applies platform overrides", () => {
  const manifest = parseSunsamMcpbManifest({
    name: "fs",
    version: "1.0.0",
    server: {
      type: "binary",
      mcp_config: {
        command: "${__dirname}${/}server",
        args: ["--root", "${user_config.dirs}", "${user_config.token}", "--home=${HOME}"],
        platform_overrides: { win32: { command: "${__dirname}${/}server.exe" } },
      },
    },
    user_config: {
      dirs: { type: "directory", multiple: true, required: true },
      token: { type: "string", sensitive: true },
    },
  });
  const config = resolveSunsamMcpbServerConfig(manifest, { dirs: ["C:\\a", "D:\\b c"] }, context);
  assert.equal(config.command, `${context.installDir}\\server.exe`);
  assert.deepEqual(config.args, ["--root", "C:\\a", "D:\\b c", `--home=${context.home}`]);
  assert.deepEqual(missingSunsamMcpbValues(manifest.user_config, {}), ["dirs"]);
});

test("saved values win over manifest defaults", () => {
  const values = initialSunsamMcpbValues(
    { a: { type: "string", default: "x" }, b: { type: "number", default: 3 } },
    { a: "saved" },
  );
  assert.deepEqual(values, { a: "saved", b: 3 });
});

test("MCP form args keep paths with spaces", () => {
  const args = ["C:\\Users\\Jhon Supelano\\x\\bundle.cjs", "--flag", 'say "hi"', ""];
  const text = joinSunsamMcpArgs(args);
  assert.deepEqual(splitSunsamMcpArgs(text), args);
  assert.deepEqual(splitSunsamMcpArgs("-y  mcp-server-ssh"), ["-y", "mcp-server-ssh"]);
  assert.equal(joinSunsamMcpArgs(["-y", "pkg"]), "-y pkg");
});

test("any manifest.name becomes a safe server key (Illustrator MCP)", async () => {
  const { sunsamMcpbServerKey, isSunsamMcpbServerKey } = await import("@zcode/shared");
  assert.equal(sunsamMcpbServerKey("Illustrator MCP"), "illustrator-mcp");
  assert.equal(sunsamMcpbServerKey("audacity-mcp-server"), "audacity-mcp-server");
  assert.equal(sunsamMcpbServerKey("Diseño Pro: v2!"), "diseno-pro-v2");
  assert.match(sunsamMcpbServerKey("插画"), /^extension-[a-z0-9]+$/u);
  for (const name of ["Illustrator MCP", "../../evil", "插画"]) {
    assert.equal(isSunsamMcpbServerKey(sunsamMcpbServerKey(name)), true);
  }
  assert.doesNotThrow(() =>
    parseSunsamMcpbManifest({ ...audacityManifest, name: "Illustrator MCP" }),
  );
});

test("auto-detection reads paths and executables from the manifest descriptions", async () => {
  const { extractWindowsPaths, extractExecutableNames, titleKeyword } =
    await import("../../desktop/src/main/sunsamMcpbDetect.ts");
  assert.deepEqual(
    extractWindowsPaths(
      String.raw`Install folder of Audacity 4. Leave empty to use C:\Program Files\Audacity 4.`,
    ),
    [String.raw`C:\Program Files\Audacity 4`],
  );
  assert.deepEqual(
    extractWindowsPaths(
      String.raw`Full path of vmde.exe. Leave empty to use the default install folder (C:\Program Files (x86)\Vector Magic).`,
    ),
    [String.raw`C:\Program Files (x86)\Vector Magic`],
  );
  assert.deepEqual(extractExecutableNames("Full path of vmde.exe or FFmpeg.exe"), [
    "vmde.exe",
    "ffmpeg.exe",
  ]);
  assert.equal(
    titleKeyword({ type: "directory", title: "Audacity 4 folder" }, "audacity_dir"),
    "audacity",
  );
});

test("Windows File Explorer is shown in the app language", async () => {
  const { localizeSunsamEditors } =
    await import("../../desktop/src/main/sunsamLocalizedEditors.ts");
  const editors = [
    { id: "explorer", name: "资源管理器" },
    { id: "vscode", name: "VS Code" },
  ] as Parameters<typeof localizeSunsamEditors>[0];
  assert.deepEqual(
    localizeSunsamEditors(editors, "es-ES").map((editor) => editor.name),
    ["Explorador de archivos", "VS Code"],
  );
  assert.equal(localizeSunsamEditors(editors, "zh-CN")[0]!.name, "资源管理器");
});
