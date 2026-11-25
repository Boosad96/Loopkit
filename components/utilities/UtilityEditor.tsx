"use client";
import dynamic from "next/dynamic";
const Teams=dynamic(()=>import("./TeamsWheel").then(m=>m.Teams),{ssr:false});
const Wheel=dynamic(()=>import("./TeamsWheel").then(m=>m.Wheel),{ssr:false});
const Timestamp=dynamic(()=>import("./TimeRules").then(m=>m.Timestamp),{ssr:false});
const Rules=dynamic(()=>import("./TimeRules").then(m=>m.Rules),{ssr:false});
const Resizer=dynamic(()=>import("./Images").then(m=>m.Resizer),{ssr:false});
const Profile=dynamic(()=>import("./Images").then(m=>m.Profile),{ssr:false});
const Tiers=dynamic(()=>import("./Tiers").then(m=>m.Tiers),{ssr:false});
import "./utilities.css";
export default function UtilityEditor({slug}:{slug:string}) {
  const editors:Record<string,React.ReactNode>={
    "random-team-generator":<Teams/>, "spin-wheel":<Wheel/>, "discord-timestamp-generator":<Timestamp/>, "community-rules-generator":<Rules/>,
    "tier-list-maker":<Tiers/>, "discord-emoji-resizer":<Resizer key="emoji" sticker={false}/>, "telegram-sticker-resizer":<Resizer key="sticker" sticker/>, "gaming-profile-card-maker":<Profile/>
  };
  return <div className="lk-utility" key={slug}>{editors[slug]}</div>;
}

