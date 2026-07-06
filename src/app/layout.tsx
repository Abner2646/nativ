import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'Nativ — Reservation software that stays invisible',
  description: 'White-label reservation software for independent restaurants. No marketplace, no competing listings. Your guests, your brand, your data.',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Fontshare: Satoshi */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link href="https://api.fontshare.com/v2/css?f[]=satoshi@700,600,500,400&display=swap" rel="stylesheet" />

        {/* Google Fonts: Inter only (admin panel fonts loaded in (app)/layout) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: { backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.1)', color: '#F2EFE9', fontFamily: 'Inter, sans-serif', fontSize: '13px' },
          }}
        />
      </body>
    </html>
  )
}
