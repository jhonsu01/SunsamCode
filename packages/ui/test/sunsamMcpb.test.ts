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
  assert.throws(() => parseSunsamMcpbManifest({ ...audacityManifest, name: "../evil" }), /name/u);
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
