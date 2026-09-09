import { describe, expect, it } from "vitest";
import { CREDIT, desktopDownloadUrl, desktopMeta, mithrilContactUrl, mithrilUrl, publicUrl, SAFETY, sourceUrl } from "./config";

describe("public links", () => {
  it("uses safe Mithril and source URLs", () => {
    expect(mithrilUrl).toBe("https://mithrilconsulting.io");
    expect(mithrilContactUrl).toBe("https://mithrilconsulting.io/contact");
    expect(sourceUrl.startsWith("https://")).toBe(true);
    expect(CREDIT).toBe("Created by Philip Bird — Mithril Consulting");
    expect(SAFETY).toMatch(/not certified/i);
    expect(SAFETY).toMatch(/collision avoidance/);
    expect(SAFETY).toMatch(/well control/);
  });

  it("prefixes public assets with Vite base", () => {
    expect(publicUrl("brand/x.png")).toBe("/brand/x.png");
    expect(publicUrl("/legal/LICENSE.txt")).toBe("/legal/LICENSE.txt");
  });

  it("downloads the installer matching the displayed release version", () => {
    expect(desktopDownloadUrl).toBe(
      `https://github.com/thejohnhawkwood/delve-path/releases/download/v${desktopMeta.version}/${desktopMeta.filename}`
    );
  });
});
