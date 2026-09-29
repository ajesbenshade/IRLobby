import { openGivingInBrowser } from '../giving';

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn().mockResolvedValue({ type: 'dismiss' }),
}));

const { openBrowserAsync } = jest.requireMock('expo-web-browser') as {
  openBrowserAsync: jest.Mock;
};

describe('giving opens the browser', () => {
  it('opens the Stripe checkout URL with expo-web-browser', async () => {
    const url = 'https://checkout.stripe.com/c/pay/cs_test';
    await openGivingInBrowser(url);
    expect(openBrowserAsync).toHaveBeenCalledWith(url);
  });
});
