export interface Guide {
  slug: string
  title: string
  summary: string
  tool: string
  sections: [string, string][]
}

// Drafts live in the private repository. Only individually reviewed slugs are public.
export const guides: Guide[] = [
  {
    slug: 'discord-event-countdown', title: 'How to create a Discord event countdown',
    summary: 'Give players one start time they can check before joining voice chat.', tool: 'countdown-maker',
    sections: [
      ['Choose the moment', 'Write down the time zone of the person setting the schedule. “Friday at 8” could describe two different dates for your players. Include the date, hour and named zone before creating the countdown.'],
      ['Name the milestone', 'Use a title such as “Raid check-in opens”. If the raid starts fifteen minutes later, say so in the announcement. One countdown should answer one timing question.'],
      ['Check the handoff', 'Open the shared project in a second browser. Compare the time left with the event announcement and test what visitors see after the target time. Pin the participant link in your event channel.'],
    ],
  },
  {
    slug: 'organize-esports-tournament', title: 'How to organize an esports tournament',
    summary: 'Plan a single-elimination bracket that players and scorekeepers can follow.', tool: 'tournament-bracket-maker',
    sections: [
      ['Close registration', 'Record one distinct name per entrant. Confirm attendance before publishing the bracket and decide how long a player has to check in.'],
      ['Set the draw', 'Choose a bracket size that fits your field. Decide whether seed order reflects qualification or a random draw and describe that choice in your announcement. Explain how unfilled positions advance.'],
      ['Record results', 'Have both sides confirm a match score before advancing a winner. Give spectators the public bracket link and keep editing access with a named scorekeeper.'],
    ],
  },
  {
    slug: 'gaming-leaderboard', title: 'How to create a gaming leaderboard',
    summary: 'Make scores understandable and handle ties before the first round.', tool: 'leaderboard-maker',
    sections: [
      ['Choose one scoring unit', 'A leaderboard titled “Weekly race points” is easier to interpret than one titled “Winners”. Write down the points awarded per finish and decide what happens after a tie.'],
      ['Try a tied round', 'Before opening the competition, test two fictional players on equal points in a disposable board. Confirm the ranks match the rule you announced.'],
      ['Publish the scoreboard', 'Share the participant link in the match channel. Keep a record of round results so the organizer can explain corrections. Take a final export when the event closes.'],
    ],
  },
  {
    slug: 'anonymous-community-poll', title: 'How to create an anonymous community poll',
    summary: 'Ask an answerable question, choose voting rules and explain anonymous participation.', tool: 'poll-maker',
    sections: [
      ['Ask one question', 'For a practice night, ask “Which map should we practise on Saturday?” and list the eligible maps. Combining a map and a time in each answer makes results harder to interpret.'],
      ['Explain the rules', 'Say whether people may select one or several options, when voting ends and when the tally becomes visible. Open the participant view to check that the choices fit on a phone.'],
      ['Interpret the tally', 'Anonymous browser voting can reduce casual repeats, but one browser is not one person. Shared devices, cleared browser data and network changes can affect duplicate checks. Treat the result as community feedback.'],
    ],
  },
  {
    slug: 'discord-timestamps', title: 'How to generate Discord timestamps',
    summary: 'Give members a time that Discord can display in their own locale.', tool: 'discord-timestamp-generator',
    sections: [
      ['Start with the organizer’s zone', 'Choose the scheduled date, clock time and time zone. A named zone matters when daylight saving time changes before the event.'],
      ['Choose two views', 'For an announcement, put a full date and time on the first line and a relative timestamp underneath. Members can see both the schedule and how much time remains.'],
      ['Test the actual message', 'Copy the timestamp syntax directly into a message without surrounding code formatting. Send it in a private test channel and compare the displayed instant with your calendar.'],
    ],
  },
  {
    slug: 'balanced-gaming-teams', title: 'How to create balanced gaming teams',
    summary: 'Divide a confirmed roster into teams and account for skill differences.', tool: 'random-team-generator',
    sections: [
      ['Clean the roster', 'Use one distinct display name per player. For ten people playing five against five, request two teams. If eleven players attend, decide who rotates before announcing the draw.'],
      ['Choose how to balance', 'Random assignment is a good default when everyone wants a fresh mix. If you use skill scores, agree on one scale and collect scores consistently. A rating describes only part of a player’s contribution.'],
      ['Share a single draw', 'Verify that every player appears once. Copy the final team lists into the event channel and explain how substitutions work.'],
    ],
  },
  {
    slug: 'resize-telegram-stickers', title: 'How to resize Telegram stickers',
    summary: 'Prepare static sticker artwork while keeping its proportions and transparent edges.', tool: 'telegram-sticker-resizer',
    sections: [
      ['Prepare the source', 'Start with artwork you own or have permission to distribute. Crop empty space around the subject and use a transparent background when the shape calls for it.'],
      ['Inspect the preview', 'Choose the static sticker tool and select the local image. Check the aspect ratio and edges. Very fine lines may disappear when people view the sticker in a chat.'],
      ['Check the exported file', 'Download the finished sticker and inspect its dimensions, file size and transparency. Try it against both a light and a dark chat background before adding it to a pack.'],
    ],
  },
  {
    slug: 'community-rules', title: 'How to write community rules',
    summary: 'Turn broad expectations into actions moderators and members can recognize.', tool: 'community-rules-generator',
    sections: [
      ['Start with recurring decisions', 'List the situations moderators actually handle, such as unsolicited invites, spoilers or voice chat interruptions. Write one rule for each decision.'],
      ['Adapt the template', 'Choose a template for your community and replace generic wording with the channel name or reporting process people should use. “Post stream links in #self-promo on Fridays” is easier to enforce than “promote responsibly”.'],
      ['Publish and maintain', 'Place urgent safety rules first. Ask a moderator to apply the draft to a recent example. Copy the agreed text into your rules channel and record the revision date.'],
    ],
  },
  {
    slug: 'online-community-challenge', title: 'How to organize an online community challenge',
    summary: 'Pick a measurable goal and give members a clear way to take part.', tool: 'community-challenge-maker',
    sections: [
      ['Define completion', 'For a seven-day drawing challenge, explain whether completion means one drawing total or one each day. State the closing time and how late work is handled.'],
      ['Make participation clear', 'Provide the instructions on the challenge page. Tell members which information is visible to other participants and who to contact for a correction.'],
      ['Close the loop', 'Review progress at the scheduled finish and mention the result in the original announcement. Before running another round, ask one participant which step was confusing.'],
    ],
  },
  {
    slug: 'community-event-hub', title: 'How to create a complete community Event Hub',
    summary: 'Bring schedule, participation and competition updates into one shared event.', tool: 'community-event-page-maker',
    sections: [
      ['Map the attendee journey', 'For a match night, visitors first need the start time, then participation details, then the live bracket. Put the most time-sensitive information first.'],
      ['Choose components', 'Begin with the event description, time zone and organizer. Add the components the event needs and give each one an unambiguous title, such as “Vote on round two”.'],
      ['Rehearse the participant view', 'Open the public link in a signed-out window on a phone. Check the schedule and each enabled component, then send that same public link with the announcement. Keep organizer credentials private.'],
    ],
  },
]

export function releaseCandidates() {
  const approved = new Set((process.env.EDITORIAL_PUBLISHED_SLUGS ?? '').split(',').map(value => value.trim()))
  return guides.filter(guide => approved.has(guide.slug))
}
