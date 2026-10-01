import {
  TAB_BAR_CONTENT_GAP,
  TAB_BAR_CONTENT_HEIGHT,
  TAB_BAR_MIN_BOTTOM_OFFSET,
  TAB_BAR_MIN_LABEL_CLEARANCE,
  TAB_ICON_SIZE,
  TAB_LABEL_LINE_HEIGHT,
  TIGHT_CHROME_MAX_FONT_SCALE,
  getSheetBottomPadding,
  getTabBarLayout,
} from '../tabBarLayout';

describe('getTabBarLayout', () => {
  it('gives a home-indicator iPhone a ~50pt bar on top of the 34pt inset (~84pt total)', () => {
    const layout = getTabBarLayout(34, 1);

    expect(layout.height).toBe(TAB_BAR_CONTENT_HEIGHT);
    expect(layout.bottomOffset).toBe(34);
    expect(layout.totalHeight).toBe(84);
  });

  it('keeps the icon + label stack at least 8pt from the bar edges and above the inset', () => {
    const layout = getTabBarLayout(34, 1);
    const stack = TAB_ICON_SIZE + 1 + TAB_LABEL_LINE_HEIGHT;

    expect((layout.height - stack) / 2).toBeGreaterThanOrEqual(TAB_BAR_MIN_LABEL_CLEARANCE);
    // Bar bottom sits on the inset, so the label bottom is >= 8pt above the inset.
    expect(layout.bottomOffset).toBeGreaterThanOrEqual(34);
  });

  it('falls back to a floating offset on devices without a bottom inset', () => {
    const layout = getTabBarLayout(0, 1);

    expect(layout.bottomOffset).toBe(TAB_BAR_MIN_BOTTOM_OFFSET);
    expect(layout.totalHeight).toBe(TAB_BAR_CONTENT_HEIGHT);
  });

  it('derives scroll padding as bar height + bottom offset + 16', () => {
    const layout = getTabBarLayout(34, 1);

    expect(layout.scrollBottomPadding).toBe(layout.height + layout.bottomOffset + TAB_BAR_CONTENT_GAP);
    expect(layout.scrollBottomPadding).toBe(100);
    expect(getTabBarLayout(0, 1).scrollBottomPadding).toBe(50 + 12 + 16);
  });

  it('grows with Dynamic Type so labels are never squeezed', () => {
    const base = getTabBarLayout(34, 1);
    const large = getTabBarLayout(34, TIGHT_CHROME_MAX_FONT_SCALE);

    expect(large.height).toBeGreaterThan(base.height);
    expect(large.scrollBottomPadding).toBe(large.height + large.bottomOffset + TAB_BAR_CONTENT_GAP);
  });

  it('ignores font scales below 1 and negative insets', () => {
    expect(getTabBarLayout(-5, 0.5)).toEqual(getTabBarLayout(0, 1));
  });
});

describe('tab bar vs. capped tab labels', () => {
  it('stops growing at the label cap, because tab labels stop scaling there', () => {
    expect(getTabBarLayout(34, 3)).toEqual(getTabBarLayout(34, TIGHT_CHROME_MAX_FONT_SCALE));
  });
});

describe('getSheetBottomPadding', () => {
  it('adds 16pt of breathing room on top of the real safe-area inset', () => {
    expect(getSheetBottomPadding(34)).toBe(50);
    expect(getSheetBottomPadding(0)).toBe(16);
    expect(getSheetBottomPadding(-4)).toBe(16);
  });
});
