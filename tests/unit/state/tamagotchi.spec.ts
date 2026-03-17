// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { TamagotchiProvider, useTamagotchi } from "../../../lib/state/store";
import {
  HEALTH_DEFAULT,
  HEALTH_MIN,
  HEALTH_MAX,
  clampHealth,
} from "../../../lib/state/tamagotchi";

// ─── clampHealth unit tests ────────────────────────────────────────────────

describe("clampHealth", () => {
  it("returns value unchanged when within bounds", () => {
    expect(clampHealth(50)).toBe(50);
  });

  it("clamps to HEALTH_MIN when value is below 0", () => {
    expect(clampHealth(-10)).toBe(HEALTH_MIN);
  });

  it("clamps to HEALTH_MAX when value is above 100", () => {
    expect(clampHealth(150)).toBe(HEALTH_MAX);
  });

  it("accepts exactly HEALTH_MIN", () => {
    expect(clampHealth(HEALTH_MIN)).toBe(HEALTH_MIN);
  });

  it("accepts exactly HEALTH_MAX", () => {
    expect(clampHealth(HEALTH_MAX)).toBe(HEALTH_MAX);
  });
});

// ─── US1: initial state ────────────────────────────────────────────────────

describe("useTamagotchi — initial state (US1)", () => {
  it("initializes health to HEALTH_DEFAULT (100)", () => {
    const { result } = renderHook(() => useTamagotchi(), {
      wrapper: ProviderWrapper,
    });
    expect(result.current.state.health).toBe(HEALTH_DEFAULT);
  });

  it("throws when called outside TamagotchiProvider", () => {
    expect(() => renderHook(() => useTamagotchi())).toThrow(
      "useTamagotchi must be used within TamagotchiProvider"
    );
  });
});

// ─── US2: updateHealth bounds ─────────────────────────────────────────────

function ProviderWrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(TamagotchiProvider, null, children);
}

describe("updateHealth — bounds enforcement (US2)", () => {
  it("clamps to 100 when adding 50 to full health (100 + 50 = 100)", () => {
    const { result } = renderHook(() => useTamagotchi(), {
      wrapper: ProviderWrapper,
    });
    act(() => result.current.updateHealth(50));
    expect(result.current.state.health).toBe(100);
  });

  it("clamps to 0 when subtracting 150 from health 50 (50 - 150 = 0)", () => {
    const { result } = renderHook(() => useTamagotchi(), {
      wrapper: ProviderWrapper,
    });
    act(() => result.current.updateHealth(-50)); // bring to 50
    act(() => result.current.updateHealth(-150)); // attempt below 0
    expect(result.current.state.health).toBe(0);
  });

  it("subtracts 10 from health 50 yielding 40", () => {
    const { result } = renderHook(() => useTamagotchi(), {
      wrapper: ProviderWrapper,
    });
    act(() => result.current.updateHealth(-50)); // bring to 50
    act(() => result.current.updateHealth(-10));
    expect(result.current.state.health).toBe(40);
  });
});

// ─── US2: resetHealth ─────────────────────────────────────────────────────

describe("resetHealth (US2)", () => {
  it("restores health to HEALTH_DEFAULT from 0", () => {
    const { result } = renderHook(() => useTamagotchi(), {
      wrapper: ProviderWrapper,
    });
    act(() => result.current.updateHealth(-200)); // force to 0
    expect(result.current.state.health).toBe(0);
    act(() => result.current.resetHealth());
    expect(result.current.state.health).toBe(HEALTH_DEFAULT);
  });
});
