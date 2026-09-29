import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/queryClient';
import { useEffect, useState } from 'react';

type HouseholdChild = {
  id: number;
  first_name: string;
  last_name: string;
};

type FoyerGoingPanelProps = {
  activity: { id: number | string; title: string; host_kind?: string; gift_notice?: string; donation_enabled?: boolean };
  onDone: () => void;
  onClose: () => void;
};

export default function FoyerGoingPanel({ activity, onDone, onClose }: FoyerGoingPanelProps) {
  const [includeSelf, setIncludeSelf] = useState(true);
  const [children, setChildren] = useState<HouseholdChild[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [step, setStep] = useState<'who' | 'give' | 'next'>('who');
  const [amount, setAmount] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await apiRequest('GET', '/api/household/dependents/');
      if (!response.ok || cancelled) {
        return;
      }
      const body = (await response.json()) as HouseholdChild[];
      if (!cancelled) {
        setChildren(body);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activity.id]);

  const rsvp = async () => {
    setError('');
    const response = await apiRequest('POST', `/api/activities/${activity.id}/rsvp/`, {
      include_self: includeSelf,
      dependent_ids: selected,
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    const body = await response.json();
    setNotice(body.gift_notice || '');
    setAmount(body.suggested_donation && body.suggested_donation !== '0.00' ? body.suggested_donation : '');
    setStep(body.donation_enabled ? 'give' : 'next');
  };

  const give = async () => {
    const response = await apiRequest('POST', `/api/activities/${activity.id}/give/`, { amount });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    const body = await response.json();
    if (body.url) {
      window.location.href = body.url;
    }
    setStep('next');
  };

  const giftNotice =
    notice ||
    activity.gift_notice ||
    (activity.host_kind === 'church'
      ? 'A gift on this event goes to Franconia Mennonite Church. Stripe’s card fee still applies. The Foyer does not take a cut.'
      : 'A gift to this host is a contribution to that person, not a tax-deductible church gift. Stripe’s card fee still applies. The Foyer does not take a cut.');

  return (
    <div className="fixed inset-x-4 bottom-24 z-50 rounded-2xl border border-[#eadfd9] bg-white p-4 shadow-xl">
      <p className="text-xs text-[#a2033f]">Franconia Mennonite Church</p>
      <h2 className="font-display text-2xl text-[#222222]">
        {step === 'who' ? 'Who is coming?' : step === 'give' ? 'Optional gift' : 'You’re in'}
      </h2>
      <p className="mb-3 text-sm text-[#5c534f]">{activity.title}</p>
      {error ? <p className="mb-2 text-sm text-red-700">{error}</p> : null}
      {step === 'who' ? (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={includeSelf} onChange={(event) => setIncludeSelf(event.target.checked)} />
            Me
          </label>
          {children.map((child) => (
            <label key={child.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(child.id)}
                onChange={() =>
                  setSelected((current) =>
                    current.includes(child.id)
                      ? current.filter((id) => id !== child.id)
                      : [...current, child.id],
                  )
                }
              />
              {child.first_name} {child.last_name}
            </label>
          ))}
          <p className="text-xs text-[#5c534f]">
            Add children under 18 from your profile. A 13–17 year old with their own account is not listed here.
          </p>
          <Button type="button" onClick={() => void rsvp()}>
            I&apos;m going
          </Button>
        </div>
      ) : null}
      {step === 'give' ? (
        <div className="space-y-3">
          <p className="text-sm text-[#222222]">{giftNotice}</p>
          <Input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount" />
          <div className="flex gap-2">
            <Button type="button" onClick={() => void give()}>
              Give
            </Button>
            <Button type="button" variant="outline" onClick={() => setStep('next')}>
              Skip
            </Button>
          </div>
        </div>
      ) : null}
      {step === 'next' ? (
        <div className="space-y-3">
          <p className="text-sm">Photos and chat are open now that you&apos;re counted as going.</p>
          <Button type="button" onClick={onDone}>
            Open chat
          </Button>
        </div>
      ) : null}
      <Button type="button" variant="ghost" className="mt-2" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}
