import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';

type Child = { id: number; name: string; date_of_birth: string; age: number };

const bornLine = (iso: string, age: number) => {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return `Born ${iso} · age ${age}`;
  return `Born ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · age ${age}`;
};

export default function HouseholdPage() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const children = useQuery({
    queryKey: ['foyer-household'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users/household/');
      const data = (await response.json()) as { children?: Child[] };
      return data.children ?? [];
    },
  });
  const addChild = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/users/household/', { name: name.trim(), date_of_birth: birthDate.trim() });
    },
    onSuccess: async () => {
      setName('');
      setBirthDate('');
      setAdding(false);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['foyer-household'] });
    },
    onError: (addError) => setError(addError instanceof Error ? addError.message : 'Unable to add this child.'),
  });
  const removeChild = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/users/household/${id}/`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['foyer-household'] });
    },
  });

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-[#f6f1ee] px-5 pb-28 pt-6">
      <Link to="/app/profile" className="font-semibold text-[#a2033f]">
        Profile
      </Link>
      <h1 className="mt-2 text-center text-[17px] font-semibold">Household</h1>
      <p className="mt-4 text-[15px] leading-6">
        Add children under 18 so you can RSVP for them. Only you can see this list.
      </p>
      <p className="mt-4 text-xs font-bold tracking-wide text-[#6e6a68]">CHILDREN UNDER 18</p>
      <div className="mt-2 overflow-hidden rounded-2xl bg-white">
        {(children.data ?? []).map((child) => (
          <div key={child.id} className="flex items-center gap-3 border-b border-[#e1dbd7] p-3 last:border-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f9e8ee] text-xs font-semibold text-[#a2033f]">
              {child.name.replace(/\s+/g, '').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-semibold">{child.name}</p>
              <p className="text-sm text-[#6e6a68]">{bornLine(child.date_of_birth, child.age)}</p>
            </div>
            <button type="button" className="font-semibold text-[#a2033f]" onClick={() => removeChild.mutate(child.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>
      {adding ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            addChild.mutate();
          }}
        >
          <input aria-label="Child name" className="w-full rounded-xl border border-[#e1dbd7] px-3 py-3" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
          <input aria-label="Child birth date" className="w-full rounded-xl border border-[#e1dbd7] px-3 py-3" placeholder="YYYY-MM-DD" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <Button className="h-[54px] w-full rounded-full" disabled={!name.trim() || !birthDate.trim()}>
            Save child
          </Button>
        </form>
      ) : (
        <button type="button" className="mt-4 h-[54px] w-full rounded-full border-2 border-[#a2033f] font-semibold text-[#a2033f]" onClick={() => setAdding(true)}>
          + Add child
        </button>
      )}
      <div className="mt-6 rounded-2xl bg-[#f9e8ee] p-4">
        <p className="font-semibold text-[#a2033f]">Teens 13 and older</p>
        <p className="mt-1 text-sm">
          Teens can have their own account instead of being listed here. They RSVP for themselves and join chats on their own.
        </p>
      </div>
      <p className="mt-4 text-sm text-[#6e6a68]">Birth dates are used only to check age ranges on events.</p>
    </div>
  );
}
