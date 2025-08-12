// src/pages/Login.tsx
import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isAdmin, state } = useAuth();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // 🔁 When auth state flips to "authenticated", redirect
  useEffect(() => {
    if (!state.isInitialized) return; // wait for context init
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname as string | undefined;
      const dest = from ?? (isAdmin ? '/admin/dashboard' : '/');
      navigate(dest, { replace: true });
    }
  }, [isAuthenticated, isAdmin, state.isInitialized, navigate, location.state]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ username, password }); // ⬅️ no navigate here; the effect handles it
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow p-6 sm:p-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Sign in</h1>

        {error && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1 text-gray-700 dark:text-gray-200">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full rounded border px-3 py-2 bg-white dark:bg-gray-900"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-gray-700 dark:text-gray-200">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded border px-3 py-2 bg-white dark:bg-gray-900"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md px-4 py-2 font-medium border bg-gray-900 text-white disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-xs text-gray-600 dark:text-gray-300">
          Tip: use your <b>username</b> (not email).
        </p>

        <div className="mt-6 text-center">
          <Link to="/" className="text-blue-600 dark:text-blue-400 underline">Back to home</Link>
        </div>
      </div>
    </div>
  );
}
