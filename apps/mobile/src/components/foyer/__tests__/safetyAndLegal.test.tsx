import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { collapseBlockedMessages } from '@foyer/gatheringChat';
import { GATHERING_CHAT_COPY } from '@constants/foyerCopy';
import { StyleSheet } from 'react-native';
import { LegalConsentText } from '../LegalConsentText';
import { LegalWebViewSheet } from '../LegalWebViewSheet';
import { ReportSheet } from '../SafetySheets';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));

describe('ReportSheet', () => {
  it('disables Submit until a reason is picked, then shows the Report sent confirmation', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onSent = jest.fn();
    render(<ReportSheet visible name="Maria" onClose={jest.fn()} onSubmit={onSubmit} onSent={onSent} />);
    expect(screen.getByText("Tell the church admins what's wrong. Maria won't be told.")).toBeTruthy();
    expect(screen.queryByText('Something urgent? Contact the church admins.')).toBeNull();
    expect(screen.queryByTestId('report-admin-contact')).toBeNull();
    fireEvent.press(screen.getByLabelText('Spam or a fake account'));
    fireEvent.press(screen.getByLabelText('Submit report'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ reason: 'spam', description: undefined }));
    expect(await screen.findByText('Report sent')).toBeTruthy();
    expect(screen.getByText('The church admins will take a look. Thank you for helping keep The Foyer kind.')).toBeTruthy();
    expect(onSent).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('report-sent-done'));
    expect(onSent).toHaveBeenCalledTimes(1);
  });

  it('uses the photo lead line when given', () => {
    render(<ReportSheet visible name="x" title="Report photo" lead="The person who added it won't be told." onClose={jest.fn()} onSubmit={jest.fn()} onSent={jest.fn()} />);
    expect(screen.getByText('Report photo')).toBeTruthy();
    expect(screen.getByText("The person who added it won't be told.")).toBeTruthy();
  });
});

describe('blocked messages in gathering chat', () => {
  const msg = (id: number, userId: number, firstName: string) => ({
    kind: 'message' as const,
    key: `m-${id}`,
    message: { userId, user: { id: userId, firstName } },
  });

  it('collapses consecutive messages from a blocked person into one line', () => {
    const items = collapseBlockedMessages(
      [msg(1, 5, 'Maria'), msg(2, 5, 'Maria'), msg(3, 6, 'Sam'), msg(4, 5, 'Maria')],
      new Set(['5']),
    );
    expect(items.map((item) => item.kind)).toEqual(['blocked', 'message', 'blocked']);
    expect(GATHERING_CHAT_COPY.blockedLine('Maria')).toBe('You blocked Maria. Their messages are hidden.');
  });

  it('changes nothing when nobody is blocked', () => {
    const items = [msg(1, 5, 'Maria')];
    expect(collapseBlockedMessages(items, new Set())).toEqual(items);
  });
});

describe('LegalWebViewSheet', () => {
  it('shows the title, host line and loading state for an https page', () => {
    render(<LegalWebViewSheet visible title="Terms of Use" url="https://irlobby.com/terms-of-service" onClose={jest.fn()} />);
    expect(screen.getByText('Terms of Use')).toBeTruthy();
    expect(screen.getByText('irlobby.com')).toBeTruthy();
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('shows the failed state for a non-https link and closes with Done', () => {
    const onClose = jest.fn();
    render(<LegalWebViewSheet visible title="Privacy Policy" url="http://insecure.example/p" onClose={onClose} />);
    expect(screen.getByText("Couldn't load this page.")).toBeTruthy();
    expect(screen.getByText('Check your connection and try again.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('legal-done'));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('LegalConsentText', () => {
  it('reads "I agree to the Terms of Use and Privacy Policy." with burgundy underlined links that open the sheet', () => {
    const onOpen = jest.fn();
    const { toJSON } = render(
      <LegalConsentText termsUrl="https://irlobby.com/terms" privacyUrl="https://irlobby.com/privacy" onOpen={onOpen} />,
    );
    expect(JSON.stringify(toJSON())).toContain('I agree to the ');
    const terms = screen.getByText('Terms of Use');
    const style = StyleSheet.flatten(terms.props.style);
    expect(style.color).toBe('#a2033f');
    expect(style.textDecorationLine).toBe('underline');
    fireEvent.press(terms);
    expect(onOpen).toHaveBeenCalledWith('https://irlobby.com/terms', 'Terms of Use');
    fireEvent.press(screen.getByText('Privacy Policy'));
    expect(onOpen).toHaveBeenCalledWith('https://irlobby.com/privacy', 'Privacy Policy');
  });

  it('draws a name as plain text when its URL is null', () => {
    const onOpen = jest.fn();
    render(<LegalConsentText termsUrl={null} privacyUrl="https://irlobby.com/privacy" onOpen={onOpen} />);
    expect(screen.queryByText('Terms of Use')).toBeNull(); // not its own link element
    expect(screen.getAllByRole('link')).toHaveLength(1);
    fireEvent.press(screen.getByText('Privacy Policy'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
