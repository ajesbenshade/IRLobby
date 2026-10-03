import React from 'react';
import { Modal } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { MyFamilyScreen } from '../MyFamilyScreen';

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: jest.fn() }) }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('@services/foyerService', () => ({
  fetchFamilyMembers: jest.fn(),
  removeHouseholdChild: jest.fn(),
  addFamilyMember: jest.fn(),
  updateFamilyMember: jest.fn(),
}));

const service = jest.requireMock('@services/foyerService') as Record<string, jest.Mock>;

const members = [
  { id: 1, name: 'Rachel', relationship: 'spouse', sex: 'female', birth_month: null, birth_year: null, birth_day: null, date_of_birth: null },
  { id: 2, name: 'Caleb', relationship: 'child', sex: 'male', birth_month: 6, birth_year: 2011, birth_day: 9, date_of_birth: '2011-06-09' },
  { id: 3, name: 'Noah', relationship: 'child', sex: 'male', birth_month: 3, birth_year: 2016, birth_day: null, date_of_birth: null },
];

const renderScreen = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MyFamilyScreen />
    </QueryClientProvider>,
  );
};

describe('My family', () => {
  beforeEach(() => {
    Object.values(service).forEach((fn) => fn.mockReset());
    service.fetchFamilyMembers.mockResolvedValue(members);
  });

  it('lists name + Born date, Adult for legacy spouse rows, and Born month/year for legacy rows', async () => {
    const view = renderScreen();
    expect(await view.findByText('Born June 9, 2011')).toBeTruthy();
    expect(view.getByText('Born March 2016')).toBeTruthy();
    expect(view.getByText('Adult')).toBeTruthy();
    expect(view.getByText('We only keep names and, for children under 18, birth dates. No photos.')).toBeTruthy();
    expect(view.getByText('Add your children under 18 so you can RSVP for them. Only you can see this list.')).toBeTruthy();
    expect(view.queryByText('Spouse')).toBeNull();
    expect(view.queryByText('Child')).toBeNull();
  });

  it('always offers Add day on a month-only child and Edit details in the row sheet (no capability probe)', async () => {
    const view = renderScreen();
    expect(await view.findByText('Add day')).toBeTruthy();
    expect(view.queryByLabelText('Add day Caleb')).toBeNull();
    fireEvent.press(view.getByTestId('family-row-3'));
    expect(await view.findByText('Edit details')).toBeTruthy();
    expect(service.householdPatchSupported).toBeUndefined();
  });

  it('Add day PATCHes {birth_day} and the row then reads Born March 4, 2016', async () => {
    service.updateFamilyMember.mockResolvedValue(undefined);
    const view = renderScreen();
    fireEvent.press(await view.findByLabelText('Add day Noah'));
    expect(await view.findByText("Add the day to Noah's birthday")).toBeTruthy();
    service.fetchFamilyMembers.mockResolvedValue(
      members.map((member) => (member.id === 3 ? { ...member, birth_day: 4, date_of_birth: '2016-03-04' } : member)),
    );
    fireEvent.press(view.getByLabelText('March 4, 2016'));
    fireEvent.press(view.getAllByLabelText('Confirm').pop() as never);
    await waitFor(() => expect(service.updateFamilyMember).toHaveBeenCalledWith(3, { birth_day: 4 }));
    expect(await view.findByText('Born March 4, 2016')).toBeTruthy();
    expect(view.queryByLabelText('Add day Noah')).toBeNull();
  });

  it('row chevron opens the sheet; Remove from family opens Remove <name>? with Remove and Keep', async () => {
    service.removeHouseholdChild.mockResolvedValue(undefined);
    const view = renderScreen();
    await view.findByText('Born March 2016');
    fireEvent.press(view.getByTestId('family-row-3'));
    await waitFor(() => expect(view.getAllByText('Born March 2016')).toHaveLength(2));
    fireEvent.press(view.getByLabelText('Remove from family'));
    expect(await view.findByText('Remove Noah?')).toBeTruthy();
    expect(view.getByText("He'll be taken off your family list and off any gatherings you've RSVP'd to for him.")).toBeTruthy();
    expect(view.getByLabelText('Keep')).toBeTruthy();
    fireEvent.press(view.getByTestId('family-remove-confirm'));
    await waitFor(() => expect(service.removeHouseholdChild).toHaveBeenCalledWith(3));
  });

  it('empty state with a filled Add family member button', async () => {
    service.fetchFamilyMembers.mockResolvedValue([]);
    const view = renderScreen();
    expect(await view.findByText('No family members yet')).toBeTruthy();
    expect(view.getByText('Add your children so hosts can plan for them.')).toBeTruthy();
    expect(view.getByTestId('family-add')).toBeTruthy();
  });
});

