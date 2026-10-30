import {
  CARD_HEIGHT,
  CARD_WIDTH,
  cardFilename,
  cardText,
  drawTimeCard,
  planeTierName,
  shareMessage,
  type TimeCardData,
} from "../timeCard";

const normal: TimeCardData = {
  worldName: "Sunny Meadow",
  time: 41.26,
  nickname: "Happy Otter 12",
  planeTier: "Speedy plane",
};
const daily: TimeCardData = {
  ...normal,
  twist: { name: "Tailwind", emoji: "💨" },
};

function recordingContext() {
  const texts: string[] = [];
  const gradient = { addColorStop: jest.fn() };
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "left",
    textBaseline: "top",
    fillRect: jest.fn(),
    fillText: jest.fn((t: string) => texts.push(t)),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    fill: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    createLinearGradient: jest.fn(() => gradient),
  };
  return {
    ctx: ctx as unknown as Parameters<typeof drawTimeCard>[0] & typeof ctx,
    texts,
  };
}

describe("cardText", () => {
  it("shows the time to a tenth of a second", () => {
    expect(cardText(normal).time).toBe("41.3 s");
  });

  it("calls a daily card the daily challenge and names the twist", () => {
    const text = cardText(daily);
    expect(text.heading).toBe("Daily challenge");
    expect(text.twist).toBe("💨 Tailwind");
  });

  it("has no twist line on a normal card", () => {
    expect(cardText(normal).twist).toBeNull();
    expect(cardText(normal).heading).toBe("Level complete");
  });

  it("leaves the pilot out when there is no nickname", () => {
    expect(cardText({ ...normal, nickname: null }).nickname).toBeNull();
    expect(cardText({ ...normal, nickname: "  " }).nickname).toBeNull();
  });
});

describe("drawTimeCard", () => {
  it("draws the world, time, plane and twist inside the card", () => {
    const { ctx, texts } = recordingContext();
    drawTimeCard(ctx, daily);
    expect(texts).toEqual(
      expect.arrayContaining([
        "Sunny Meadow",
        "41.3 s",
        "Speedy plane",
        "💨 Tailwind",
        "Pilot: Happy Otter 12",
        "Made in Plane Builder",
      ])
    );
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, CARD_WIDTH, CARD_HEIGHT);
  });

  it("prints nothing personal beyond the nickname", () => {
    const { ctx, texts } = recordingContext();
    drawTimeCard(ctx, { ...normal, nickname: null });
    expect(texts.some((t) => t.startsWith("Pilot"))).toBe(false);
  });
});

describe("sharing text", () => {
  it("says what happened with no link", () => {
    expect(shareMessage(daily)).toBe(
      "I flew Sunny Meadow with Tailwind in 41.3 s in Plane Builder!"
    );
    expect(shareMessage(normal)).not.toContain("http");
  });

  it("names the file for the kind of card", () => {
    expect(cardFilename(daily)).toBe("plane-builder-daily.png");
    expect(cardFilename(normal)).toBe("plane-builder-time.png");
  });
});

describe("planeTierName", () => {
  it("leaves a starter plane unnamed", () => {
    expect(planeTierName({ wings: 0, engine: 0 })).toBeNull();
  });
  it("names planes by how many upgrades they have", () => {
    expect(planeTierName({ wings: 2, engine: 3 })).toBe("Zippy plane");
    expect(planeTierName({ wings: 12, engine: 3 })).toBe("Speedy plane");
    expect(planeTierName({ wings: 30 })).toBe("Super plane");
    expect(planeTierName({ wings: 45 })).toBe("Rocket plane");
  });
  it("skips the line on the card for a starter plane", () => {
    expect(cardText({ ...normal, planeTier: null }).plane).toBeNull();
  });
});
