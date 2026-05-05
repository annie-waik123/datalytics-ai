import './globals.css'
import Providers from './providers.jsx'

export const metadata = {
  metadataBase: new URL('http://localhost:5000'),
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
    url: 'http://localhost:5000',
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
      className="scroll-smooth"
      suppressHydrationWarning
      style={{
        background: '#060b14',
        '--font-display': 'Poppins, Inter, Arial, sans-serif',
        '--font-body': 'Inter, Arial, sans-serif',
        '--font-mono': 'JetBrains Mono, Consolas, monospace',
      }}
    >
      <body
        className="min-h-screen font-[family:var(--font-body)] text-white antialiased"
        style={{ background: '#060b14', backgroundColor: '#060b14' }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
