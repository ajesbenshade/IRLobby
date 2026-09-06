import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { PaywallContent } from '../PaywallContent';

describe('PaywallContent', () => {
  it('renders a side-by-side Free vs Plus wall with Fund the servers under the title', () => {
    render(<PaywallContent frame="plusValue" onDismiss={jest.fn()} />);

    expect(screen.getByText('IRLobby Plus')).toBeTruthy();
    expect(screen.getByText('Fund the servers')).toBeTruthy();
    expect(screen.getByText('Free vs Plus')).toBeTruthy();
    expect(screen.getByText('Free')).toBeTruthy();
    expect(screen.getByText('Plus')).toBeTruthy();
    expect(screen.getByText('Monthly · $4.99/mo')).toBeTruthy();
    expect(screen.getByText('Yearly · $39.99/yr')).toBeTruthy();
    expect(screen.queryByText('$0.99')).toBeNull();
  });

  it('renders the swipe-cap sheet as dismissible without a boost SKU', () => {
    const onDismiss = jest.fn();
    render(<PaywallContent frame="swipeCap" onDismiss={onDismiss} />);

    expect(screen.getByText('Keep swiping with Plus')).toBeTruthy();
    expect(screen.getByText('Monthly · $4.99/mo')).toBeTruthy();
    fireEvent.press(screen.getByText('Not now'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders only the $2.99 boost_pack chip on the quiet-night nudge', () => {
    render(<PaywallContent frame="boostNudge" onDismiss={jest.fn()} />);

    expect(screen.getByText('boost_pack · $2.99')).toBeTruthy();
    expect(screen.queryByText('$0.99')).toBeNull();
    expect(screen.queryByText('Monthly · $4.99/mo')).toBeNull();
  });
});
