"use client";
import { motion, useReducedMotion } from "motion/react";
export function GrowthBars({ rows }: { rows: [string, number | null][] }) {
  const staticMotion = useReducedMotion();
  return (
    <dl>
      {rows.map(([name, value]) => (
        <div key={name}>
          <dt>{name}</dt>
          <dd style={{ margin: "0 0 1rem" }}>
            {value === null ? (
              "Insufficient data"
            ) : (
              <>
                <span>{value}%</span>
                <div
                  aria-hidden="true"
                  style={{
                    height: 8,
                    background: "var(--border)",
                    overflow: "hidden",
                  }}
                >
                  <motion.div
                    initial={staticMotion ? false : { scaleX: 0 }}
                    animate={{ scaleX: Math.min(1, value / 100) }}
                    transition={{ duration: staticMotion ? 0 : 0.4 }}
                    style={{
                      height: "100%",
                      background: "var(--accent)",
                      transformOrigin: "left",
                    }}
                  />
                </div>
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
