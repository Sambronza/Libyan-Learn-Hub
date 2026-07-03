export interface PushMessage {
  to: string | string[];
  sound?: 'default' | null;
  title?: string;
  body?: string;
  data?: Record<string, any>;
  badge?: number;
}

export async function sendExpoPushNotifications(messages: PushMessage[]) {
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    
    if (!response.ok) {
      console.error('Error sending Expo push notifications:', await response.text());
    }
  } catch (error) {
    console.error('Failed to send push notification:', error);
  }
}
