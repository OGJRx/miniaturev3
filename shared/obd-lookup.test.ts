import { describe, it, expect } from "vitest";
import { ObdLookupService } from "./obd-lookup";

describe("ObdLookupService.sanitizeFtsQuery", () => {
  it("should wrap simple words in quotes", () => {
    expect(ObdLookupService.sanitizeFtsQuery("motor")).toBe('"motor"');
    expect(ObdLookupService.sanitizeFtsQuery("engine fail")).toBe(
      '"engine" "fail"',
    );
  });

  it("should remove special characters", () => {
    expect(ObdLookupService.sanitizeFtsQuery('motor "fails"')).toBe(
      '"motor" "fails"',
    );
    expect(ObdLookupService.sanitizeFtsQuery("P0420-77")).toBe('"P0420" "77"');
    expect(ObdLookupService.sanitizeFtsQuery("engine: overheat")).toBe(
      '"engine" "overheat"',
    );
  });

  it("should remove FTS5 reserved words", () => {
    expect(ObdLookupService.sanitizeFtsQuery("motor AND engine")).toBe(
      '"motor" "engine"',
    );
    expect(ObdLookupService.sanitizeFtsQuery("motor OR engine")).toBe(
      '"motor" "engine"',
    );
    expect(ObdLookupService.sanitizeFtsQuery("motor NOT engine")).toBe(
      '"motor" "engine"',
    );
    expect(ObdLookupService.sanitizeFtsQuery("motor NEAR engine")).toBe(
      '"motor" "engine"',
    );
  });

  it("should handle empty or whitespace-only strings", () => {
    expect(ObdLookupService.sanitizeFtsQuery("")).toBe("");
    expect(ObdLookupService.sanitizeFtsQuery("   ")).toBe("");
    expect(ObdLookupService.sanitizeFtsQuery(' " * ( ) - : ')).toBe("");
  });

  it("should handle mixed complex cases", () => {
    const input = 'P0420: "cat" OR (fail) - critical*';
    // Expectation: P0420 cat fail critical (all quoted)
    expect(ObdLookupService.sanitizeFtsQuery(input)).toBe(
      '"P0420" "cat" "fail" "critical"',
    );
  });
});
