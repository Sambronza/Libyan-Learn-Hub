import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const existingStatus: any = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus.granted ? 'granted' : 'undetermined';
    if (!existingStatus.granted) {
      const status: any = await Notifications.requestPermissionsAsync();
      finalStatus = status.granted ? 'granted' : 'undetermined';
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    
    // Get project ID
    const projectId = Constants.expoConfig?.extra?.eas?.projectId 
      ?? Constants.easConfig?.projectId;
      
    try {
      token = (await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      })).data;
      console.log('Push token:', token);
    } catch (e) {
      console.error(e);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}
