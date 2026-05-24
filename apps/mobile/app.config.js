const appVariant = process.env.EXPO_PUBLIC_APP_VARIANT;

if (!['development', 'production'].includes(appVariant)) {
  throw new Error(
    `Missing or invalid EXPO_PUBLIC_APP_VARIANT. Expected "development" or "production", got ${appVariant ?? 'unset'}.`
  );
}

const appName = 'Pallinky';
const iosBundleIdentifier = 'com.nancy.pallinky';
const androidPackage = 'com.nancy.pallinky';
export default {
  expo: {
<<<<<<< Updated upstream
    name: appName,
    slug: 'pallinky',
    owner: 'nanbowles',
    scheme: 'pallinky',

    version: '1.1.5',
    runtimeVersion: '1.1.5',

=======
    name: CURRENT_APP.name,
    slug: 'pallinky',
    scheme: CURRENT_APP.scheme,
    version: '1.1.3',
>>>>>>> Stashed changes
    orientation: 'portrait',
    userInterfaceStyle: 'light',

    icon: './assets/icon.png',

    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },

    assetBundlePatterns: ['**/*'],

    updates: {
  url: 'https://u.expo.dev/3a13b9ce-13b3-48f4-88b4-e4945d9698dc',
},
    ios: {
      supportsTablet: true,
      bundleIdentifier: iosBundleIdentifier,
      usesAppleSignIn: true,

      associatedDomains: ['applinks:pallinky.com'],

      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,

        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: ['pallinky'],
          },
        ],

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
          'Pallinky uses your photo library so you can choose a profile photo or add an image to an event.',

        NSRemindersFullAccessUsageDescription:
          'Pallinky uses your reminders only if you choose to create a reminder for a plan or event.',

        NSRemindersUsageDescription:
          'Pallinky uses your reminders only if you choose to create a reminder for a plan or event.',

        NSUserNotificationsUsageDescription:
          'Pallinky sends notifications for invites, chat updates, and event changes.',
      },
    },

    android: {
      package: androidPackage,

      googleServicesFile: './google-services.json',

      softwareKeyboardLayoutMode: 'resize',

      adaptiveIcon: {
        foregroundImage: './assets/android-prod.png',
        backgroundColor: '#46C34C',
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
            {
              scheme: 'https',
              host: 'pallinky.com',
              pathPrefix: '/add',
            },
            {
              scheme: 'https',
              host: 'www.pallinky.com',
              pathPrefix: '/add',
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
      appVariant,
      eas: {
        projectId: '3a13b9ce-13b3-48f4-88b4-e4945d9698dc',
      },

<<<<<<< Updated upstream
      router: {},
=======
    owner: 'nanbowles',
    runtimeVersion: '1.1.3',

    updates: {
      url: 'https://u.expo.dev/3a13b9ce-13b3-48f4-88b4-e4945d9698dc',
      requestHeaders: {
        'expo-channel-name': CURRENT_APP.updatesChannel,
      },
>>>>>>> Stashed changes
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
          icon: './assets/icon.png',
          color: '#f10303ff',
        },
      ],
    ],
  },
};
