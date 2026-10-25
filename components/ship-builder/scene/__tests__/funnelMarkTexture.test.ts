import { getFunnelMarkTexture } from "../funnelMarkTexture";

describe("getFunnelMarkTexture", () => {
  it("returns null without a 2D canvas context, without throwing", () => {
    expect(
      getFunnelMarkTexture({ kind: "letters", text: "WS", color: "white" })
    ).toBeNull();
  });
});
