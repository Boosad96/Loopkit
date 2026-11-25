/** Keep founder-specific values in environment settings until launch review. */
export const brand = {
  name: 'LoopKit',
  tagline: 'Create. Share. Grow.',
  positioning: 'Free tools for connected communities.',
  description: 'Powerful free tools for gamers, creators and online communities. Create, customize and share in seconds.',
  domain: process.env.NEXT_PUBLIC_SITE_URL,
  contact: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
  logo: '/brand/loop.svg',
  shareImage: '/brand/social.png',
  accent: '#A3E635',
} as const;
