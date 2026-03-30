import type { PendingNotification } from './game';

export const NOTIF_HUNGER = 'rotagotchi-hunger';
export const NOTIF_SATIATED = 'rotagotchi-satiated';


export async function fireNotification(notification: PendingNotification): Promise<void> {
  const iconUrl = notification.type === 'hunger'
    ? chrome.runtime.getURL('dist/icon-hunger.png')
    : chrome.runtime.getURL('dist/icon-satiated.png');

  await chrome.notifications.create(notification.id, {
    type: 'basic',
    iconUrl,
    title: notification.title,
    message: notification.message,
    priority: notification.type === 'hunger' ? 2 : 1,
  });
}
