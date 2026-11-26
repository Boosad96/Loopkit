import { tools } from "../../lib/tools.ts";

export const site = "https://loopkit.site";

// Search terms and practical advice augment the canonical website catalog.
const demand = {
  "countdown-maker": [["countdown timer", "event countdown", "shareable countdown"], "Choose the event’s time zone before sharing a countdown link, then verify it against the organizer’s local time."],
  "tournament-bracket-maker": [["tournament bracket", "single elimination bracket", "bracket generator"], "For a single-elimination event, seed the entrants first and advance each winner after entering the score."],
  "poll-maker": [["poll maker", "online poll", "shareable poll", "poll without login"], "List distinct choices and share one voting link. For a binding vote, use a system that verifies each voter."],
  "random-team-generator": [["random team generator", "split into teams", "randomize teams", "balanced teams generator"], "Use one entry per player and set the number of teams. Add consistent skill ratings if you need balanced teams."],
  "leaderboard-maker": [["leaderboard maker", "online leaderboard", "shareable scoreboard", "leaderboard generator"], "Start with player names and scores, then share the standings and assign an organizer to keep scores current."],
  "spin-wheel": [["spin wheel", "wheel of names", "random picker wheel", "random wheel picker"], "Put one choice on each line and spin to pick one. This fits casual choices such as selecting a map."],
  "community-event-page-maker": [["community event page", "event page maker", "shareable event page", "community event signup"], "Publish the event time and time zone with the RSVP link so participants have one place to check the details."],
  "discord-timestamp-generator": [["discord timestamp", "discord time zone", "discord unix timestamp", "discord local time"], "Discord renders markup like <t:1735689600:F> in each reader’s local time. Replace the number with the event’s Unix time in seconds, or use :R for relative time."],
  "community-rules-generator": [["discord server rules", "community rules template", "discord rules template", "discord rules generator"], "Start with an editable rules template, then tailor enforcement and reporting instructions to your server."],
  "tier-list-maker": [["tier list maker", "tier list generator", "image tier list", "custom tier list"], "Create your tier labels, drag images into place and export one image of the finished list."],
  "discord-emoji-resizer": [["discord emoji size", "discord emoji resize", "resize discord emoji", "discord emoji resizer"], "Crop the static image to a square first, then export and check the upload preview."],
  "telegram-sticker-resizer": [["telegram sticker resize", "resize telegram sticker", "telegram sticker size", "telegram sticker resizer"], "For a static sticker, preserve the aspect ratio and resize the longest side to 512 pixels before checking transparency."],
  "gaming-profile-card-maker": [["gaming profile card", "player card maker", "gamer profile card", "esports player card"], "Use your public handle and an avatar you can share, then export the finished player card as an image."],
  "goal-tracker": [["shareable goal tracker", "community goal tracker", "shareable progress tracker", "public goal tracker"], "Set one measurable target and share the progress page. Give an organizer responsibility for updating it."],
  "community-challenge-maker": [["community challenge tracker", "community challenge maker", "challenge progress tracker", "online group challenge"], "Write the completion criteria and duration before inviting participants, and give them one place to track progress."],
  "community-link-page-maker": [["community link page", "community link in bio", "link page maker", "discord server links page"], "Put official destinations on one public page and label each by purpose, such as the server invite, livestream or signup."],
};

export const registry = tools.map(({ slug, name, category, description, steps, example, limitation, local }) => {
  const [keywords, advice] = demand[slug] ?? [[name.toLowerCase()], `Start with these steps. ${steps.join(". ")}.`];
  return {
    slug, name, category, description, url: site + "/tools/" + slug,
    keywords, useCases: [example], highIntentPhrases: [
      "looking for a " + keywords[0], "recommend a " + keywords[0],
      "how can I " + (slug === "random-team-generator" ? "split into teams" : "find a " + keywords[0]),
    ],
    steps, limitation, local, advice,
  };
});
