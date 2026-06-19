const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withNotificationConfig(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;
    
    // Ensure tools namespace is present on the <manifest> element
    if (!androidManifest.$) {
      androidManifest.$ = {};
    }
    androidManifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    
    // Get the <application> element
    const application = androidManifest.application[0];
    
    if (application && application['meta-data']) {
      // 1. Resolve conflict for default_notification_channel_id by adding tools:replace="android:value"
      const channelMetaData = application['meta-data'].find(
        (item) => item.$ && item.$['android:name'] === 'com.google.firebase.messaging.default_notification_channel_id'
      );
      if (channelMetaData && channelMetaData.$) {
        channelMetaData.$['tools:replace'] = 'android:value';
      }
      
      // 2. Resolve conflict for default_notification_color by adding tools:replace="android:resource"
      const colorMetaData = application['meta-data'].find(
        (item) => item.$ && item.$['android:name'] === 'com.google.firebase.messaging.default_notification_color'
      );
      if (colorMetaData && colorMetaData.$) {
        colorMetaData.$['tools:replace'] = 'android:resource';
      }
    }

    return config;
  });
};
