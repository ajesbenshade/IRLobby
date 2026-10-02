import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { MyFamilyScreen } from '../MyFamilyScreen';

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: jest.fn() }) }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('@services/foyerService', () => ({
  fetchFamilyMembers: jest.fn(),
  householdPatchSupported: jest.fn(),
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
    service.householdPatchSupported.mockResolvedValue(false);
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

  it('hides Add day and Edit details until the PATCH endpoint exists', async () => {
    const view = renderScreen();
    await view.findByText('Born March 2016');
    await waitFor(() => expect(service.householdPatchSupported).toHaveBeenCalled());
    expect(view.queryByText('Add day')).toBeNull();
    fireEvent.press(view.getByTestId('family-row-3'));
    expect(await view.findByText('Remove from family')).toBeTruthy();
    expect(view.queryByText('Edit details')).toBeNull();
  });

  it('shows Add day and Edit details once PATCH is allowed (404-tolerant probe says yes)', async () => {
    service.householdPatchSupported.mockResolvedValue(true);
    service.updateFamilyMember.mockResolvedValue(undefined);
    const view = renderScreen();
    expect(await view.findByText('Add day')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Add day Noah'));
    expect(await view.findByText("Add the day to Noah's birthday")).toBeTruthy();
    fireEvent.press(view.getByLabelText('March 4, 2016'));
    fireEvent.press(view.getAllByLabelText('Confirm').pop() as never);
    await waitFor(() => expect(service.updateFamilyMember).toHaveBeenCalledWith(3, { date_of_birth: '2016-03-04' }));

    fireEvent.press(view.getByTestId('family-row-2'));
    expect(await view.findByText('Edit details')).toBeTruthy();
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
