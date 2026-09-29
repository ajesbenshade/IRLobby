import * as WebBrowser from 'expo-web-browser';

export async function openGivingInBrowser(url: string): Promise<void> {
  await WebBrowser.openBrowserAsync(url);
}