describe('My family: adult / spouse rows and sequential sheet handoff', () => {
  const adult = { id: 5, name: 'Pat', relationship: 'spouse', sex: '', birth_month: null, birth_year: null, birth_day: null, date_of_birth: null, age: null };
  const openModals = (view: ReturnType<typeof renderScreen>) => view.UNSAFE_getAllByType(Modal).filter((modal) => modal.props.visible).length;

  beforeEach(() => {
    Object.values(service).forEach((fn) => fn.mockReset());
    service.fetchFamilyMembers.mockResolvedValue([adult]);
  });

  it('an all-null adult row reads Adult, with no age or birthday text and never "null"', async () => {
    const view = renderScreen();
    expect(await view.findByText('Pat')).toBeTruthy();
    expect(view.getByText('Adult')).toBeTruthy();
    expect(view.queryByText(/null|undefined|Born|age/i)).toBeNull();
    expect(view.queryByLabelText('Add day Pat')).toBeNull();
    fireEvent.press(view.getByTestId('family-row-5'));
    await waitFor(() => expect(view.getAllByText('Adult')).toHaveLength(2));
    expect(view.queryByText(/null|undefined/i)).toBeNull();
  });

  it('Edit details on an adult row closes the row sheet first, then opens Edit (one sheet at a time) without crashing', async () => {
    const view = renderScreen();
    fireEvent.press(await view.findByTestId('family-row-5'));
    await view.findByText('Edit details');
    expect(openModals(view)).toBe(1);
    fireEvent.press(view.getByLabelText('Edit details'));
    // Same render: the row sheet is closing and the Edit sheet has NOT opened yet.
    expect(openModals(view)).toBe(0);
    expect(await view.findByText('Edit family member')).toBeTruthy();
    expect(openModals(view)).toBe(1);
    expect(view.getByDisplayValue('Pat')).toBeTruthy();
    expect(view.queryByTestId('family-birthday-row')).toBeNull();
    expect(view.queryByText(/null|undefined/i)).toBeNull();
  });

  it('Remove on an adult row closes the row sheet first, then opens the confirm, and Remove deletes it', async () => {
    service.removeHouseholdChild.mockResolvedValue(undefined);
    const view = renderScreen();
    fireEvent.press(await view.findByTestId('family-row-5'));
    await view.findByText('Edit details');
    fireEvent.press(view.getByLabelText('Remove from family'));
    expect(openModals(view)).toBe(0);
    expect(await view.findByText('Remove Pat?')).toBeTruthy();
    expect(openModals(view)).toBe(1);
    fireEvent.press(view.getByTestId('family-remove-confirm'));
    await waitFor(() => expect(service.removeHouseholdChild).toHaveBeenCalledWith(5));
  });

  it('Remove from inside the Edit sheet hands off the same way', async () => {
    const view = renderScreen();
    fireEvent.press(await view.findByTestId('family-row-5'));
    await view.findByText('Edit details');
    fireEvent.press(view.getByLabelText('Edit details'));
    await view.findByText('Edit family member');
    fireEvent.press(view.getByLabelText('Remove from family'));
    expect(openModals(view)).toBe(0);
    expect(await view.findByText('Remove Pat?')).toBeTruthy();
  });
});

describe('My family: adults with birth data', () => {
  const dan = { id: 6, name: 'Dan', relationship: 'spouse', sex: 'male', birth_month: 3, birth_year: 1984, birth_day: 9, date_of_birth: '1984-03-09', age: 42 };
  const lee = { id: 7, name: 'Lee', relationship: 'spouse', sex: '', birth_month: 11, birth_year: 1980, birth_day: null, date_of_birth: null, age: null };
  const pat = { id: 8, name: 'Pat', relationship: 'spouse', sex: '', birth_month: null, birth_year: null, birth_day: null, date_of_birth: null, age: null };

  beforeEach(() => {
    Object.values(service).forEach((fn) => fn.mockReset());
    service.fetchFamilyMembers.mockResolvedValue([dan, lee, pat]);
  });

  it('list: Born <date> for adults with birth data (month-only reads Born November 1980), Adult only when all null, no Add day for adults', async () => {
    const view = renderScreen();
    expect(await view.findByText('Born March 9, 1984')).toBeTruthy();
    expect(view.getByText('Born November 1980')).toBeTruthy();
    expect(view.getByText('Adult')).toBeTruthy();
    expect(view.queryByText(/null|undefined/i)).toBeNull();
    expect(view.queryByLabelText('Add day Lee')).toBeNull();
  });

  it('action sheet shows the same line, and Edit on an adult with birth data does not crash or offer birthday editing', async () => {
    const view = renderScreen();
    fireEvent.press(await view.findByTestId('family-row-6'));
    await waitFor(() => expect(view.getAllByText('Born March 9, 1984')).toHaveLength(2));
    fireEvent.press(view.getByLabelText('Edit details'));
    expect(await view.findByText('Edit family member')).toBeTruthy();
    expect(view.getByDisplayValue('Dan')).toBeTruthy();
    expect(view.getByTestId('family-adult-note').props.children).toBe('Born March 9, 1984');
    expect(view.queryByTestId('family-birthday-row')).toBeNull();
    expect(view.queryByText(/null|undefined/i)).toBeNull();
  });
});
