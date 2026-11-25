"use client";
import { useState } from "react";
import Link from "next/link";
import { Search, CalendarDays, Brush, Trophy, Users } from "lucide-react";
import { tools } from "@/lib/tools";
const icons = {
  Events: CalendarDays,
  Creative: Brush,
  Competition: Trophy,
  Community: Users,
};
export default function ToolDirectory({
  initial,
  hidden,
}: {
  initial: string;
  hidden: string[];
}) {
  const [query, setQuery] = useState(initial),
    [category, setCategory] = useState("All");
  const visible = tools.filter(
    (t) =>
      !hidden.includes(t.slug) &&
      (category === "All" || category === t.category) &&
      (t.name + " " + t.description)
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <section className="tool-wrap">
      <header>
        <h1>Free community tools</h1>
        <p>
          Find what you need for your next event, match or creative session.
        </p>
      </header>
      <div className="tool-search">
        <Search aria-hidden />
        <input
          aria-label="Search tools"
          placeholder="Search tools"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="tool-filters">
        {["All", ...Object.keys(icons)].map((c) => (
          <button
            key={c}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="tool-grid">
        {visible.map((t) => {
          const Icon = icons[t.category as keyof typeof icons];
          return (
            <Link className="tool-card" href={"/tools/" + t.slug} key={t.slug}>
              <Icon aria-hidden />
              <small>{t.category}</small>
              <h2>{t.name}</h2>
              <p>{t.description}</p>
            </Link>
          );
        })}
      </div>
      {!visible.length && (
        <p role="status">
          No tools match your search. Try another word or category.
        </p>
      )}
    </section>
  );
}
