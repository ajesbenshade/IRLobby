import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { AuthSignInToast } from '../AuthSignInToast';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 12, left: 0, right: 0 }),
}));

describe('AuthSignInToast', () => {
  it('renders the frame copy and Try again action', () => {
    const onAction = jest.fn();
    render(
      <AuthSignInToast
        visible
        title="Couldn't finish sign-in."
        body="Try again."
        actionLabel="Try again"
        onAction={onAction}
      />,
    );

    expect(screen.getByText("Couldn't finish sign-in.")).toBeTruthy();
    expect(screen.getByLabelText("Couldn't finish sign-in. Try again.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Try again'));
    expect(onAction).toHaveBeenCalled();
  });

  it('hides when not visible', () => {
    render(
      <AuthSignInToast
        visible={false}
        title="Couldn't finish sign-in."
        body="Try again."
        actionLabel="Try again"
        onAction={() => undefined}
      />,
    );

    expect(screen.queryByText("Couldn't finish sign-in.")).toBeNull();
  });
});
