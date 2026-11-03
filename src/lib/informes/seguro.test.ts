import { describe, expect, it } from "vitest";
import { textoSeguro } from "./seguro";

describe("textoSeguro", () => {
  it("neutraliza texto que Excel interpretaría como fórmula", () => {
    for (const v of ["=1+1", "+57 300", "-2", "@suma"]) expect(textoSeguro(v)).toBe(`'${v}`);
  });
  it("deja igual el texto normal", () => {
    expect(textoSeguro("Calle 16")).toBe("Calle 16");
  });
});
