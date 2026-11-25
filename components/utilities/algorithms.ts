export function randomIndex(count: number): number {
  if (!Number.isSafeInteger(count) || count < 1 || count > 65536) throw new Error("Invalid number of choices.");
  const bound = Math.floor(0x100000000 / count) * count;
  const value = new Uint32Array(1);
  do { crypto.getRandomValues(value); } while (value[0] >= bound);
  return value[0] % count;
}

export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function makeTeams(input: string, count: number, balance: boolean): string[][] {
  const lines = input.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length < 2 || lines.length > 256) throw new Error("Enter between 2 and 256 players.");
  if (!Number.isInteger(count) || count < 2 || count > Math.min(64, lines.length)) throw new Error("Choose 2–64 teams, with at least one player per team.");
  const players = lines.map(line => {
    if (line.length > 100) throw new Error("Keep each player name and skill under 100 characters.");
    if (!balance) return { name: line, skill: 0 };
    const match = line.match(/^(.+?)\s*\|\s*(\d+)$/);
    if (!match || !match[1].trim() || Number(match[2]) > 100) throw new Error("Use Name | skill on every line. Skill must be 0–100.");
    return { name: match[1].trim(), skill: Number(match[2]) };
  });
  if (new Set(players.map(p => p.name.toLowerCase())).size !== players.length) throw new Error("Give each player a unique name.");
  const teams = Array.from({length:count}, () => ({ players: [] as string[], score: 0 }));
  const ordered = shuffle(players);
  if (balance) ordered.sort((a,b) => b.skill - a.skill);
  for (const player of ordered) {
    const team = teams.reduce((best, t) => t.players.length < best.players.length || (t.players.length === best.players.length && t.score < best.score) ? t : best);
    team.players.push(player.name);
    team.score += player.skill;
  }
  return teams.map(t => t.players);
}

export function zonedInstants(value: string, zone: string): number[] {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return [];
  const nominal = Date.parse(value + ":00Z");
  if (!Number.isFinite(nominal)) return [];
  const formatter = new Intl.DateTimeFormat("en-CA",{ timeZone:zone, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hourCycle:"h23" });
  const partsAt = (ms:number) => {
    const p = Object.fromEntries(formatter.formatToParts(ms).map(p => [p.type,p.value]));
    return p.year+"-"+p.month+"-"+p.day+"T"+p.hour+":"+p.minute;
  };
  const offsets = [-36,0,36].map(h => {
    const probe = nominal+h*3600000;
    return Date.parse(partsAt(probe)+":00Z") - probe;
  });
  return [...new Set(offsets)].map(offset => nominal-offset).filter(ms => partsAt(ms) === value).sort((a,b)=>a-b);
}

export function stickerSize(width:number,height:number,edge=512): [number,number] {
  const scale = edge / Math.max(width,height);
  return [Math.max(1, Math.round(width * scale)), Math.max(1,Math.round(height * scale))];
}

