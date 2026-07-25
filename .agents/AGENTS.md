# Workspace Rules for BestBill-apk

## APK Building Instructions
When asked to build, update, or package the APK for BestBill POS:
1. Always run `npm run build` inside `d:\BestBill-apk\frontend`.
2. Sync assets using `npx cap sync android` inside `d:\BestBill-apk\frontend`.
3. Run `powershell -ExecutionPolicy Bypass -File d:\BestBill-apk\build_apk.ps1` to compile the debug APK using JDK 21 (`d:\BestBill-apk\sdk\jdk-21`).
4. Ensure the output APK is saved to `d:\BestBill-apk\BestBill_Setup_v1.0.1.apk` and its timestamp is refreshed.
5. Push updated code to `origin main`.
6. Refer to [APK_BUILD_GUIDE.md](file:///d:/BestBill-apk/APK_BUILD_GUIDE.md) for complete details.
