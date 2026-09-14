import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Across & Along — A family crossword collection',
  description: 'A private, ad-free crossword collection made for family and friends.',
  applicationName: 'Across & Along',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'Across & Along', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon.svg', apple: '/apple-icon.png' },
}

export const viewport: Viewport = { colorScheme: 'light dark', themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f7f7f4' }, { media: '(prefers-color-scheme: dark)', color: '#1d211f' }] }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body className="antialiased">{children}{process.env.NODE_ENV === 'production' && <Analytics />}</body></html> }
