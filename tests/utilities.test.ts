import { describe, it, expect } from "vitest";
import { makeTeams,randomIndex,shuffle,stickerSize,zonedInstants } from "../components/utilities/algorithms";
describe("team generator and wheel selection",()=>{
  it("partitions uneven rosters once, with at most one seat difference",()=>{
    const names=Array.from({length:17},(_,i)=>"P"+i);
    const teams=makeTeams(names.join("\n"),4,false);
    expect(teams.map(t=>t.length).sort()).toEqual([4,4,4,5]);expect(teams.flat().sort()).toEqual(names.sort());
  });
  it("spreads top seeds",()=>{const teams=makeTeams("Ace|100\nBee|90\nSee|10\nDee|0",2,true);expect(teams[0]).toEqual(["Ace","Dee"]);expect(teams[1]).toEqual(["Bee","See"]);});
  it("validates duplicate names, team counts and skills",()=>{expect(()=>makeTeams("A\na",2,false)).toThrow();expect(()=>makeTeams("A\nB",3,false)).toThrow();expect(()=>makeTeams("A|100\nB|-3",2,true)).toThrow();});
  it("keeps random indices in range and preserves shuffle input",()=>{expect(()=>randomIndex(0)).toThrow();for(let i=0;i<100;i++){const v=randomIndex(7);expect(v).toBeGreaterThanOrEqual(0);expect(v).toBeLessThan(7);}const input=[1,2,3];expect(shuffle(input).sort()).toEqual(input);expect(input).toEqual([1,2,3]);});
});
describe("timezone conversion",()=>{
  it("detects missing and repeated civil times",()=>{expect(zonedInstants("2026-03-08T02:30","America/New_York")).toEqual([]);expect(zonedInstants("2026-11-01T01:30","America/New_York").map(t=>new Date(t).toISOString())).toEqual(["2026-11-01T05:30:00.000Z","2026-11-01T06:30:00.000Z"]);});
  it("supports fractional-hour offsets and rejects invalid dates",()=>{expect(zonedInstants("2026-07-01T12:00","Asia/Kathmandu")).toEqual([Date.parse("2026-07-01T06:15:00Z")]);expect(zonedInstants("2026-02-30T12:00","UTC")).toEqual([]);});
});
it("normalizes the longest sticker edge to 512",()=>{expect(stickerSize(201,402)).toEqual([256,512]);expect(stickerSize(9000,1)).toEqual([512,1]);});

