export const jitsiConfig = {
  roomNamePrefix: 'hrms-meeting-',
  domain: 'meet.jit.si', // Using free Jitsi instance
  configOverwrite: {
    startWithAudioMuted: true,
    startWithVideoMuted: true,
    enableWelcomePage: false,
    disableModeratorIndicator: true,
    enableNoisyMicDetection: false,
    enableClosePage: false,
  },
  interfaceConfigOverwrite: {
    DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
    SHOW_CHROME_EXTENSION_BANNER: false,
    MOBILE_APP_PROMO: false,
    HIDE_INVITE_MORE_HEADER: true,
  }
};