import { render } from "@testing-library/react";
import Blob from "../Blob";
import { FACES, HATS, NECKS, EMOTES } from "@/lib/flamelings/catalog";

const look = { colour: "rose", shape: "puff", eyes: "sharp" } as const;

describe("Blob", () => {
  it("carries its look and mood as data attributes and hides from assistive tech", () => {
    const { container } = render(
      <Blob look={look} mood="hungry" stage="flame" />
    );
    const svg = container.querySelector("svg.fl-blob");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("data-colour", "rose");
    expect(svg).toHaveAttribute("data-shape", "puff");
    expect(svg).toHaveAttribute("data-eyes", "sharp");
    expect(svg).toHaveAttribute("data-mood", "hungry");
    expect(container.querySelector(".fl-pet")).toHaveAttribute(
      "data-stage",
      "flame"
    );
  });

  it("draws cheeks and two shines per eye", () => {
    const { container } = render(<Blob look={look} mood="happy" />);
    expect(container.querySelectorAll(".fl-cheek")).toHaveLength(2);
    expect(container.querySelectorAll(".fl-shine")).toHaveLength(4);
  });

  it("only fills its box as a preview when asked to", () => {
    const { container, rerender } = render(<Blob look={look} mood="happy" />);
    expect(container.querySelector(".fl-pet")).not.toHaveClass("fl-pet-fit");
    rerender(<Blob look={look} mood="happy" fit />);
    expect(container.querySelector(".fl-pet")).toHaveClass("fl-pet-fit");
  });

  it("gives two blobs their own gradient ids", () => {
    const { container } = render(
      <>
        <Blob look={look} mood="happy" />
        <Blob look={look} mood="happy" />
      </>
    );
    const ids = [...container.querySelectorAll("linearGradient")].map(
      (n) => n.id
    );
    expect(new Set(ids).size).toBe(2);
  });

  it.each(HATS)("draws the %s hat", (hat) => {
    const { container } = render(
      <Blob look={look} mood="happy" worn={{ hat, face: null, neck: null }} />
    );
    expect(
      container.querySelector(".fl-hat")?.childElementCount
    ).toBeGreaterThan(0);
  });

  it.each(FACES)("draws the %s face item", (face) => {
    const { container } = render(
      <Blob look={look} mood="happy" worn={{ hat: null, face, neck: null }} />
    );
    expect(
      container.querySelector(".fl-face")?.childElementCount
    ).toBeGreaterThan(0);
  });

  it.each(NECKS)("draws the %s neck item", (neck) => {
    const { container } = render(
      <Blob look={look} mood="happy" worn={{ hat: null, face: null, neck }} />
    );
    expect(
      container.querySelector(".fl-neck")?.childElementCount
    ).toBeGreaterThan(0);
  });

  it("draws nothing when nothing is worn", () => {
    const { container } = render(<Blob look={look} mood="happy" />);
    expect(container.querySelector(".fl-hat, .fl-face, .fl-neck")).toBeNull();
  });

  it.each(EMOTES)("plays the %s emote on the pet", (emote) => {
    const { container } = render(
      <Blob look={look} mood="happy" emote={emote} />
    );
    expect(container.querySelector(".fl-pet")).toHaveAttribute(
      "data-emote",
      emote
    );
    expect(container.querySelectorAll(".fl-fx").length).toBeGreaterThan(0);
  });

  it("shows sleepy zzz while asleep and nothing for a calm pet", () => {
    const asleep = render(<Blob look={look} mood="asleep" />);
    expect(
      asleep.container.querySelector('.fl-fx[data-fx="zzz"]')
    ).not.toBeNull();
    const calm = render(<Blob look={look} mood="happy" />);
    expect(calm.container.querySelector(".fl-fx")).toBeNull();
  });
});
