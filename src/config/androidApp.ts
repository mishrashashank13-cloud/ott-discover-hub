/**
 * Central configuration for the BingeGuide Android app download.
 *
 * Update the values in this single file when publishing a new APK — every
 * page (Home CTA, Footer, /download page) reads from here so no other file
 * needs to change.
 */

export const androidAppConfig = {
  // Marketing name shown on the download page
  appName: "BingeGuide",

  // Current shipped version (semver — keep in sync with the APK filename)
  version: "1.0.0",

  // Public release date of the current APK (YYYY-MM-DD, human readable)
  releaseDate: "July 21, 2026",

  // Approximate APK size shown to the user
  fileSize: "18.4 MB",

  // Minimum Android OS version required to install the APK
  minAndroidVersion: "Android 8.0 (Oreo) and above",

  // Publicly reachable APK URL. Served from /public/downloads.
  // Update this URL (and drop the new file into public/downloads/) when
  // shipping a new version.
  apkUrl: "/downloads/BingeGuide-v1.0.0.apk",

  // Suggested filename when the browser saves the file
  apkFilename: "BingeGuide-v1.0.0.apk",

  // Short bullet list of app highlights shown on the download page
  features: [
    "Track upcoming movies and web series across Indian OTT platforms",
    "Personal reminders via Email and WhatsApp at your chosen time",
    "Personalized recommendations based on your language and genre taste",
    "Quick search across Netflix, Prime Video, Hotstar, JioCinema and more",
    "Lightweight, ad-free and designed for mobile viewing habits",
  ],
} as const;

export type AndroidAppConfig = typeof androidAppConfig;
