import localFont from 'next/font/local';

// Public UI copy is English. Browsers use the system fallback for other scripts.
export const bodyFont = localFont({
  src: '../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  display: 'swap',
  weight: '100 900',
  variable: '--loopkit-inter',
});

export const headingFont = localFont({
  src: '../node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2',
  display: 'swap',
  weight: '300 700',
  variable: '--loopkit-space',
});
