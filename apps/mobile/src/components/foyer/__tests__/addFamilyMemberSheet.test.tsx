import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { FAMILY_COPY } from '@constants/foyerCopy';
import { FAMILY_RELATIONSHIP_CHOICES } from '@foyer/family';
import { AddFamilyMemberSheet } from '../AddFamilyMemberSheet';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('@services/foyerService', () => ({ addFamilyMember: jest.fn() }));

const { addFamilyMember } = jest.requireMock('@services/foyerService') as { addFamilyMember: jest.Mock };

describe('Add family member sheet', () => {
  beforeEach(() => addFamilyMember.mockReset());

  it('offers only Spouse and Child (the backend accepts nothing else)', () => {
    render(<AddFamilyMemberSheet visible onCancel={jest.fn()} onAdded={jest.fn()} />);
    expect(screen.getByLabelText('Spouse')).toBeTruthy();
    expect(screen.getByLabelText('Child')).toBeTruthy();
    expect(screen.queryByLabelText('Parent')).toBeNull();
    expect(screen.queryByLabelText('Other')).toBeNull();
    expect(screen.getAllByRole('radio').filter((node) => ['Spouse', 'Child', 'Parent', 'Other'].includes(String(node.props.accessibilityLabel)))).toHaveLength(2);
    expect(FAMILY_RELATIONSHIP_CHOICES).toEqual(['spouse', 'child']);
    expect(Object.keys(FAMILY_COPY.relationships)).toEqual(['spouse', 'child']);
  });

  it('adds a spouse with just name + sex', async () => {
    addFamilyMember.mockResolvedValue(undefined);
    const onAdded = jest.fn();
    render(<AddFamilyMemberSheet visible onCancel={jest.fn()} onAdded={onAdded} />);
    fireEvent.changeText(screen.getByLabelText(FAMILY_COPY.name), 'Rachel');
    fireEvent.press(screen.getByLabelText('Spouse'));
    fireEvent.press(screen.getByLabelText('Female'));
    fireEvent.press(screen.getByLabelText(FAMILY_COPY.addCta));
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(addFamilyMember).toHaveBeenCalledWith(expect.objectContaining({ name: 'Rachel', relationship: 'spouse', sex: 'female' }));
  });

  it('disables Spouse once the household has one', () => {
    render(<AddFamilyMemberSheet visible hasSpouse onCancel={jest.fn()} onAdded={jest.fn()} />);
    expect(screen.getByLabelText('Spouse').props.accessibilityState.disabled).toBe(true);
  });
});
