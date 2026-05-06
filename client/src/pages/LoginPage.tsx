import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import { Shield, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { user, isAdmin, loading, signIn } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAdmin && user) {
      navigate("/");
    }
  }, [loading, isAdmin, user, navigate]);

  return (
    <>
      <SEO title="Admin Login" path="/login" noindex />
      <div className="min-h-screen bg-gradient-to-b from-red-950 to-red-900 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-orange-400 text-4xl">🕉</span>
          <h1 className="text-white font-display text-2xl font-bold mt-3">
            Admin Login
          </h1>
          <p className="text-red-300 text-sm mt-2">
            Bhagavad Gita — Content Management
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 size={24} className="text-orange-400 animate-spin" />
              <p className="text-red-200 text-sm">Checking session...</p>
            </div>
          ) : isAdmin && user ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <img
                src={user.photoURL || ""}
                alt=""
                className="w-12 h-12 rounded-full border-2 border-orange-400"
                referrerPolicy="no-referrer"
              />
              <p className="text-white text-sm font-medium">{user.displayName}</p>
              <p className="text-red-300 text-xs">{user.email}</p>
              <p className="text-orange-400 text-xs font-semibold flex items-center gap-1">
                <Shield size={12} />
                Admin access granted
              </p>
              <p className="text-red-300 text-xs mt-1">Redirecting...</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <Shield size={16} className="text-orange-400" />
                <p className="text-red-100 text-sm">
                  Sign in with your Google account to manage images.
                </p>
              </div>
              <button
                onClick={signIn}
                className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-800 font-semibold px-4 py-3 rounded-xl transition-colors text-sm shadow-lg"
              >
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Sign in with Google
              </button>
              <p className="text-red-400 text-xs text-center mt-4">
                Only authorized admin accounts can access this feature.
              </p>
            </>
          )}
        </div>

        <div className="text-center mt-6">
          <a href="/" className="text-red-300 hover:text-orange-300 text-xs transition-colors">
            &larr; Back to Bhagavad Gita
          </a>
        </div>
        </div>
      </div>
    </>
  );
}
