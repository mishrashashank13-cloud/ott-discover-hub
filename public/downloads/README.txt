Place the signed BingeGuide Android APK in this folder.

The download page reads the filename and version from
src/config/androidApp.ts (default: BingeGuide-v1.0.0.apk).

To publish a new APK:
  1. Drop the new file here, e.g. BingeGuide-v1.1.0.apk
  2. Update `apkUrl`, `apkFilename`, `version`, `fileSize`,
     and `releaseDate` in src/config/androidApp.ts
