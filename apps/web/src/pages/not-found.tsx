import PublicMetadata from '@/components/public-metadata';
import PublicSiteLayout from '@/components/public-site-layout';
import { AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <PublicSiteLayout>
      <PublicMetadata
        title="Page Not Found - IRLobby"
        description="The page you requested could not be found. Return to IRLobby home, features, support, or download."
        canonicalPath="/404"
      />
      <section className="px-6 py-28">
        <div className="public-glass mx-auto max-w-2xl rounded-[32px] p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#ff2e63]/15 text-[#ff6b9a]">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-display text-4xl font-black text-white">Page not found</h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/70">
            That URL does not exist in the latest IRLobby web app. Use one of the links below to get
            back on track.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/"
              className="rounded-full bg-[#ff2e63] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#e01f52]"
            >
              Go home
            </Link>
            <Link
              to="/features"
              className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              View features
            </Link>
            <Link
              to="/support"
              className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Support
            </Link>
          </div>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
