import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Github } from 'lucide-react'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const _jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: 'Paisa - Budget dashboard',
  description: 'Compare your spending year over year with Lunch Money',
  icons: {
    icon: [
      {
        url: '/icon.png',
        type: 'image/png',
      },
    ]
  },
}

export const viewport: Viewport = {
  themeColor: '#0f1729',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${_inter.variable} ${_jetbrainsMono.variable} font-sans antialiased flex min-h-screen flex-col`}>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-border bg-muted/30 py-4">
          <div className="container mx-auto flex justify-center px-4">
            <Link
              href="https://github.com/varughese/paisa"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="h-4 w-4" aria-hidden />
              Source on GitHub
            </Link>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  )
}
