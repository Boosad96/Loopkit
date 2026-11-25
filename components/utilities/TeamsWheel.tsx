"use client";
import { track } from "@/components/account/Analytics";
import { useEffect, useRef, useState } from "react";
import { makeTeams, randomIndex } from "./algorithms";
import Share from "./Share";
import { Copy, downloadBlob } from "./common";

export function Teams() {
  const [params] = useState(() => new URLSearchParams(location.hash.slice(1)));
  const [names, setNames] = useState(
      (params.get("players") || "").slice(0, 16384),
    ),
    [count, setCount] = useState(Number(params.get("teams") || 2)),
    [balance, setBalance] = useState(params.get("skill") === "1");
  const [result, setResult] = useState<string[][]>([]),
    [error, setError] = useState("");
  const output = result
    .map((team, i) => "Team " + (i + 1) + "\n" + team.join("\n"))
    .join("\n\n");
  function build() {
    try {
      setResult(makeTeams(names, count, balance));
      track("tool_complete");
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setResult([]);
    }
  }
  return (
    <section>
      <label>
        Players, one per line
        <textarea
          rows={6}
          maxLength={16384}
          value={names}
          placeholder={balance ? "Alex | 85" : "Alex\nSam\nJules\nEli"}
          onChange={(e) => {
            setNames(e.target.value);
            setResult([]);
          }}
        />
      </label>
      <label>
        Teams
        <input
          type="number"
          min={2}
          max={64}
          value={count}
          onChange={(e) => {
            setCount(e.target.valueAsNumber);
            setResult([]);
          }}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={balance}
          onChange={(e) => {
            setBalance(e.target.checked);
            setResult([]);
          }}
        />{" "}
        Balance by skill (Name | 0–100)
      </label>
      <button onClick={build}>
        {result.length ? "Shuffle again" : "Generate teams"}
      </button>
      <p role="alert">{error}</p>
      {result.length > 0 && (
        <>
          <div className="lk-team-grid">
            {result.map((team, i) => (
              <article key={i}>
                <h3>Team {i + 1}</h3>
                <ul>
                  {team.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <Copy value={output} label="Copy teams" event={null} />{" "}
          <button
            onClick={() =>
              downloadBlob(
                new Blob([output], { type: "text/plain" }),
                "teams.txt",
                false,
              )
            }
          >
            Export TXT
          </button>{" "}
          <Share
            key={names + count + balance}
            title="Team configuration"
            data={{
              players: names,
              teams: String(count),
              skill: balance ? "1" : "0",
            }}
          />
        </>
      )}
    </section>
  );
}
const palette = [
  "#a3e635",
  "#22d3ee",
  "#c084fc",
  "#fb923c",
  "#f472b6",
  "#facc15",
];
export function Wheel() {
  const [params] = useState(() => new URLSearchParams(location.hash.slice(1)));
  const [raw, setRaw] = useState(
      (params.get("entries") ?? "Team A\nTeam B\nTeam C\nTeam D").slice(
        0,
        3000,
      ),
    ),
    [colors, setColors] = useState(() => {
      const values = params.get("colors")?.split(",");
      return values?.length === palette.length &&
        values.every((c) => /^#[a-f0-9]{6}$/i.test(c))
        ? values
        : palette;
    }),
    [remove, setRemove] = useState(params.get("remove") === "1"),
    [sound, setSound] = useState(false),
    [winner, setWinner] = useState(""),
    [busy, setBusy] = useState(false),
    [angle, setAngle] = useState(0),
    [time, setTime] = useState(0),
    [problem, setProblem] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const entries = raw
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  const valid =
    entries.length >= 2 &&
    entries.length <= 32 &&
    entries.every((s) => s.length <= 70);
  function spin() {
    if (!valid || busy) return;
    const selected = randomIndex(entries.length),
      target = 360 - ((selected + 0.5) * 360) / entries.length;
    const duration = matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : 2500;
    setTime(duration);
    setBusy(true);
    setWinner("");
    setProblem("");
    setAngle(angle + 4 * 360 + ((target - (angle % 360) + 360) % 360));
    let context: AudioContext | undefined;
    if (sound)
      try {
        context = new AudioContext();
        void context.resume().catch(() => {});
      } catch {
        setProblem("Audio is unavailable in this browser.");
      }
    timer.current = setTimeout(() => {
      setWinner(entries[selected]);
      track("tool_complete");
      setBusy(false);
      if (remove) setRaw(entries.filter((_, i) => i !== selected).join("\n"));
      if (context) {
        const tone = context.createOscillator(),
          gain = context.createGain();
        gain.gain.value = 0.035;
        tone.connect(gain);
        gain.connect(context.destination);
        tone.start();
        tone.stop(context.currentTime + 0.12);
        tone.onended = () => {
          void context.close();
        };
      }
    }, duration);
  }
  const slices = valid
    ? entries
        .map(
          (_, i) =>
            colors[i % colors.length] +
            " " +
            (i * 360) / entries.length +
            "deg " +
            ((i + 1) * 360) / entries.length +
            "deg",
        )
        .join(",")
    : colors[0] + " 0deg 360deg";
  return (
    <section>
      <label>
        Entries, one per line
        <textarea
          maxLength={3000}
          disabled={busy}
          rows={5}
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setWinner("");
          }}
        />
      </label>
      <fieldset disabled={busy}>
        <legend>Segment colors</legend>
        {colors.map((c, i) => (
          <input
            key={i}
            aria-label={"Segment color " + (i + 1)}
            type="color"
            value={c}
            onChange={(e) =>
              setColors(colors.map((v, j) => (j === i ? e.target.value : v)))
            }
          />
        ))}
      </fieldset>
      <label>
        <input
          type="checkbox"
          checked={remove}
          disabled={busy}
          onChange={(e) => setRemove(e.target.checked)}
        />{" "}
        Remove each winner
      </label>
      <label>
        <input
          type="checkbox"
          checked={sound}
          disabled={busy}
          onChange={(e) => setSound(e.target.checked)}
        />{" "}
        Play a sound
      </label>
      <div className="lk-wheel-wrap" aria-hidden="true">
        <div
          className="lk-wheel"
          style={{
            background: "conic-gradient(" + slices + ")",
            transform: "rotate(" + angle + "deg)",
            transition: "transform " + time + "ms cubic-bezier(.14,.63,.11,1)",
          }}
        >
          {valid &&
            entries.map((s, i) => (
              <span
                key={i}
                style={{
                  transform:
                    "rotate(" + ((i + 0.5) * 360) / entries.length + "deg)",
                }}
              >
                {entries.length > 10 ? i + 1 : s.slice(0, 10)}
              </span>
            ))}
        </div>
      </div>
      {entries.length > 10 && valid && (
        <ol>
          {entries.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}
      <button disabled={!valid || busy} onClick={spin}>
        {busy ? "Spinning…" : "Spin wheel"}
      </button>{" "}
      {valid && (
        <Share
          key={raw + colors.join() + remove}
          title="Spin wheel"
          data={{
            entries: raw,
            colors: colors.join(","),
            remove: remove ? "1" : "0",
          }}
        />
      )}
      <p role="status">
        {winner
          ? "Winner: " + winner
          : !valid
            ? "Enter 2–32 entries, up to 70 characters each."
            : problem}
      </p>
    </section>
  );
}
