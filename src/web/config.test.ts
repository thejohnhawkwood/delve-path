import { describe, expect, it } from "vitest";
import { CREDIT, desktopDownloadUrl, mithrilContactUrl, mithrilUrl, publicUrl, SAFETY, sourceUrl } from "./config";

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

  it("uses the approved Drive folder URL without rewriting it", () => {
    expect(desktopDownloadUrl).toBe(
      "https://drive.google.com/drive/folders/1nnhXHkcPL2cjl5L7wZVUMPQnb6cnc3_d?usp=sharing"
    );
  });
});
