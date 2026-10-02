import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { PHOTO_BAR_HEIGHT, PhotoBottomBar, photoScrollPadding, photoToastBottom } from '../PhotoBottomBar';

const base = {
  selecting: false,
  entitled: true,
  photoCount: 12,
  selectedCount: 0,
  downloading: false,
  bottomInset: 34,
  onBack: jest.fn(),
  onDownloadAll: jest.fn(),
  onSelect: jest.fn(),
  onCancel: jest.fn(),
  onDownloadSelected: jest.fn(),
  onSelectAll: jest.fn(),
};

const styleOf = (node: { props: { style: unknown } }) => StyleSheet.flatten(node.props.style as never);

describe('Photos bottom bar', () => {
  beforeEach(() => jest.clearAllMocks());

  it('default: Back, Download all, Select are equal 48pt outlined stadium pills (white fill, thin ink outline)', () => {
    const view = render(<PhotoBottomBar {...base} />);
    for (const id of ['photo-back', 'photo-download-all', 'photo-select']) {
      const style = styleOf(view.getByTestId(id));
      expect(style).toMatchObject({ flex: 1, height: 48, borderRadius: 24, borderWidth: 1, backgroundColor: '#ffffff', borderColor: '#222222' });
    }
    expect(styleOf(view.getByText('Back')).color).toBe('#222222');
    fireEvent.press(view.getByTestId('photo-back'));
    fireEvent.press(view.getByTestId('photo-download-all'));
    fireEvent.press(view.getByTestId('photo-select'));
    expect(base.onBack).toHaveBeenCalled();
    expect(base.onDownloadAll).toHaveBeenCalled();
    expect(base.onSelect).toHaveBeenCalled();
  });

  it('sits above the home indicator: bottom padding = inset + 12', () => {
    const view = render(<PhotoBottomBar {...base} bottomInset={34} />);
    const bar = styleOf(view.getByTestId('photo-bottom-bar'));
    expect(bar.paddingBottom).toBe(34 + 12);
    expect(bar.paddingTop).toBe(12);
    expect(PHOTO_BAR_HEIGHT).toBe(72);
    expect(photoScrollPadding(34)).toBe(72 + 34 + 16);
    expect(photoToastBottom(34)).toBe(72 + 34 + 12);
  });

  it('no photos: Download all and Select are disabled (grey outline and label), Back stays enabled', () => {
    const view = render(<PhotoBottomBar {...base} photoCount={0} />);
    expect(view.getByTestId('photo-back').props.accessibilityState.disabled).toBe(false);
    for (const id of ['photo-download-all', 'photo-select']) {
      expect(view.getByTestId(id).props.accessibilityState.disabled).toBe(true);
      expect(styleOf(view.getByTestId(id)).borderColor).toBe('#c9c4c1');
    }
    expect(styleOf(view.getByText('Select')).color).toBe('#96918e');
  });

  it('select mode: Cancel, filled burgundy Download (3) with white text, Select all', () => {
    const view = render(<PhotoBottomBar {...base} selecting selectedCount={3} />);
    const download = view.getByTestId('photo-download-selected');
    expect(styleOf(download).backgroundColor).toBe('#a2033f');
    expect(styleOf(view.getByText('Download (3)')).color).toBe('#ffffff');
    expect(view.getByText('Cancel')).toBeTruthy();
    expect(view.getByText('Select all')).toBeTruthy();
    fireEvent.press(download);
    expect(base.onDownloadSelected).toHaveBeenCalled();
    fireEvent.press(view.getByTestId('photo-select-all'));
    expect(base.onSelectAll).toHaveBeenCalled();
  });

  it('select mode with nothing selected: Download (0) is disabled grey, never white on grey', () => {
    const view = render(<PhotoBottomBar {...base} selecting selectedCount={0} />);
    expect(view.getByTestId('photo-download-selected').props.accessibilityState.disabled).toBe(true);
    expect(styleOf(view.getByTestId('photo-download-selected')).backgroundColor).toBe('#e1dbd7');
    expect(styleOf(view.getByText('Download (0)')).color).toBe('#7a7572');
  });

  it('downloading: Downloading… at 12pt with a spinner; Back and Select disabled', () => {
    const view = render(<PhotoBottomBar {...base} downloading />);
    expect(styleOf(view.getByText('Downloading…')).fontSize).toBe(12);
    expect(view.getByTestId('photo-back').props.accessibilityState.disabled).toBe(true);
    expect(view.getByTestId('photo-select').props.accessibilityState.disabled).toBe(true);
    expect(view.getByTestId('photo-download-all').props.accessibilityState.busy).toBe(true);
  });

  it('pressed: the pill goes cream, outline unchanged', () => {
    const view = render(<PhotoBottomBar {...base} />);
    fireEvent(view.getByTestId('photo-download-all'), 'pressIn');
    expect(styleOf(view.getByTestId('photo-download-all'))).toMatchObject({ backgroundColor: '#f6f1ee', borderColor: '#222222' });
  });

  it('someone who cannot download only gets Back', () => {
    const view = render(<PhotoBottomBar {...base} entitled={false} />);
    expect(view.getByTestId('photo-back')).toBeTruthy();
    expect(view.queryByTestId('photo-download-all')).toBeNull();
    expect(view.queryByTestId('photo-select')).toBeNull();
  });
});
