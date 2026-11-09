import { render } from "@testing-library/react";
import { KEEPSAKES } from "@/lib/ever-onward/universes/higher/keepsakes";
import KeepsakeSprite from "../KeepsakeArt";

const markup = (id: string): string =>
  render(
    <svg>
      <KeepsakeSprite id={id} x={0} y={0} />
    </svg>
  ).container.innerHTML;

describe("KeepsakeSprite", () => {
  it("draws every keepsake as its own little picture", () => {
    const pictures = KEEPSAKES.map((k) => markup(k.id));
    expect(new Set(pictures).size).toBe(KEEPSAKES.length);
    for (const picture of pictures) expect(picture).toContain("<rect");
  });
});
