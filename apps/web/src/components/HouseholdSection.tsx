import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ageInNewYork } from '@/lib/age';
import { apiRequest } from '@/lib/queryClient';
import { useEffect, useState } from 'react';

type Dependent = {
  id: number;
  first_name: string;
  last_name: string;
  birth_date: string;
  sex: string;
};

type HouseholdSectionProps = {
  birthDate?: string;
};

export default function HouseholdSection({ birthDate }: HouseholdSectionProps) {
  const parentAge = ageInNewYork(birthDate);
  const canAdd = parentAge !== null && parentAge >= 18;
  const [children, setChildren] = useState<Dependent[]>([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [childBirthDate, setChildBirthDate] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | ''>('');
  const [error, setError] = useState('');

  const load = async () => {
    const response = await apiRequest('GET', '/api/household/dependents/');
    if (!response.ok) {
      return;
    }
    setChildren((await response.json()) as Dependent[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const addChild = async () => {
    setError('');
    const response = await apiRequest('POST', '/api/household/dependents/', {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      birth_date: childBirthDate,
      sex,
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    setFirstName('');
    setLastName('');
    setChildBirthDate('');
    setSex('');
    await load();
  };

  const removeChild = async (id: number) => {
    setError('');
    const response = await apiRequest('DELETE', `/api/household/dependents/${id}/`);
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await load();
  };

  return (
    <Card className="bg-white shadow-sm">
      <CardContent className="space-y-3 p-4">
        <h3 className="font-semibold text-[#222222]">Household children</h3>
        <p className="text-sm text-[#5c534f]">
          A parent who is 18 or older can add children under 18 and include them when RSVPing. A 13–17 year old with their own account is not also stored as a dependent.
        </p>
        {!canAdd ? (
          <p className="text-sm text-[#222222]">
            Add your own birth date first. Only a parent who is 18 or older can add children.
          </p>
        ) : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <ul className="space-y-2">
          {children.map((child) => (
            <li key={child.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {child.first_name} {child.last_name} · {child.birth_date} · {child.sex}
              </span>
              <Button type="button" variant="outline" onClick={() => void removeChild(child.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
        {canAdd ? (
          <div className="grid gap-2">
            <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="First name" />
            <Input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Last name" />
            <Input type="date" value={childBirthDate} onChange={(event) => setChildBirthDate(event.target.value)} aria-label="Child birth date" />
            <div className="flex gap-2">
              <Button type="button" variant={sex === 'male' ? 'default' : 'outline'} onClick={() => setSex('male')}>
                Male
              </Button>
              <Button type="button" variant={sex === 'female' ? 'default' : 'outline'} onClick={() => setSex('female')}>
                Female
              </Button>
            </div>
            <Button type="button" onClick={() => void addChild()} disabled={!firstName.trim() || !childBirthDate || !sex}>
              Add child
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
