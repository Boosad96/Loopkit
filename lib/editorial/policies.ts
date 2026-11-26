export const policies = {
  privacy: {title:'Privacy policy', intro:'This draft covers information used to operate community tools and shared projects.', sections:[
    ['Tools and hosting','Entering text or selecting a file for a local browser tool uses your device. Creating a hosted project sends the fields you submit to the service. Treat titles, descriptions, display names and links you choose to share as public information.'],
    ['Account and service operations','The operator uses the email address supplied during account registration for sign-in and account communications. Hosting and database providers process requests to supply the service. Session cookies support authentication. Abuse prevention may process network and browser signals.'],
    ['Directory logos and shared media','An approved community listing can publicly display its submitted logo. Organizer-provided images and names in a hosted project are visible according to that project’s sharing settings.'],
    ['Optional usage analytics','Product analytics are disabled until you opt in on this device. With consent, a first-party random identifier helps measure visits and tool use. The preference is saved locally. The analytics identifier has a 90-day lifetime. The event records exclude raw URLs, IP addresses and browser user-agent strings. A random session identifier and grouped landing page labels help distinguish organic, referral and LoopKit campaign visits. Tool activity records include only the public tool name and event type. The default event retention setting is 30 days.'],
    ['Orders and advertising','When checkout is available, the payment provider handles payment credentials. The service records order references, amounts and payment states to administer access and resolve billing questions. Optional advertising may involve additional partners and choices described when advertising is activated.'],
    ['Sponsored placement reporting','When enabled, the service counts sponsorship views and clicks. To limit repeat counts, it may use a daily campaign-specific digest derived from a request address. The reporting ledger does not retain the raw address.'],
    ['Access and deletion','Contact the operator to request access, correction or deletion. Specify the account or public project involved and omit management secrets. Some transaction and security records may require separate handling under applicable law.'],
    ['Details pending review','Before public launch the operator must identify the legal entity, privacy contact, jurisdiction, processing grounds, subprocessors, international transfer arrangements, retention periods, children’s access policy and applicable rights.'],
  ]},
  terms:{title:'Terms of service',intro:'This draft describes use of the community tools and hosted projects.',sections:[
    ['Community content','Only submit material you have the right to share. You retain your rights in your content and authorize processing needed to display and deliver the project you create. Keep management credentials private.'],
    ['Moderation','The operator may review reports, restrict harmful content and suspend access for violations of the acceptable use policy. Contact the operator with the public reference and relevant context to request review.'],
    ['Paid features','Review the currency, billing interval and placement dates at checkout. Sponsorship purchases provide the advertised placement and duration. Reach, sales, search placement and voting outcomes vary.'],
    ['Details pending review','Before taking orders, the operator must confirm the contracting entity, age requirements, renewal and cancellation process, support terms, consumer protections, governing law and dispute procedure.'],
  ]},
  'acceptable-use':{title:'Acceptable use policy',intro:'Keep shared projects, listings and event participation safe for community members.',sections:[
    ['Content and conduct','Submit accurate descriptions of communities you are authorized to represent. The service prohibits scams, impersonation, adult content, piracy, malicious files and links, harassment, and disclosure of private personal information.'],
    ['Fair participation','Respect voting and submission limits. Automated spam, manufactured traffic, deceptive advertising, vote manipulation and unauthorized access to private projects are prohibited.'],
    ['Reports and review','Include the public URL, the rule involved and enough context for a moderator to check the concern. The operator may remove content or suspend access. Before launch the founder must confirm review and appeals contacts.'],
  ]},
  'refund-policy':{title:'Refund policy',intro:'This draft covers creator subscriptions and time-limited promotional placements.',sections:[
    ['Request a review','Include the order reference, payment date and a short description of the issue. Send the request through the published support contact. Do not send a card number, security code or password.'],
    ['Duplicate charges and delivery issues','The operator checks the payment provider record, entitlement and reservation history. A refund request remains under review until a decision is recorded. A provider-confirmed refund may take additional time to appear at the bank.'],
    ['Details pending review','Before enabling live payments the operator must publish eligibility rules, cancellation deadlines, prorating terms, contact information, processing timeframes and statutory rights for each supported market.'],
  ]},
} satisfies Record<string,{title:string,intro:string,sections:string[][]}>
