import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { VIBE_QUESTIONS } from '../questions';
import { VIBE_PILL, VibeOptionCard } from '../VibeQuestionCard';

jest.mock('@lib/haptics', () => ({ safeImpactHaptic: jest.fn() }));

describe('Vibe Quiz answer pills', () => {
  it('has five steps', () => {
    expect(VIBE_QUESTIONS).toHaveLength(5);
  });

  it.each(VIBE_QUESTIONS.map((question) => [question.id, question] as const))(
    'step %s: every option is a full-width pill with 52pt min height, 26 radius and no fixed width',
    (_id, question) => {
      render(
        <>
          {question.options.map((option) => (
            <VibeOptionCard key={option.value} emoji={option.emoji} label={option.label} selected={false} onPress={jest.fn()} />
          ))}
        </>,
      );
      for (const option of question.options) {
        const pill = screen.getByLabelText(option.label);
        const style = StyleSheet.flatten(pill.props.style);
        expect(style.alignSelf).toBe('stretch');
        expect(style.minHeight).toBeGreaterThanOrEqual(52);
        expect(style.borderRadius).toBe(26);
        expect(style.width).toBeUndefined();
        expect(style.backgroundColor).toBe(VIBE_PILL.unselectedFill);
        expect(style.borderColor).toBe(VIBE_PILL.unselectedBorder);
      }
    },
  );

  it('selected is solid burgundy with cream text', () => {
    render(<VibeOptionCard emoji="🔥" label="Cozy" selected onPress={jest.fn()} />);
    const style = StyleSheet.flatten(screen.getByLabelText('Cozy').props.style);
    expect(style.backgroundColor).toBe('#a2033f');
    expect(StyleSheet.flatten(screen.getByText('Cozy').props.style).color).toBe('#f6f1ee');
  });

  it('presses call onPress', () => {
    const onPress = jest.fn();
    render(<VibeOptionCard emoji="🔥" label="Cozy" selected={false} onPress={onPress} />);
    fireEvent.press(screen.getByLabelText('Cozy'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
