import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

type CreateUserPayload = {
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'moderator' | 'user';
};

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

export function CreateUser() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<CreateUserPayload>({
    username: '',
    email: '',
    password: '',
    role: 'user',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value as any }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
        credentials: 'include', // if you use cookies; remove if JWT-only
      });
      if (!res.ok) {
        let msg = 'Failed to create user';
        try {
          const j = await res.json();
          msg = j?.detail || j?.message || msg;
        } catch {}
        throw new Error(msg);
      }
      // success → back to list
      navigate('/admin/users', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Create User</h1>

      {error && (
        <div className="mb-4 p-3 rounded border border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Username</label>
          <input
            name="username"
            value={form.username}
            onChange={onChange}
            required
            className="w-full rounded border px-3 py-2 bg-white dark:bg-gray-900"
            placeholder="jdoe"
          />
        </div>

        <div>
          <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={onChange}
            required
            className="w-full rounded border px-3 py-2 bg-white dark:bg-gray-900"
            placeholder="jdoe@example.com"
          />
        </div>

        <div>
          <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Password</label>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={onChange}
            required
            className="w-full rounded border px-3 py-2 bg-white dark:bg-gray-900"
            placeholder="••••••••"
          />
        </div>

        <div>
          <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Role</label>
          <select
            name="role"
            value={form.role}
            onChange={onChange}
            className="w-full rounded border px-3 py-2 bg-white dark:bg-gray-900"
          >
            <option value="user">User</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-gray-900 text-white px-4 py-2 disabled:opacity-60"
          >
            {submitting ? 'Creating…' : 'Create'}
          </button>
          <Link to="/admin/users" className="rounded border px-4 py-2">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

export default CreateUser;
