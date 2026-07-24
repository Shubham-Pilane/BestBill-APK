$sdkDir = "d:\BestBill-apk\sdk"
if (!(Test-Path $sdkDir)) {
    New-Item -ItemType Directory -Path $sdkDir | Out-Null
}

$jdkZip = "$sdkDir\jdk.zip"
$jdkPath = "$sdkDir\jdk-21"
if (!(Test-Path $jdkPath)) {
    Write-Host "Downloading OpenJDK 21 (approx 190MB)..."
    Invoke-WebRequest -Uri "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.4%2B7/OpenJDK21U-jdk_x64_windows_hotspot_21.0.4_7.zip" -OutFile $jdkZip
    Write-Host "Extracting OpenJDK 21..."
    Expand-Archive -Path $jdkZip -DestinationPath $sdkDir
    $extracted = Get-ChildItem -Path $sdkDir -Directory -Filter "jdk-21*" | Select-Object -First 1
    Rename-Item -Path $extracted.FullName -NewName "jdk-21"
    Remove-Item -Force $jdkZip
}

$sdkZip = "$sdkDir\sdk-tools.zip"
$sdkHome = "$sdkDir\android-sdk"
if (!(Test-Path $sdkHome)) {
    Write-Host "Downloading Android Command Line Tools (approx 120MB)..."
    Invoke-WebRequest -Uri "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip" -OutFile $sdkZip
    Write-Host "Extracting Android Command Line Tools..."
    Expand-Archive -Path $sdkZip -DestinationPath "$sdkHome\temp"
    New-Item -ItemType Directory -Path "$sdkHome\cmdline-tools\latest" | Out-Null
    Move-Item -Path "$sdkHome\temp\cmdline-tools\*" -Destination "$sdkHome\cmdline-tools\latest"
    Remove-Item -Recurse -Force "$sdkHome\temp"
    Remove-Item -Force $sdkZip
}

# Auto-accept Android SDK licenses
$licenseDir = "$sdkHome\licenses"
if (!(Test-Path $licenseDir)) {
    New-Item -ItemType Directory -Path $licenseDir | Out-Null
}
Set-Content -Path "$licenseDir\android-sdk-license" -Value "89aa2069994b56373b613c01c0b84287b21e0555`n84831b9409646a91c09757f8120a7d16b8d2001a`n791207223403454d0a4e92a45699bb4a1124f6c5`nbdf63a69e383be95e9078c1f85e3599e55ce9ee9`n8ff30a5b9472d0ac0b65a2ee24978d3565ffe730`n24333f8a63b682d90d011858223e7277481e1ef9" -NoNewline

# Set environment variables for this process
$env:JAVA_HOME = $jdkPath
$env:ANDROID_HOME = $sdkHome
$env:PATH = "$jdkPath\bin;$sdkHome\cmdline-tools\latest\bin;$env:PATH"

# Write local.properties
Set-Content -Path "d:\BestBill-apk\frontend\android\local.properties" -Value "sdk.dir=d:/BestBill-apk/sdk/android-sdk"

# Run Android build
Write-Host "Building APK..."
cd d:\BestBill-apk\frontend\android
.\gradlew.bat assembleDebug

# Copy compiled APK to root of BestBill-apk
$outputApk = "d:\BestBill-apk\frontend\android\app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $outputApk) {
    Copy-Item -Path $outputApk -Destination "d:\BestBill-apk\BestBill.apk" -Force
    Write-Host "----------------------------------------"
    Write-Host "UPDATED BESTBILL APK COMPILED SUCCESSFULLY!"
    Write-Host "Location: d:\BestBill-apk\BestBill.apk"
    Write-Host "----------------------------------------"
} else {
    Write-Host "Build failed. Check error log above."
}
