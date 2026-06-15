import { Alert, Linking } from 'react-native';

/** Canonical public legal URLs (GitHub Pages). Single-sourced — consumed by
 *  LegalLinksRow and the settings footer. */
export const TERMS_URL = 'https://soul2fade.github.io/moodrx/terms.html';
export const PRIVACY_URL = 'https://soul2fade.github.io/moodrx/privacy-policy.html';

/** Open an external URL, alerting the user if no handler is available. */
export function openExternal(url: string): void {
  void Linking.openURL(url).catch(() =>
    Alert.alert('Could not open link', 'Visit soul2fade.github.io/moodrx in your browser.'),
  );
}
