'use client'
export default function RouteError({reset}:{reset:()=>void}){return <section className="tool-wrap"><h1>We couldn’t load this page</h1><button onClick={reset}>Try again</button></section>}
