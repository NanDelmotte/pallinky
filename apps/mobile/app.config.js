const APP_VARIANT = process.env.APP_VARIANT ?? 'production';

const IS_DEV = APP_VARIANT === 'development';

const APP = {
  development: {
    name: 'Pallinky Dev',
    scheme: 'pallinky-dev',
    icon: './assets/icon-dev.png',
    androidIcon: './assets/android-dev.png',
  androidBackgroundColor: '#FE019A',
    iosBundleIdentifier: 'com.nancy.pallinky.dev',
    androidPackage: 'com.nancy.pallinky.dev',
    updatesChannel: 'development',
    iosBuildNumber: '1',
    androidVersionCode: 1,
  },
  production: {
    name: 'Pallinky',
    scheme: 'pallinky',
    icon: './assets/icon.png',
    androidIcon: './assets/android-prod.png',
  androidBackgroundColor: '#46C34C',     
    iosBundleIdentifier: 'com.nancy.pallinky',
    androidPackage: 'com.nancy.pallinky',
    updatesChannel: 'production',
  
  },
};

const CURRENT_APP = IS_DEV ? APP.development : APP.production;

export default {
  expo: {
    name: CURRENT_APP.name,
    slug: 'tarti-flette',
    scheme: CURRENT_APP.scheme,
    version: '1.1.3',
    orientation: 'portrait',
    icon: CURRENT_APP.icon,
    userInterfaceStyle: 'light',

    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },

    assetBundlePatterns: ['**/*'],

    ios: {
      supportsTablet: true,
      bundleIdentifier: CURRENT_APP.iosBundleIdentifier,
      buildNumber: CURRENT_APP.iosBuildNumber,
      associatedDomains: ['applinks:pallinky.com'],
      infoPlist: {
        NSCalendarsFullAccessUsageDescription:
          'Pallinky uses your calendar so you can add an event to your schedule after you create or join a plan.',
        NSCalendarsUsageDescription:
          'Pallinky uses your calendar so you can add an event to your schedule after you create or join a plan.',
        NSCameraUsageDescription:
          'Pallinky uses your camera so you can take a profile photo.',
        NSLocationWhenInUseUsageDescription:
          'Pallinky uses your location while you use the app to suggest nearby venues and help you choose an address for your plan.',
        NSContactsUsageDescription:
          'Pallinky uses your contacts to help you quickly invite friends to your events.',
        NSPhotoLibraryUsageDescription:
          'Pallinky uses your photo library so you can choose a profile photo or add an image to an event. For example, you can select a photo for your profile or upload an event cover image.',
        NSRemindersFullAccessUsageDescription:
          'Pallinky uses your reminders only if you choose to create a reminder for a plan or event.',
        NSRemindersUsageDescription:
          'Pallinky uses your reminders only if you choose to create a reminder for a plan or event.',
        NSUserNotificationsUsageDescription:
          'Pallinky sends notifications for invites, chat updates, and event changes.',
        ITSAppUsesNonExemptEncryption: false,
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: [CURRENT_APP.scheme],
          },
        ],
      },
    },

    android: {
      softwareKeyboardLayoutMode: 'resize',
      googleServicesFile: './google-services.json',
      package: CURRENT_APP.androidPackage,
      versionCode: CURRENT_APP.androidVersionCode,
     adaptiveIcon: {
  foregroundImage: CURRENT_APP.androidIcon,
  backgroundColor: CURRENT_APP.androidBackgroundColor,
},
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: 'pallinky.com',
              pathPrefix: '/event',
            },
            {
              scheme: 'https',
              host: 'www.pallinky.com',
              pathPrefix: '/event',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: CURRENT_APP.scheme,
              host: 'auth-callback',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
      permissions: [
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'POST_NOTIFICATIONS',
      ],
    },

    extra: {
      appVariant: APP_VARIANT,
      eas: {
        projectId: '885c6685-b242-4f1b-b985-a201c6191ac2',
      },
    },

    owner: 'nanbowles',
    runtimeVersion: '1.1.3',

    updates: {
      url: 'https://u.expo.dev/885c6685-b242-4f1b-b985-a201c6191ac2',
      requestHeaders: {
        'expo-channel-name': CURRENT_APP.updatesChannel,
      },
    },

    plugins: [
      '@react-native-community/datetimepicker',
      'expo-font',
      'expo-image',
      'expo-router',
      'expo-secure-store',
      'expo-web-browser',
      [
        'expo-notifications',
        {
          icon: CURRENT_APP.icon,
          color: '#ffffff',
        },
      ],
    ],
  },
};