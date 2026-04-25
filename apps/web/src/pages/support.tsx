import PublicMetadata from '@/components/public-metadata';
import PublicSiteLayout, { PublicHeroHeader } from '@/components/public-site-layout';
import { supportFaqs } from '@/lib/public-site-content';
import { Plus } from 'lucide-react';

export default function SupportPage() {
  return (
    <PublicSiteLayout activePath="/support">
      <PublicMetadata
        title="IRLobby Support - Help, FAQ, and Contact"
        description="Get answers for common IRLobby questions, account troubleshooting, and support contact details."
        canonicalPath="/support"
      />
      <PublicHeroHeader
        eyebrow="Support"
        title={
          <>
            We <span className="public-text-gradient">read every message.</span>
          </>
        }
        description="Most common answers are below. If not, email the team and expect a response within roughly two business days."
      />

      <section className="px-6 pb-12">
        <div className="mx-auto max-w-3xl space-y-3">
          {supportFaqs.map((faq) => (
            <details
              key={faq.question}
              className="public-glass rounded-[24px] p-6 text-white group"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                {faq.question}
                <Plus className="h-5 w-5 text-[#ff6b9a] transition group-open:rotate-45" />
              </summary>
              <p className="mt-4 leading-relaxed text-white/70">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="mx-auto max-w-2xl rounded-[32px] border border-white/8 bg-white/4 p-10 text-center text-white shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
          <h2 className="font-display text-3xl font-bold">Still stuck?</h2>
          <p className="mt-3 text-white/70">
            Email the team and expect a response inside two business days.
          </p>
          <a
            href="mailto:support@irlobby.com"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-[#ff2e63] px-7 py-3 text-base font-bold text-white transition hover:scale-[1.02] hover:bg-[#e01f52]"
          >
            support@irlobby.com
          </a>
          <p className="mt-6 text-sm text-white/50">
            For privacy questions, start with the{' '}
            <a href="/privacy" className="text-[#ff6b9a] hover:underline">
              Privacy Policy
            </a>
            .
          </p>
          <p className="mt-2 text-xs text-white/45">
            Typical response window: within two business days.
          </p>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
