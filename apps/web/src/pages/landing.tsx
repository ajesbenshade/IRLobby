import AuthForm from '@/components/auth-form';
import PublicMetadata from '@/components/public-metadata';
import { useAuth } from '@/hooks/useAuth';
import { getSafePostAuthRedirect } from '@/lib/authRouting';
import { useNavigate, useSearchParams } from 'react-router-dom';

// Signed-out `/` and `/login`: a full-viewport phone-width sign-in screen.
export default function Landing() {
  const { handleAuthentication, loginWithGoogleIdToken, loginWithAppleIdentityToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const postAuthRedirect = () =>
    navigate(getSafePostAuthRedirect(searchParams.get('redirect')), { replace: true });

  const handleAuth = async (token: string, userId: string) => {
    await handleAuthentication(token, userId);
    postAuthRedirect();
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#ece6e2] text-[#222222]">
      <PublicMetadata
        title="The Foyer — Franconia Mennonite Church"
        description="The Foyer is the gatherings app for Franconia Mennonite Church."
        canonicalPath="/"
      />
      <main
        id="auth"
        className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col justify-center bg-[#f6f1ee] px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] sm:shadow-xl"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/app-icon.png" alt="" className="h-16 w-16 rounded-2xl ring-1 ring-[#e1dbd7]" />
          <h1 className="mt-3 font-display text-[28px] font-bold leading-none">The Foyer</h1>
          <p className="mt-1 text-sm text-[#6e6a68]">Franconia Mennonite Church</p>
        </div>
        <AuthForm
          onAuthenticated={handleAuth}
          loginWithGoogleIdToken={loginWithGoogleIdToken}
          loginWithAppleIdentityToken={loginWithAppleIdentityToken}
          onOAuthSuccess={postAuthRedirect}
        />
        <p className="mt-6 text-center text-xs text-[#6e6a68]">
          <a href="/privacy" className="hover:underline">
            Privacy
          </a>
          {' · '}
          <a href="/terms" className="hover:underline">
            Terms
          </a>
          {' · '}
          <a href="/support" className="hover:underline">
            Support
          </a>
        </p>
      </main>
    </div>
  );
}
