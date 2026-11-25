import { describe, expect, it } from "vitest";
import { calendar, csv } from "../lib/projects/export";
import {
  configSchema,
  initialConfig,
  localTime,
  resolveTime,
  rounds,
  recordScore,
  safeUrl,
  standings,
  shuffle,
} from "../lib/projects/model";
describe("community project calculations", () => {
  it("rejects DST gaps and ambiguous wall times, and uses exact instants across zones", () => {
    expect(() => resolveTime("2026-03-08T02:30", "America/New_York")).toThrow();
    expect(() => resolveTime("2026-11-01T01:30", "America/New_York")).toThrow();
    expect(
      localTime(resolveTime("2026-03-08T03:30", "America/New_York"), "UTC"),
    ).toBe("2026-03-08T07:30");
  });
  it("seeds byes and invalidates scores downstream of a changed result", () => {
    const c = initialConfig("tournament-bracket-maker");
    c.teams.pop();
    expect(rounds(c)[0][0].winner?.name).toBe("Team 1");
    c.scores = recordScore(c, 0, 1, [3, 1]);
    c.scores = recordScore(c, 1, 0, [0, 3]);
    expect(rounds(c)[1][0].winner?.name).toBe("Team 2");
    c.scores = recordScore(c, 0, 1, [1, 3]);
    expect(rounds(c)[1][0].winner).toBeNull();
    expect(
      shuffle(c.teams)
        .map((t) => t.id)
        .sort(),
    ).toEqual(c.teams.map((t) => t.id).sort());
  });
  it("supports 4, 8, 16 and 32 places with exactly one final", () => {
    for (const n of [4, 8, 16, 32]) {
      const c = initialConfig("tournament-bracket-maker");
      c.teams = Array.from({ length: n }, (_, i) => ({
        id: crypto.randomUUID(),
        name: String(i),
      }));
      const bracket = rounds(c);
      expect(bracket.flat()).toHaveLength(n - 1);
      expect(bracket.at(-1)).toHaveLength(1);
    }
  });
  it("ranks ties and escapes spreadsheet formulas on export", () => {
    const c = initialConfig("leaderboard-maker");
    c.entries = [3, 3, 1].map((score, i) => ({
      name: String(i),
      id: crypto.randomUUID(),
      score,
    }));
    expect(standings(c).map((e) => e.rank)).toEqual([1, 1, 3]);
    c.tie = "dense";
    expect(standings(c).map((e) => e.rank)).toEqual([1, 1, 2]);
    c.tie = "ordinal";
    expect(standings(c).map((e) => e.rank)).toEqual([1, 2, 3]);
    expect(csv([[" =3+3"]])).toContain("' =3+3");
  });
  it("validates links, identifiers and exports calendar text safely", () => {
    expect(safeUrl("javascript:alert(1)")).toBe(false);
    expect(safeUrl("https://someone@example.com")).toBe(false);
    const c = initialConfig("community-event-page-maker");
    c.title = "Games, friends\nTonight";
    expect(calendar(c, "event@loopkit")).toContain(
      "SUMMARY:Games\\, friends\\nTonight",
    );
    expect(configSchema.safeParse(c).success).toBe(true);
    c.options[0].id = c.options[1].id;
    expect(configSchema.safeParse(c).success).toBe(false);
  });
});
