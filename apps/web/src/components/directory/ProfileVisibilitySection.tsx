import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { profileVisibility, type ProfileVisibility } from '@/lib/profileForm';
import { apiRequest } from '@/lib/queryClient';
import { directoryListingNudge } from '@shared/directory';
import { API_ROUTES } from '@shared/schema';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

const OPTIONS: ReadonlyArray<{ value: ProfileVisibility; label: string; helper: string }> = [
  { value: 'only_me', label: 'Only me', helper: 'Only you can see your profile.' },
  {
    value: 'friends',
    label: 'Friends',
    helper: 'Your friends can see your first name, photo and short bio.',
  },
  {
    value: 'church',
    label: 'People in my church',
    helper: 'Your friends and people in your church can see your first name, photo and short bio.',
  },
  {
    value: 'public',
    label: 'Public',
    helper:
      'Your friends, your church and other people on The Foyer can see your first name, photo and short bio.',
  },
];

/** Who can see my profile, with the Directory listing nudge. Saves on its own. */
export function ProfileVisibilitySection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const selected = profileVisibility(user?.profileVisibility);
  const [saving, setSaving] = useState<ProfileVisibility | null>(null);

  const choose = async (value: ProfileVisibility) => {
    if (value === selected || saving) return;
    setSaving(value);
    try {
      const response = await apiRequest('PATCH', API_ROUTES.USER_PROFILE, {
        profile_visibility: value,
      });
      if (!response.ok) throw new Error('Could not update visibility');
      await queryClient.invalidateQueries({ queryKey: [API_ROUTES.USER_PROFILE] });
    } catch {
      toast({
        title: 'Could not update visibility',
        description: 'Check your connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  return (
    <section id="visibility" className="mt-4" aria-labelledby="visibility-heading">
      <p className="mb-1 text-[11.5px] font-bold tracking-wide text-[#6e6a68]">VISIBILITY</p>
      <h2 id="visibility-heading" className="mb-2 font-display text-xl text-[#222222]">
        Who can see my profile
      </h2>
      <div
        className="overflow-hidden rounded-2xl bg-white"
        role="radiogroup"
        aria-labelledby="visibility-heading"
      >
        {OPTIONS.map((option) => {
          const on = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={saving != null}
              onClick={() => void choose(option.value)}
              className="flex w-full items-start gap-3 border-b border-[#e1dbd7] px-4 py-3 text-left last:border-0"
            >
              <span
                className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${
                  on ? 'border-[#a2033f] bg-[#a2033f]' : 'border-[#857f7a]'
                }`}
                aria-hidden
              />
              <span>
                <span className="block font-semibold text-[#222222]">
                  {option.label}
                  {option.value === 'only_me' ? (
                    <span className="ml-2 rounded-full bg-[#f9e8ee] px-2 py-0.5 text-[11px] font-semibold text-[#a2033f]">
                      Default
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-xs text-[#6e6a68]">{option.helper}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-[#6e6a68]">
        Your location and family are never shown to anyone. Email, phone, and mailing address appear
        only if you turn them on.
      </p>
      <p className="mt-1 text-xs text-[#6e6a68]">{directoryListingNudge(selected)}</p>
      {saving ? <p className="mt-1 text-xs text-[#6e6a68]">Saving…</p> : null}
    </section>
  );
}
