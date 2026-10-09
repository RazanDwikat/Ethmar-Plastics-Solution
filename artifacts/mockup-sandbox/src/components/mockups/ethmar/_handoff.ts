import type { Configuration } from './_data';

export type Snapshot = { profileName: string; config: Configuration; revision: number };
let current: Snapshot | null = null;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== 'undefined') channel = new BroadcastChannel('ethmar-saved-definitions-v1');
} catch { /* Browser policy may disable same-origin channels. UI reports this. */ }
export const handoffAvailable = channel !== null;
export const cloneConfiguration = (config: Configuration): Configuration => ({
  ...config, mapping: { ...config.mapping }, events: { ...config.events },
  customFields: (config.customFields ?? []).map(field => ({ ...field })),
});
const notify = () => listeners.forEach(listener => listener());
if (channel) channel.onmessage = ({ data }) => {
  if (data?.type === 'request' && current) channel?.postMessage({ type: 'snapshot', snapshot: current });
  if (data?.type === 'snapshot' && data.snapshot?.config && Array.isArray(data.snapshot.config.customFields)) {
    const incoming = data.snapshot as Snapshot;
    if (!current || incoming.revision > current.revision) {
      current = { ...incoming, config: cloneConfiguration(incoming.config) };
      notify();
    }
  }
};
export function publishConfiguration(profileName: string, config: Configuration) {
  current = { profileName, config: cloneConfiguration(config), revision: Math.max(Date.now(), (current?.revision ?? 0) + 1) };
  notify();
  channel?.postMessage({ type: 'snapshot', snapshot: current });
}
export function subscribeConfiguration(listener: () => void) {
  listeners.add(listener);
  channel?.postMessage({ type: 'request' });
  return () => { listeners.delete(listener); };
}
export const getConfigurationSnapshot = () => current;
