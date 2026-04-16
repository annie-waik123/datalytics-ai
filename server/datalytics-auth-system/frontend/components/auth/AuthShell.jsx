import Link from "next/link";

export default function AuthShell({ title, subtitle, children, footerText, footerLink, footerLabel }) {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-10 md:px-10">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="ambient ambient-three" />

      <section className="mx-auto grid w-full max-w-6xl gap-8 md:grid-cols-[1.05fr_1fr]">
        <aside className="hidden rounded-3xl border border-white/35 bg-white/20 p-10 backdrop-blur-xl md:flex md:flex-col md:justify-between">
          <div>
            <p className="tracking-[0.22em] text-amber-800/80 text-xs font-semibold">DATALYTICS AUTH</p>
            <h1 className="mt-4 text-4xl font-[var(--font-display)] leading-tight text-slate-900">
              Secure, elegant access
              <br />
              for data teams.
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-7 text-slate-700">
              Crafted with a warm culinary visual language, DATALYTICS combines strong security with a calm,
              premium authentication experience.
            </p>
          </div>

          <div className="rounded-2xl border border-white/50 bg-white/45 p-5 shadow-glow">
            <p className="text-xs tracking-[0.2em] text-slate-600">FEATURE STACK</p>
            <p className="mt-3 text-sm text-slate-700">OTP verification, JWT sessions, Google OAuth, and branded email flows.</p>
          </div>
        </aside>

        <div className="glass-card p-7 md:p-10">
          <p className="text-xs font-semibold tracking-[0.2em] text-amber-700">WELCOME</p>
          <h2 className="mt-3 text-3xl font-[var(--font-display)] text-slate-900">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{subtitle}</p>

          <div className="mt-8">{children}</div>

          {footerText ? (
            <p className="mt-7 text-sm text-slate-600">
              {footerText}{" "}
              <Link className="font-semibold text-amber-700 hover:text-amber-800" href={footerLink}>
                {footerLabel}
              </Link>
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
