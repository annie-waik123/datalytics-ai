import { Inter, JetBrains_Mono, Poppins } from 'next/font/google'
import './globals.css'
import Providers from './providers.jsx'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800', '900'],
  variable: '--font-display',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata = {
  metadataBase: new URL('http://localhost:3000'),
  title: {
    default: 'Datalytics | AI-Powered ML & Insights Platform',
    template: '%s | Datalytics',
  },
  description:
    'Datalytics helps teams upload data, explore insights, train models, and converse with their data using AI.',
  keywords: [
    'AutoML platform',
    'machine learning SaaS',
    'AI model training',
    'Datalytics',
    'data science dashboard',
    'ML deployment',
    'data chatbot',
  ],
  openGraph: {
    title: 'Datalytics | AI-Powered ML & Insights Platform',
    description:
      'The all-in-one platform to upload datasets, train models, and talk to your data.',
    url: 'http://localhost:3000',
    siteName: 'Datalytics',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Datalytics | AI-Powered ML & Insights Platform',
    description:
      'Upload data, train models, and get AI-driven insights with Datalytics.',
  },
}

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${inter.variable} ${mono.variable} scroll-smooth`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-[#020010] font-[family:var(--font-body)] text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
