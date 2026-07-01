import { useState, useRef, useEffect } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';
import AvatarIcon from './AvatarIcon';

interface Props {
  profile: Profile;
  onClose: () => void;
  onSaved: (updated: Profile) => void;
}

export default function ProfileModal({ profile, onClose, onSaved }: Props) {
  const [username, setUsername] = useState(profile.username);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showChangePw, setShowChangePw] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url);
  const [clearAvatar, setClearAvatar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm' | 'deleted'>('idle');
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setClearAvatar(false);
  }

  function handleRemoveAvatar() {
    setAvatarFile(null);
    setAvatarPreview(null);
    setClearAvatar(true);
    if (fileRef.current) fileRef.current.value = '';
  }

  useEffect(() => {
    if (deleteStep !== 'deleted') return;
    const t = setTimeout(() => supabase.auth.signOut(), 2000);
    return () => clearTimeout(t);
  }, [deleteStep]);

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Deletion failed');
      }
      setDeleteStep('deleted');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setDeleteStep('idle');
    } finally {
      setDeleting(false);
    }
  }

  async function handleSave() {
    const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername.length < 3) { setError('Username must be at least 3 characters (letters, numbers, underscores).'); return; }
    if (showChangePw) {
      if (!currentPassword) { setError('Enter your current password.'); return; }
      if (!password) { setError('Enter a new password.'); return; }
      if (password.length < 6) { setError('New password must be at least 6 characters.'); return; }
      if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    }
    setLoading(true);
    setError(null);
    setPasswordSuccess(false);

    try {
      const { data: existing } = await supabase
        .from('profiles').select('id').eq('username', cleanUsername).neq('id', profile.id).maybeSingle();
      if (existing) throw new Error('Username already taken.');

      let avatarUrl = profile.avatar_url;

      if (clearAvatar) {
        avatarUrl = null;
      } else if (avatarFile) {
        const ext = avatarFile.name.split('.').pop();
        const path = `avatars/${profile.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('media')
          .upload(path, avatarFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
        avatarUrl = publicUrl;
      }

      const { data: updated, error: updateErr } = await supabase
        .from('profiles')
        .update({ username: cleanUsername, avatar_url: avatarUrl })
        .eq('id', profile.id)
        .select()
        .single();
      if (updateErr) throw updateErr;

      if (showChangePw && password) {
        const { data: { user } } = await supabase.auth.getUser();
        const { error: reAuthErr } = await supabase.auth.signInWithPassword({
          email: user?.email ?? '',
          password: currentPassword,
        });
        if (reAuthErr) throw new Error('Current password is incorrect.');
        const { error: pwErr } = await supabase.auth.updateUser({ password });
        if (pwErr) throw pwErr;
        setPasswordSuccess(true);
        setCurrentPassword('');
        setPassword('');
        setConfirmPassword('');
        setShowChangePw(false);
      }

      onSaved(updated);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full px-4 py-2.5 border-2 border-brand-blue text-sm font-medium focus:outline-none focus:border-brand-blue bg-white';
  const labelClass =
    'block text-[10px] font-semibold uppercase tracking-widest text-brand-blue mb-1.5';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-sm border-2 border-brand-blue shadow-[6px_6px_0px_0px_rgba(15,0,227,1)] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title row */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="font-bold text-lg uppercase tracking-tight text-brand-blue">
            Your Profile
          </h2>
          <button
            onClick={onClose}
            className="text-gray-900 hover:opacity-60 transition-opacity"
          >
            <X className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>

        {/* Avatar preview */}
        <div className="flex justify-center mb-4">
          {avatarPreview ? (
            <div className="relative group">
              <img
                src={avatarPreview}
                alt=""
                className="w-16 h-16 object-cover border-2 border-brand-blue"
              />
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-5 h-5 text-white" strokeWidth={3} />
              </button>
            </div>
          ) : (
            <AvatarIcon avatarColor={profile.avatar_color} userId={profile.id} size="xl" className="border-2 border-brand-blue" />
          )}
        </div>

        <div className="px-6 pb-6 space-y-4">
          {deleteStep === 'deleted' ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-2xl">😢</p>
              <p className="font-bold text-lg text-brand-blue uppercase tracking-tight">
                We'll miss you!
              </p>
            </div>
          ) : deleteStep === 'confirm' ? (
            <div className="space-y-5">
              <p className="text-center text-sm font-semibold text-gray-800 leading-snug pt-2">
                Are you sure you want to delete? :(
              </p>
              {error && (
                <div className="border-2 border-brand-red bg-red-50 text-brand-red text-sm font-medium px-4 py-3">
                  {error}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => { setDeleteStep('idle'); setError(null); }}
                  disabled={deleting}
                  className="flex-1 py-3 border-2 border-brand-blue font-bold text-sm uppercase text-gray-900 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  No
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="flex-1 py-3 border-2 border-brand-blue bg-brand-red font-bold text-sm uppercase text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Yes'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Username */}
              <div>
                <label className={labelClass}>Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className={inputClass}
                  placeholder="e.g. your_username"
                />
              </div>

              {/* Avatar image upload */}
              <div>
                <label className={labelClass}>Avatar Image</label>
                <div className="flex items-center border-2 border-brand-blue bg-white overflow-hidden">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="px-3 py-2.5 bg-brand-red text-white font-bold text-xs uppercase shrink-0 hover:bg-red-700 transition-colors"
                  >
                    Choose File
                  </button>
                  <span className="px-3 text-sm text-gray-500 truncate">
                    {avatarFile ? avatarFile.name : 'No file chosen'}
                  </span>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Change Password */}
              <div className="border-t-2 border-dashed border-gray-200 pt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => { setShowChangePw(!showChangePw); setPasswordSuccess(false); setCurrentPassword(''); setPassword(''); setConfirmPassword(''); setError(null); }}
                  className="text-[10px] font-semibold uppercase tracking-widest text-brand-blue hover:underline"
                >
                  {showChangePw ? 'Cancel' : 'Change Password'}
                </button>
                {showChangePw && (
                  <>
                    <div>
                      <label className={labelClass}>Current Password</label>
                      <div className="relative">
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="••••••••"
                          className={`${inputClass} pr-10`}
                          autoFocus
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>New Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className={`${inputClass} pr-10`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Confirm New Password</label>
                      <div className="relative">
                        <input
                          type={showConfirm ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className={`${inputClass} pr-10 ${confirmPassword && confirmPassword !== password ? 'border-brand-red' : ''}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm(!showConfirm)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                        >
                          {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {confirmPassword && confirmPassword !== password && (
                        <p className="text-[10px] text-brand-red font-semibold mt-1">Passwords do not match</p>
                      )}
                    </div>
                  </>
                )}
                {passwordSuccess && (
                  <div className="border-2 border-green-500 bg-green-50 text-green-700 text-sm font-medium px-4 py-2">
                    Password updated successfully.
                  </div>
                )}
              </div>

              {error && (
                <div className="border-2 border-brand-red bg-red-50 text-brand-red text-sm font-medium px-4 py-3">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="flex-1 py-3 border-2 border-brand-blue font-bold text-sm uppercase text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  Log Out
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading || username.trim().length < 3}
                  className="flex-1 py-3 border-2 border-brand-blue bg-brand-red font-bold text-sm uppercase text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Saving…' : 'Save'}
                </button>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setDeleteStep('confirm')}
                  className="text-[10px] text-gray-400 hover:text-brand-red transition-colors uppercase tracking-wide font-semibold"
                >
                  Delete account
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
