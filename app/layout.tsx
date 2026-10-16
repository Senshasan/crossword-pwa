import type { Metadata, Viewport } from 'next'
import { Newsreader, Schibsted_Grotesk } from 'next/font/google'
import './globals.css'

// Sunday-paper pairing: a newspaper serif for headings and clues, a news-house grotesk for UI and grid letters.
const display = Newsreader({ subsets: ['latin'], variable: '--font-display-face', display: 'swap', style: ['normal', 'italic'] })
const sans = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-sans-face', display: 'swap' })

export const metadata: Metadata = {
  title: 'Across & Along — A family crossword collection',
  description: 'A private, ad-free crossword collection made for family and friends.',
  applicationName: 'Across & Along',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'Across & Along', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon.svg', apple: '/apple-icon.png' },
}

export const viewport: Viewport = { viewportFit: 'cover', colorScheme: 'light dark', themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f6f4ee' }, { media: '(prefers-color-scheme: dark)', color: '#1b1f1d' }] }

// Runs before first paint: saved choice, else the system setting. Avoids a light/dark flash.
const themeScript = `try{var t=localStorage.getItem('theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
