import { describe, expect, it } from "vitest";
import { escaparHtml } from "./texto";

describe("escaparHtml", () => {
  it("neutraliza etiquetas y comillas", () => {
    expect(escaparHtml(`<img src=x onerror="alert('x')">`)).toBe("&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;");
  });
  it("deja igual el texto normal", () => {
    expect(escaparHtml("Calle 18B # 19-30")).toBe("Calle 18B # 19-30");
  });
});
