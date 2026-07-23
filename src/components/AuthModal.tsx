import { useState } from 'react';
import { Sun, Eye, EyeOff, Smile } from 'lucide-react';
import { supabase, createSessionClient } from '../lib/supabase';
import { AVATAR_COLORS } from '../lib/types';
import type { Profile } from '../lib/types';

interface Props {
  onProfileCreated: (profile: Profile) => void;
}

export default function AuthModal({ onProfileCreated }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  async function handleForgotPassword() {
    if (!email.trim()) { setError('Enter your email above, then click Forgot password.'); return; }
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (err) { setError(err.message); } else { setResetSent(true); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'login') {
      const client = rememberMe ? supabase : createSessionClient();
      const { error: err } = await client.auth.signInWithPassword({ email, password });
      if (err) setError(err.message);
    } else {
      if (!displayName.trim() || !username.trim()) {
        setError('Name and username are required.');
        setLoading(false);
        return;
      }

      const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (cleanUsername.length < 3) {
        setError('Username must be at least 3 characters.');
        setLoading(false);
        return;
      }
      if (cleanUsername.length > 20) {
        setError('Username must be 20 characters or fewer.');
        setLoading(false);
        return;
      }

      const { data: existing } = await supabase
        .from('profiles').select('id').eq('username', cleanUsername).maybeSingle();
      if (existing) { setError('Username already taken.'); setLoading(false); return; }

      const { data: reserved } = await supabase
        .from('reserved_usernames').select('username').eq('username', cleanUsername).maybeSingle();
      if (reserved) { setError('Username not available.'); setLoading(false); return; }

      const { data: authData, error: signUpErr } = await supabase.auth.signUp({ email, password });
      if (signUpErr) { setError(signUpErr.message); setLoading(false); return; }

      if (authData.user) {
        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        const color = AVATAR_COLORS[(count ?? 0) % AVATAR_COLORS.length];

        const { data: newProfile, error: profileErr } = await supabase
          .from('profiles')
          .insert({ id: authData.user.id, username: cleanUsername, display_name: displayName.trim(), avatar_color: color })
          .select()
          .single();

        if (profileErr) {
          const msg = profileErr.code === '23505'
            ? 'Username already taken. Please choose another.'
            : 'Account created but profile setup failed. Try logging in.';
          setError(msg);
        } else {
          onProfileCreated(newProfile);
        }
      }
    }

    setLoading(false);
  }

  const inputClass =
    'w-full px-4 py-2.5 border-2 border-brand-blue text-sm font-medium focus:outline-none focus:border-brand-blue bg-white';

  return (
    <div className="min-h-screen bg-brand-yellow flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-2">
            <Sun className="w-8 h-8 text-brand-blue" strokeWidth={2.5} />
            <span className="font-bold text-2xl uppercase tracking-tight text-brand-blue">
              Summer Reading Program! <Smile className="inline w-6 h-6 mb-0.5" strokeWidth={2} />
            </span>
          </div>
        </div>

        <div className="bg-white border-2 border-brand-blue shadow-[6px_6px_0px_0px_rgba(15,0,227,1)]">
          {/* Toggle */}
          <div className="flex border-b-2 border-brand-blue">
            <button
              onClick={() => { setMode('login'); setError(null); setResetSent(false); }}
              className={`flex-1 py-3 text-sm font-bold uppercase border-r-2 border-brand-blue transition-colors ${
                mode === 'login' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(null); }}
              className={`flex-1 py-3 text-sm font-bold uppercase transition-colors ${
                mode === 'signup' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                    Name
                  </label>
                  <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name" className={inputClass} required />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                    Username
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">@</span>
                    <input type="text" value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
                      maxLength={20}
                      placeholder="yourhandle" className={`${inputClass} pl-7`} required />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" className={inputClass} required />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-500">Password</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[10px] font-semibold uppercase tracking-widest text-brand-blue hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                  minLength={6} className={`${inputClass} pr-10`} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'login' && (
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div
                  onClick={() => setRememberMe((v) => !v)}
                  className={`w-4 h-4 border-2 border-brand-blue flex-shrink-0 flex items-center justify-center transition-colors ${rememberMe ? 'bg-brand-blue' : 'bg-white'}`}
                >
                  {rememberMe && (
                    <svg viewBox="0 0 10 8" className="w-2.5 h-2 fill-none stroke-white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1,4 3.5,6.5 9,1" />
                    </svg>
                  )}
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                  Remember me
                </span>
              </label>
            )}

            {resetSent && (
              <div className="border-2 border-green-500 bg-green-50 text-green-700 text-sm font-medium px-4 py-3">
                Password reset email sent — check your inbox.
              </div>
            )}
            {error && (
              <div className="border-2 border-brand-red bg-red-50 text-brand-red text-sm font-medium px-4 py-3">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 border-2 border-brand-blue bg-brand-yellow hover:bg-yellow-300 text-gray-900 font-bold text-sm uppercase transition-colors disabled:opacity-50">
              {loading ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Create Account'}
            </button>

            {mode === 'signup' && (
              <p className="text-center text-[11px] text-gray-400 leading-relaxed">
                By creating an account you agree to our{' '}
                <a href="#privacy" className="text-brand-blue font-semibold hover:underline">
                  Privacy Policy
                </a>
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
