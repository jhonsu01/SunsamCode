import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RootStartupLoading, ZCodeStartupLogoBadge } from "@/root/RootStartupLoading.js";

describe("RootStartupLoading", () => {
  it("静态品牌图标不渲染呼吸动画", () => {
    const html = renderToStaticMarkup(createElement(ZCodeStartupLogoBadge, { animated: false }));
    expect(html).toContain("<svg");
<<<<<<< HEAD
    expect(html).toContain("linear-gradient");
    expect(html).not.toContain("sunsam-logo-mark--animated");
=======
    expect(html).not.toContain("<animate");
>>>>>>> 0a1fc56d279fd1001f78387bd81aec1c26767411
  });
  // Sunsam: el arranque muestra el logo Sunsam animado (rayos en cascada + triángulo que gira).
  it("启动阻塞态使用整体呼吸的 ZCode SVG 而不是可见 loading 文案", () => {
    const html = renderToStaticMarkup(createElement(RootStartupLoading, { label: "加载中..." }));

    expect(html).toContain('data-testid="root-startup-loading"');
    expect(html).toContain('aria-label="加载中..."');
    expect(html).toContain("<svg");
<<<<<<< HEAD
    expect(html).toContain("sunsam-logo-mark--animated");
    expect(html).toContain("sunsam-logo-badge--animated");
    expect(html.match(/class="sunsam-logo-ray"/g)?.length).toBe(4);
    expect(html).toContain("bg-background");
=======
    expect(html).toContain('attributeName="opacity"');
>>>>>>> 0a1fc56d279fd1001f78387bd81aec1c26767411
    expect(html).not.toContain(">加载中...<");
  });
});
