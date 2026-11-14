import { encodeQr, penalty, qrPath } from "../qr";

/**
 * "HELLO WORLD" in byte mode, level M, mask 2: checked against an
 * independent encoder and decoded by a QR reader when this was written.
 */
const HELLO_MASK_2 = [
  "111111100000101111111",
  "100000100101001000001",
  "101110101110101011101",
  "101110101010101011101",
  "101110101010101011101",
  "100000101101001000001",
  "111111101010101111111",
  "000000001010000000000",
  "101111100011001111100",
  "011000010111111101100",
  "101100110000111001110",
  "011101001111110011100",
  "100010110110110000101",
  "000000001110100001000",
  "111111100101001000110",
  "100000101110010101111",
  "101110101001000100101",
  "101110101000111111000",
  "101110101100100100100",
  "100000100010110011100",
  "111111101011100010110",
];

function rows(dark: boolean[][]): string[] {
  return dark.map((r) => r.map((c) => (c ? "1" : "0")).join(""));
}

const SETUP_URL =
  "otpauth://totp/Jim:someone%40example.com?secret=ABCDEFGHIJKLMNOPQRSTUVWXYZ234567&issuer=Jim&algorithm=SHA1&digits=6&period=30";

describe("encodeQr", () => {
  it("matches a known code module for module", () => {
    const qr = encodeQr("HELLO WORLD", 2);
    expect(qr.version).toBe(1);
    expect(qr.size).toBe(21);
    expect(rows(qr.dark)).toEqual(HELLO_MASK_2);
  });

  it("picks the smallest version that fits a setup link", () => {
    const qr = encodeQr(SETUP_URL);
    expect(qr.version).toBe(8);
    expect(qr.size).toBe(49);
  });

  it("chooses the mask with the lowest penalty", () => {
    const auto = encodeQr(SETUP_URL);
    for (let m = 0; m < 8; m++) {
      expect(penalty(encodeQr(SETUP_URL, m).dark)).toBeGreaterThanOrEqual(
        penalty(auto.dark)
      );
    }
  });

  it("draws the three finder patterns", () => {
    const { dark, size } = encodeQr(SETUP_URL);
    const finder = (x0: number, y0: number) =>
      Array.from({ length: 7 }, (_, y) =>
        Array.from({ length: 7 }, (_, x) =>
          dark[y0 + y][x0 + x] ? 1 : 0
        ).join("")
      );
    const expected = [
      "1111111",
      "1000001",
      "1011101",
      "1011101",
      "1011101",
      "1000001",
      "1111111",
    ];
    expect(finder(0, 0)).toEqual(expected);
    expect(finder(size - 7, 0)).toEqual(expected);
    expect(finder(0, size - 7)).toEqual(expected);
  });

  it("refuses text too long for any version", () => {
    expect(() => encodeQr("x".repeat(2400))).toThrow(RangeError);
  });
});

describe("qrPath", () => {
  it("draws one unit square per dark module, inside the quiet zone", () => {
    const qr = encodeQr("HELLO WORLD", 2);
    const path = qrPath(qr);
    const darkCount = HELLO_MASK_2.join("").split("1").length - 1;
    expect(path.match(/M/g)).toHaveLength(darkCount);
    expect(path.startsWith("M4 4h1v1h-1z")).toBe(true);
  });
});
