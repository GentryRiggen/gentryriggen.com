import { NoBlending, Vector3 } from "three";
import { TITANIC_INTERIOR } from "@/lib/shipwreck/interior";
import {
  carMaterial,
  MAX_ROOM_SLOTS,
  roomMaterials,
  roomShaders,
} from "../materials";
import { applyModern, modernTextures } from "../modernTextures";
import { LAYERS } from "../pieces";
import { detailTexture, DETAIL_PX } from "../textures";
import { waterMaterials } from "../water";

/**
 * The rooms' shader family: one uniform slot per room within the limit,
 * shared with the water, drawn in the transparent pass with blending off;
 * the detail texture is one repeating tile, every channel in use.
 * (Its GLSL guards: `scene/__tests__/shaderGuards.test.ts`.)
 */

const rooms = TITANIC_INTERIOR.rooms.length;

describe("the rooms' materials", () => {
  it("sizes the room arrays to the rooms, within the limit", () => {
    expect(rooms).toBeLessThanOrEqual(MAX_ROOM_SLOTS);
    for (const layer of LAYERS) {
      const { vertex } = roomShaders(layer, rooms);
      expect(vertex).toContain(`uniform float uRoomPower[${rooms}];`);
      expect(vertex).toContain(`uniform float uLevel[${rooms}];`);
    }
    expect(() => roomShaders("shell", MAX_ROOM_SLOTS + 1)).toThrow();
    expect(() => roomShaders("shell", 0)).toThrow();
  });

  it("each layer has its own defines (detail, sheen, glass)", () => {
    expect(roomShaders("shell", 4).fragment).toContain("#define DETAIL");
    expect(roomShaders("wood", 4).fragment).toContain("#define SHEEN");
    expect(roomShaders("metal", 4).fragment).toContain("#define METAL");
    expect(roomShaders("glass", 4).fragment).toContain("#define GLASS");
    expect(roomShaders("glass", 4).fragment).not.toContain("#define DETAIL");
  });

  it("shares the water's room power, levels, torch and time; opaque in the transparent pass", () => {
    const water = waterMaterials(rooms);
    const u = water.surface.uniforms;
    const detail = detailTexture();
    const mats = roomMaterials(
      rooms,
      {
        uRoomPower: u.uRoomPower,
        uLevel: u.uLevel,
        uTorchOn: u.uTorchOn,
        uTorchPos: u.uTorchPos,
        uTorchDir: u.uTorchDir,
        uTime: u.uTime,
      },
      detail
    );
    for (const layer of LAYERS) {
      const m = mats[layer];
      expect(m.uniforms.uRoomPower).toBe(u.uRoomPower);
      expect(m.uniforms.uRoomPower.value).toBe(water.power);
      expect(m.uniforms.uLevel.value).toBe(water.levels);
      expect(m.uniforms.uTorchPos.value).toBeInstanceOf(Vector3);
      expect(m.uniforms.uTorchOn).toBe(water.body.uniforms.uTorchOn);
      expect(m.uniforms.uFlicker).toBe(mats.flicker);
      expect(m.uniforms.uSky).toBe(mats.sky);
      expect([m.transparent, m.blending, m.depthWrite, m.fog]).toEqual([
        true,
        NoBlending,
        true,
        false,
      ]);
      expect(m.vertexColors).toBe(true);
    }
    mats.dispose();
    detail.dispose();
    water.surface.dispose();
    water.body.dispose();
  });

  it("the detail texture: one repeating tile, every channel varied and mid-toned", () => {
    const t = detailTexture();
    const data = (t.image as { data: Uint8Array }).data;
    expect(data.length).toBe(DETAIL_PX * DETAIL_PX * 4);
    for (let ch = 0; ch < 4; ch += 1) {
      let lo = 255;
      let hi = 0;
      let sum = 0;
      for (let i = ch; i < data.length; i += 4) {
        lo = Math.min(lo, data[i]);
        hi = Math.max(hi, data[i]);
        sum += data[i];
      }
      const mean = sum / (DETAIL_PX * DETAIL_PX);
      expect([ch, hi - lo > 60]).toEqual([ch, true]);
      expect([ch, mean > 60 && mean < 220]).toEqual([ch, true]);
    }
    t.dispose();
  });

  it("her glass cars' material: the metal's shaders and very uniforms, plus its own warm ceiling light (no three.js light)", () => {
    const water = waterMaterials(rooms);
    const u = water.surface.uniforms;
    const mats = roomMaterials(
      rooms,
      {
        uRoomPower: u.uRoomPower,
        uLevel: u.uLevel,
        uTorchOn: u.uTorchOn,
        uTorchPos: u.uTorchPos,
        uTorchDir: u.uTorchDir,
        uTime: u.uTime,
      },
      detailTexture()
    );
    const tex = modernTextures();
    const mu = applyModern(mats, tex);
    const car = carMaterial(mats.metal, 2.4);
    // The same uniform objects: the room power, flicker and emergency
    // supply move it as they move the rooms.
    expect(car.uniforms.uRoomPower).toBe(u.uRoomPower);
    expect(car.uniforms.uFlicker).toBe(mats.flicker);
    expect(car.uniforms.uEmergency).toBe(mu.uEmergency);
    // The metal's code, the modern lines too, then the car's own light.
    expect(car.fragmentShader).toContain("#define METAL");
    expect(car.fragmentShader).toContain("uModernA");
    expect(car.fragmentShader).toContain("CAR_LAMP");
    expect(car.fragmentShader.indexOf("CAR_LAMP * carFace")).toBeLessThan(
      car.fragmentShader.indexOf("gl_FragColor")
    );
    expect(car.vertexShader).toContain("vCarP = position;");
    // Its own supply dips with her emergency lights' flicker.
    expect(car.fragmentShader).toContain("0.5 * uFlicker * uEmergency");
    expect(car.fragmentShader).toContain("2.400");
    expect([car.blending, car.depthWrite, car.fog]).toEqual([
      mats.metal.blending,
      true,
      false,
    ]);
    // The metal itself is unchanged.
    expect(mats.metal.fragmentShader).not.toContain("CAR_LAMP");
    car.dispose();
    mats.dispose();
    tex.dispose();
  });

  it("a car on a metal without the emergency supply declares it, held at 1 (never dips)", () => {
    const water = waterMaterials(rooms);
    const u = water.surface.uniforms;
    const mats = roomMaterials(
      rooms,
      {
        uRoomPower: u.uRoomPower,
        uLevel: u.uLevel,
        uTorchOn: u.uTorchOn,
        uTorchPos: u.uTorchPos,
        uTorchDir: u.uTorchDir,
        uTime: u.uTime,
      },
      detailTexture()
    );
    const car = carMaterial(mats.metal, 2.4);
    expect(car.fragmentShader.match(/uniform float uEmergency;/g)).toHaveLength(
      1
    );
    expect(car.uniforms.uEmergency.value).toBe(1);
    expect(car.uniforms.uRoomPower).toBe(u.uRoomPower);
    car.dispose();
    mats.dispose();
  });
});
