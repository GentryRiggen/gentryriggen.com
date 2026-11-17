import { fireEvent, render, screen } from "@testing-library/react";
import { createPet } from "@/lib/flamelings/actions";
import { resetClock, setNow } from "@/lib/flamelings/clock";
import { SAVE_KEY } from "@/lib/flamelings/save";
import { useFlamelings } from "@/lib/flamelings/store";
import type { Pet } from "@/lib/flamelings/types";
import Shop from "../Shop";
import { sharesOf } from "../SparkFlights";

jest.mock("canvas-confetti", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("@/lib/analytics/trackGame", () => ({ trackGame: jest.fn() }));

const NOON = new Date(2026, 10, 17, 12).getTime();
const look = { colour: "ember", shape: "flame", eyes: "round" } as const;

function seed(sparks: number): Pet {
  window.localStorage.clear();
  resetClock();
  setNow(NOON);
  const pet = {
    ...createPet({ id: "a", name: "Pip", look, now: NOON }),
    sparks,
  };
  window.localStorage.setItem(
    SAVE_KEY,
    JSON.stringify({
      v: 1,
      pets: [pet],
      memorial: [],
      collection: [],
      updatedAt: NOON,
    })
  );
  useFlamelings.setState(useFlamelings.getInitialState(), true);
  // Loading through init() keeps the store's idea of what is saved in step.
  useFlamelings.getState().init();
  return pet;
}

function renderShop(sparks: number) {
  const pet = seed(sparks);
  const view = () => {
    const live = useFlamelings.getState().save.pets[0];
    return <Shop pet={live} nowMs={NOON} onClose={() => {}} />;
  };
  const utils = render(view());
  return { pet, utils, view };
}

afterEach(() => resetClock());

describe("Shop", () => {
  it("shows how many more sparks an item needs, and buys nothing", () => {
    renderShop(20);
    fireEvent.click(screen.getByRole("button", { name: /Pirate hat, 90/ }));
    expect(screen.getByTestId("shop-short")).toHaveTextContent("70");
    const pet = useFlamelings.getState().save.pets[0];
    expect(pet.sparks).toBe(20);
    expect(pet.worn.hat).toBeNull();
  });

  it("buys with enough sparks, wears the hat and queues a card", () => {
    renderShop(100);
    fireEvent.click(screen.getByRole("button", { name: /Buy Pirate hat/ }));
    const state = useFlamelings.getState();
    expect(state.save.pets[0].sparks).toBe(10);
    expect(state.save.pets[0].worn.hat).toBe("pirate");
    expect(state.celebrations[0]).toMatchObject({
      kind: "bought",
      key: "hat:pirate",
    });
  });

  it("marks the item just bought", () => {
    const { utils, view } = renderShop(100);
    fireEvent.click(screen.getByRole("button", { name: /Buy Pirate hat/ }));
    utils.rerender(view());
    expect(screen.getByTestId("shop-item-pirate")).toHaveAttribute(
      "data-just-bought",
      "true"
    );
  });

  it("offers the glade decor on its own tab and puts it out when bought", () => {
    renderShop(100);
    fireEvent.click(screen.getByRole("tab", { name: "Glade" }));
    fireEvent.click(screen.getByRole("button", { name: /Buy Cozy rug/ }));
    expect(useFlamelings.getState().save.pets[0].decor).toEqual(["rug"]);
  });
});

describe("sharesOf", () => {
  it("splits sparks over at most eight particles without losing any", () => {
    for (const amount of [1, 2, 3, 7, 8, 9, 25, 100]) {
      const shares = sharesOf(amount);
      expect(shares.length).toBeLessThanOrEqual(8);
      expect(shares.reduce((a, b) => a + b, 0)).toBe(amount);
      expect(Math.min(...shares)).toBeGreaterThanOrEqual(1);
    }
  });
});
