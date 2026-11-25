"use client";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { Globe, Gamepad2, Send, Play, AtSign } from "lucide-react";
import Challenge from "@/components/account/Challenge";
import { brand } from "@/lib/brand";
import {
  labels,
  rounds,
  standings,
  type Config,
  type Kind,
  type View,
} from "@/lib/projects/model";
import { calendar, csv, download, imageExport } from "@/lib/projects/export";
import Sharing from "./Sharing";
import "./projects.css";

function Timer({ ends, completion }: { ends: string; completion: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  if (now === null) return <p>Countdown loading…</p>;
  const s = Math.max(0, Math.floor((Date.parse(ends) - now) / 1000));
  if (!s) return <p>{completion || "Time reached."}</p>;
  return (
    <div className="pj-clock" role="timer">
      {[
        [Math.floor(s / 86400), "Days"],
        [Math.floor(s / 3600) % 24, "Hours"],
        [Math.floor(s / 60) % 60, "Minutes"],
        [s % 60, "Seconds"],
      ].map(([n, label]) => (
        <div key={label}>
          <strong key={n}>{String(n).padStart(2, "0")}</strong>
          <small>{label}</small>
        </div>
      ))}
    </div>
  );
}
function Attached({ slug, match }: { slug: string; match: Kind }) {
  const [view, setView] = useState<View | null>(null),
    [message, setMessage] = useState("Loading linked project…");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/projects/" + slug, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw Error();
        const v: View = await r.json();
        if (v.kind !== match) throw Error();
        setView(v);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage("This linked project is unavailable.");
      });
    return () => controller.abort();
  }, [slug, match]);
  return view ? <ProjectView initial={view} compact /> : <p>{message}</p>;
}
export function draftView(kind: Kind, config: Config): View {
  return {
    slug: "",
    kind,
    config,
    revision: 0,
    updatedAt: "",
    counts: {},
    votes: 0,
    joined: 0,
    finished: 0,
    voted: false,
    participating: false,
    completed: false,
  };
}
export default function ProjectView({
  initial,
  compact = false,
  embed = false,
  theme,
}: {
  initial: View;
  compact?: boolean;
  embed?: boolean;
  theme?: Config["theme"];
}) {
  const [live, setLive] = useState(initial),
    [choices, setChoices] = useState<string[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [challengeKey, refresh] = useState(0);
  const view = initial.slug ? live : initial,
    { kind, config: c, slug } = view;
  const [past, setPast] = useState(false),
    [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function check() {
      const remaining = Date.parse(c.ends) - Date.now();
      setPast(remaining <= 0);
      if (remaining > 0)
        timer = setTimeout(check, Math.min(remaining, 86400000));
    }
    const first = setTimeout(check, 0);
    return () => {
      clearTimeout(first);
      clearTimeout(timer);
    };
  }, [c.ends]);
  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    async function load() {
      if (document.visibilityState === "hidden") return;
      try {
        const r = await fetch("/api/projects/" + slug, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (r.ok) {
          setLive(await r.json());
          setUnavailable(false);
        } else if (r.status === 404) setUnavailable(true);
      } catch {
        /* Preserve the last view during temporary disconnection. */
      }
    }
    const id = setInterval(load, 30000);
    return () => {
      controller.abort();
      clearInterval(id);
    };
  }, [slug]);
  async function participate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      b = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const action = b?.value || (kind === "poll-maker" ? "vote" : "join");
    if (!slug || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/projects/" + slug, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          choices,
          challenge: new FormData(form).get("cf-turnstile-response"),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw Error(result.error);
      const updated = await fetch("/api/projects/" + slug, {
        cache: "no-store",
      });
      if (!updated.ok) throw Error("Saved. Refresh to see the update.");
      setLive(await updated.json());
      setMessage(
        action === "vote" ? "Your vote was counted." : "Participation updated.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setBusy(false);
      refresh((v) => v + 1);
    }
  }
  if (unavailable) return <p>This project is unavailable.</p>;
  function responseForm(poll = false) {
    if (embed && slug)
      return (
        <a target="_blank" rel="noopener noreferrer" href={"/s/" + slug}>
          Participate on LoopKit
        </a>
      );
    if (!slug) return <small>Participation opens on the shared page.</small>;
    if (past)
      return <p>{poll ? "Voting has closed." : "Participation has closed."}</p>;
    if (poll && view.voted) return <p>Your vote has been counted.</p>;
    return (
      <form onSubmit={participate} className="pj-participate">
        <Challenge key={challengeKey} action="project_participate" />
        {poll ? (
          <button disabled={busy || !choices.length} value="vote">
            Submit vote
          </button>
        ) : (
          <div className="project-actions">
            <button
              disabled={busy}
              value={view.participating ? "leave" : "join"}
            >
              {view.participating
                ? "Withdraw"
                : kind === "community-event-page-maker"
                  ? "RSVP"
                  : "Join challenge"}
            </button>
            {kind === "community-challenge-maker" &&
              view.participating &&
              !view.completed && (
                <button value="finish" disabled={busy}>
                  Mark complete
                </button>
              )}
          </div>
        )}
      </form>
    );
  }
  const linkList = () => (
    <ul className="pj-social-list">
      {c.links.map((l, i) => {
        let host = "";
        try {
          host = new URL(l.url).hostname.toLowerCase();
        } catch {}
        const Icon =
          host === "t.me"
            ? Send
            : host === "discord.gg" || host === "discord.com"
              ? Gamepad2
              : host.endsWith("youtube.com") || host === "youtu.be"
                ? Play
                : host === "x.com"
                  ? AtSign
                  : Globe;
        return (
          <li key={i}>
            <a
              href={l.url}
              target="_blank"
              rel="ugc nofollow noopener noreferrer"
            >
              <Icon size={18} aria-hidden="true" />
              {l.name}
            </a>
          </li>
        );
      })}
    </ul>
  );
  const date = new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: c.timezone,
  }).format(new Date(c.ends));
  const board = standings(c),
    bracket = rounds(c);
  return (
    <article
      className={"project-view pj-theme-" + (theme || c.theme)}
      style={{ "--pj-accent": c.accent } as CSSProperties}
    >
      <p className="pj-type">{labels[kind]}</p>
      <h2>{c.title}</h2>
      {c.description && <p className="pj-description">{c.description}</p>}
      {kind === "countdown-maker" && (
        <>
          <p>
            {date} · {c.timezone}
          </p>
          <Timer ends={c.ends} completion={c.completion} />
        </>
      )}
      {kind === "poll-maker" && (
        <>
          <fieldset>
            <legend>
              {c.multiple ? "Choose one or more options" : "Choose one option"}
            </legend>
            {c.options.map((o) => (
              <label key={o.id} className="pj-choice">
                <input
                  type={c.multiple ? "checkbox" : "radio"}
                  name={"choice-" + (slug || "draft")}
                  value={o.id}
                  disabled={view.voted || past || embed}
                  checked={choices.includes(o.id)}
                  onChange={(e) =>
                    setChoices(
                      c.multiple
                        ? e.target.checked
                          ? [...choices, o.id]
                          : choices.filter((a) => a !== o.id)
                        : [o.id],
                    )
                  }
                />
                {o.name}
                {(!c.hideResults || view.voted) && (
                  <span>{view.counts[o.id] || 0}</span>
                )}
                {(!c.hideResults || view.voted) && (
                  <i
                    style={{
                      width:
                        Math.round(
                          (100 * (view.counts[o.id] || 0)) /
                            Math.max(1, view.votes),
                        ) + "%",
                    }}
                  />
                )}
              </label>
            ))}
          </fieldset>
          {responseForm(true)}
          <small>
            {c.hideResults && !view.voted
              ? "Results appear after voting."
              : view.votes + " votes"}{" "}
            · Closes {date}. Anonymous votes use a browser cookie. Changing
            browsers or clearing cookies can allow another vote.
          </small>
        </>
      )}
      {kind === "tournament-bracket-maker" && (
        <>
          <div className="pj-bracket">
            {bracket.map((r, i) => (
              <section key={i}>
                <h3>
                  {i === bracket.length - 1 ? "Final" : "Round " + (i + 1)}
                </h3>
                {r.map((m) => (
                  <div key={m.key} className="pj-match">
                    {[m.a, m.b].map((t, j) => (
                      <div
                        key={j}
                        className={
                          t && t.id === m.winner?.id ? "pj-winner" : ""
                        }
                      >
                        <span>
                          {t?.name || (m.bye ? "Bye" : "To be decided")}
                        </span>
                        <b>{m.score?.[j] ?? "–"}</b>
                      </div>
                    ))}
                  </div>
                ))}
              </section>
            ))}
          </div>
          {bracket.at(-1)?.[0].winner && (
            <p>Champion · {bracket.at(-1)?.[0].winner?.name}</p>
          )}
          <button
            onClick={() =>
              imageExport(
                c.title,
                bracket.flatMap((r, i) => [
                  "Round " + (i + 1),
                  ...r.map(
                    (m) =>
                      (m.a?.name ?? "Pending") +
                      " vs " +
                      (m.b?.name ?? "Pending") +
                      "   " +
                      (m.score?.join(" – ") ?? ""),
                  ),
                ]),
              ).catch(() => setMessage("Image export failed."))
            }
          >
            Download bracket image
          </button>
        </>
      )}
      {kind === "leaderboard-maker" && (
        <>
          <ol className="pj-board">
            {board.map((e) => (
              <motion.li layout="position" key={e.id}>
                <strong>#{e.rank}</strong>
                <span>{e.name}</span>
                <b>{e.score}</b>
              </motion.li>
            ))}
          </ol>
          <div className="project-actions">
            <button
              onClick={() =>
                download(
                  new Blob(
                    [
                      csv([
                        ["Rank", "Player", "Score"],
                        ...board.map((e) => [e.rank, e.name, e.score]),
                      ]),
                    ],
                    { type: "text/csv" },
                  ),
                  "leaderboard.csv",
                )
              }
            >
              Download CSV
            </button>
            <button
              onClick={() =>
                imageExport(
                  c.title,
                  board.map(
                    (e) => "#" + e.rank + "   " + e.name + "   " + e.score,
                  ),
                ).catch(() => setMessage("Image export failed."))
              }
            >
              Download image
            </button>
          </div>
        </>
      )}
      {kind === "goal-tracker" && (
        <>
          <p>
            <strong>{c.progress}</strong> of {c.target} ·{" "}
            {Math.round((100 * c.progress) / c.target)}%
          </p>
          <progress value={Math.min(c.target, c.progress)} max={c.target} />
          <ul>
            {c.milestones.map((m, i) => (
              <li key={i}>
                {m} · {m <= c.progress ? "Reached" : "Upcoming"}
              </li>
            ))}
          </ul>
        </>
      )}
      {kind === "community-link-page-maker" && (
        <>
          {c.logo && (
            <Image
              unoptimized
              src={c.logo}
              width={64}
              height={64}
              alt=""
              referrerPolicy="no-referrer"
            />
          )}
          {linkList()}
        </>
      )}
      {kind === "community-challenge-maker" && (
        <>
          <p>Ends {date}</p>
          <p className="pj-description">{c.rules}</p>
          <p>
            {view.joined} participants · {view.finished} complete
          </p>
          {view.completed && <p>You completed this challenge.</p>}
          {responseForm()}
          {c.attachments.Leaderboard && (
            <Attached
              key={c.attachments.Leaderboard}
              slug={c.attachments.Leaderboard}
              match="leaderboard-maker"
            />
          )}
        </>
      )}
      {kind === "community-event-page-maker" &&
        c.order.map((section) => (
          <section className="pj-section" key={section}>
            <h3>{section}</h3>
            {section === "Event information" && (
              <>
                <p>
                  {date} · {c.timezone}
                </p>
                {c.organizer && <p>Hosted by {c.organizer}</p>}
                <button
                  onClick={() =>
                    download(
                      new Blob([calendar(c, (slug || "draft") + "@loopkit")], {
                        type: "text/calendar",
                      }),
                      "event.ics",
                    )
                  }
                >
                  Add to calendar
                </button>
              </>
            )}
            {section === "Countdown" && (
              <Timer ends={c.ends} completion={c.completion} />
            )}
            {section === "RSVP" && (
              <>
                <p>{view.joined} attending</p>
                {responseForm()}
              </>
            )}
            {section === "Community links" && linkList()}
            {section === "Announcements" && (
              <ul>
                {c.announcements.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            )}
            {(section === "Poll" ||
              section === "Tournament" ||
              section === "Leaderboard") &&
              (c.attachments[section] ? (
                <Attached
                  key={c.attachments[section]}
                  slug={c.attachments[section]}
                  match={
                    {
                      Poll: "poll-maker",
                      Tournament: "tournament-bracket-maker",
                      Leaderboard: "leaderboard-maker",
                    }[section] as Kind
                  }
                />
              ) : (
                <small>Choose a linked project in the editor.</small>
              ))}
          </section>
        ))}
      {message && <p role="status">{message}</p>}
      {slug && !compact && (
        <footer className="project-foot">
          {!embed && <Sharing slug={slug} title={c.title} kind={kind} />}
          <div className="project-actions">
            <Link href={"/tools/" + kind} target={embed ? "_blank" : undefined}>
              Create your own
            </Link>
            {!embed && (
              <Link href={"/create?remix=" + slug}>Remix this project</Link>
            )}
            {!c.removeBranding && (
              <Link href="/" target={embed ? "_blank" : undefined}>
                Made with {brand.name}
              </Link>
            )}
            {!embed && <Link href={"/report?project=" + slug}>Report</Link>}
          </div>
        </footer>
      )}
    </article>
  );
}
