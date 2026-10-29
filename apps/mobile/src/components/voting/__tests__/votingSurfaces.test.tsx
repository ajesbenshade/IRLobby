import { render, screen } from '@testing-library/react-native';

import { VoteAudienceFields } from '@components/voting/VoteAudienceFields';
import { VoteRubric } from '@components/voting/VoteRubric';
import { VOTING_COPY, VOTE_RUBRIC } from '@shared/voting';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));

const circles = [
  { id: 2, name: 'Care Team', isAdmin: false },
  { id: 9, name: 'Elders', isAdmin: true },
];

describe('vote create audience', () => {
  const props = {
    circles,
    selectedIds: [9],
    onChangeSelected: jest.fn(),
    wholeChurch: false,
    onChangeWholeChurch: jest.fn(),
    isChurchAdmin: false,
    circlesStatus: 'ready' as const,
  };

  it('offers circles the person admins and hides whole church', () => {
    render(<VoteAudienceFields {...props} />);
    expect(screen.getAllByText(VOTING_COPY.whoVotes).length).toBeGreaterThan(0);
    expect(screen.getByText('Elders')).toBeTruthy();
    expect(screen.queryByText(VOTING_COPY.wholeChurch)).toBeNull();
    expect(screen.queryByTestId('vote-whole-church')).toBeNull();
    expect(screen.getByText(VOTING_COPY.wholeChurchOff)).toBeTruthy();
  });

  it('shows whole church off for a church admin', () => {
    render(<VoteAudienceFields {...props} isChurchAdmin />);
    expect(screen.getByText(VOTING_COPY.wholeChurch)).toBeTruthy();
    expect(screen.getByTestId('vote-whole-church').props.value).toBe(false);
  });
});

describe('before you post', () => {
  it('starts open, and collapsed after a successful post', () => {
    render(<VoteRubric startCollapsed={false} />);
    expect(screen.getByText(new RegExp(VOTE_RUBRIC[0].title))).toBeTruthy();
    render(<VoteRubric startCollapsed />);
    expect(screen.queryByText(new RegExp(VOTE_RUBRIC[0].title))).toBeNull();
    expect(screen.getByText(VOTING_COPY.rubricTitle)).toBeTruthy();
  });
});
