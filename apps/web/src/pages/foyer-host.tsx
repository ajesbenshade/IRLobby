import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { CALENDAR_ADDRESS_WARNING, FEE_NOTE, compressImageFile, parseCapacity } from '@/lib/foyer';
import { apiRequest } from '@/lib/queryClient';

export default function FoyerHostPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const admin = Boolean(user?.isChurchAdmin);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [place, setPlace] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [capacity, setCapacity] = useState('');
  const [audience, setAudience] = useState<'everyone' | 'men' | 'women'>('everyone');
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [calendar, setCalendar] = useState(false);
  const [gifts, setGifts] = useState(false);
  const [suggested, setSuggested] = useState('10');
  const [hostAsChurch, setHostAsChurch] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    const parsed = parseCapacity(capacity);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await apiRequest('POST', '/api/activities/', {
        title: title.trim(),
        description: description.trim(),
        location: place.trim(),
        latitude: 0,
        longitude: 0,
        time: start.trim(),
        end_time: end.trim() || undefined,
        capacity: parsed.capacity,
        audience_gender: audience,
        age_min: ageMin.trim() ? Number(ageMin) : null,
        age_max: ageMax.trim() ? Number(ageMax) : null,
        list_on_church_calendar: calendar,
        donation_enabled: gifts,
        suggested_donation: gifts ? Number(suggested).toFixed(2) : null,
        host_kind: hostAsChurch ? 'church' : 'person',
      });
      const saved = (await response.json()) as { id: number | string };
      if (photo) {
        const blob = await compressImageFile(photo);
        const body = new FormData();
        body.append('image', blob, 'cover.jpg');
        await fetch(`/api/activities/${saved.id}/photos/`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('authToken') ?? ''}` },
          body,
        });
      }
      navigate('/app/gatherings');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to post this gathering.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-[#f6f1ee] px-5 pb-28 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <button type="button" className="text-[#a2033f]" onClick={() => navigate(-1)}>
          Cancel
        </button>
        <h1 className="text-[17px] font-semibold">Host a gathering</h1>
        <button type="button" className="font-semibold text-[#a2033f]" onClick={() => void submit()}>
          Post
        </button>
      </div>
      <label className="mb-4 flex h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#e1dbd7] bg-white text-center">
        <span className="font-semibold text-[#a2033f]">Add a cover photo</span>
        <span className="text-sm text-[#6e6a68]">Choose from library or take a photo</span>
        <input
          aria-label="Cover photo"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
        />
        {photo ? <span className="mt-2 text-xs">{photo.name}</span> : null}
      </label>
      <Field label="Title" value={title} onChange={setTitle} />
      <Field label="Description" value={description} onChange={setDescription} multiline />
      <Field label="Place" value={place} onChange={setPlace} />
      <Field label="Date & time" value={start} onChange={setStart} placeholder="Sat, Oct 17, 2026 9:30 AM" />
      <Field label="Ends" value={end} onChange={setEnd} placeholder="11:00 AM" />
      <Field label="Capacity" value={capacity} onChange={setCapacity} placeholder="No limit" />
      <p className="mb-4 text-xs text-[#6e6a68]">Leave blank for no limit. Up to 500.</p>
      <p className="mb-2 text-sm font-semibold">Audience</p>
      <div className="mb-4 flex gap-2">
        {(['everyone', 'men', 'women'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`rounded-full px-4 py-2 text-sm ${audience === value ? 'bg-[#a2033f] text-white' : 'bg-white'}`}
            onClick={() => setAudience(value)}
          >
            {value === 'everyone' ? 'Everyone' : value === 'men' ? 'Men' : 'Women'}
          </button>
        ))}
      </div>
      <p className="mb-2 text-sm font-semibold">Age range</p>
      <div className="mb-2 flex gap-2">
        <input aria-label="Min" placeholder="Min" className="w-full rounded-xl border border-[#e1dbd7] px-3 py-3" value={ageMin} onChange={(event) => setAgeMin(event.target.value)} />
        <input aria-label="Max" placeholder="Any" className="w-full rounded-xl border border-[#e1dbd7] px-3 py-3" value={ageMax} onChange={(event) => setAgeMax(event.target.value)} />
      </div>
      <p className="mb-4 text-xs text-[#6e6a68]">Leave max blank for no upper limit. Children in a household can be added if they fit the range.</p>
      <label className="mb-2 flex items-center gap-2 font-semibold">
        <input type="checkbox" checked={calendar} onChange={(event) => setCalendar(event.target.checked)} />
        Post to the church website calendar
      </label>
      <p className="mb-4 rounded-xl bg-[#fdf3e6] p-3 text-sm text-[#8a540a]">{CALENDAR_ADDRESS_WARNING}</p>
      <label className="mb-2 flex items-center gap-2 font-semibold">
        <input type="checkbox" checked={gifts} onChange={(event) => setGifts(event.target.checked)} />
        Accept gifts
      </label>
      {gifts ? (
        <>
          <p className="mb-2 text-sm text-[#6e6a68]">After someone RSVPs, they can choose to chip in. Gifts open in Safari.</p>
          <Field label="Suggested amount" value={suggested} onChange={setSuggested} />
          <p className="mb-4 text-sm text-[#6e6a68]">{FEE_NOTE}</p>
        </>
      ) : null}
      {admin ? (
        <div className="mb-4 rounded-2xl border border-[#e1dbd7] bg-white p-4">
          <p className="text-xs font-bold text-[#6e6a68]">Admin only</p>
          <label className="mt-2 flex items-center justify-between gap-3 font-semibold">
            Host as Franconia Mennonite Church
            <input type="checkbox" checked={hostAsChurch} onChange={(event) => setHostAsChurch(event.target.checked)} />
          </label>
          <p className="mt-1 text-sm text-[#6e6a68]">The church is shown as host and gifts go to the church.</p>
        </div>
      ) : null}
      {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
      <Button className="h-[54px] w-full rounded-full" disabled={pending || !title.trim()} onClick={() => void submit()}>
        Post gathering
      </Button>
      <p className="mt-3 text-center text-sm text-[#6e6a68]">Chat opens for people who are going.</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const className = 'mb-3 w-full rounded-xl border border-[#e1dbd7] bg-white px-3 py-3';
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {multiline ? (
        <textarea aria-label={label} className={className} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input aria-label={label} className={className} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}
