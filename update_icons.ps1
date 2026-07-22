Add-Type -AssemblyName System.Drawing

$sourceImagePath = "$PSScriptRoot\bestbill_logo.jpeg"

if (-not (Test-Path $sourceImagePath)) {
    Write-Host "Source image not found: $sourceImagePath"
    exit 1
}

$sourceImage = [System.Drawing.Image]::FromFile($sourceImagePath)

function Create-BestBillIcon {
    param(
        [int]$width,
        [int]$height,
        [string]$outputPath,
        [bool]$isRound = $false
    )

    $bitmap = New-Object System.Drawing.Bitmap($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    if ($isRound) {
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddEllipse(0, 0, $width, $height)
        $graphics.SetClip($path)
        $graphics.DrawImage($sourceImage, 0, 0, $width, $height)
        $graphics.ResetClip()
    } else {
        # Rounded Rect with smooth corner radius
        $radius = [Math]::Max(4, [int]($width * 0.22))
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $diameter = $radius * 2
        $path.AddArc(0, 0, $diameter, $diameter, 180, 90)
        $path.AddArc($width - $diameter, 0, $diameter, $diameter, 270, 90)
        $path.AddArc($width - $diameter, $height - $diameter, $diameter, $diameter, 0, 90)
        $path.AddArc(0, $height - $diameter, $diameter, $diameter, 90, 90)
        $path.CloseFigure()
        
        $graphics.SetClip($path)
        $graphics.DrawImage($sourceImage, 0, 0, $width, $height)
        $graphics.ResetClip()
    }

    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bitmap.Dispose()
}

$densities = @(
    @{ folder="mipmap-mdpi"; size=48 },
    @{ folder="mipmap-hdpi"; size=72 },
    @{ folder="mipmap-xhdpi"; size=96 },
    @{ folder="mipmap-xxhdpi"; size=144 },
    @{ folder="mipmap-xxxhdpi"; size=192 }
)

$baseResDir = "d:\BestBill-apk\frontend\android\app\src\main\res"

foreach ($d in $densities) {
    $dir = Join-Path $baseResDir $d.folder
    if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
    
    $sz = $d.size
    Create-BestBillIcon -width $sz -height $sz -outputPath (Join-Path $dir "ic_launcher.png") -isRound $false
    Create-BestBillIcon -width $sz -height $sz -outputPath (Join-Path $dir "ic_launcher_round.png") -isRound $true
    Create-BestBillIcon -width $sz -height $sz -outputPath (Join-Path $dir "ic_launcher_foreground.png") -isRound $false
    Write-Host "Generated launcher icons for $($d.folder) ($($sz)x$($sz))"
}

$webLogoPath = "d:\BestBill-apk\frontend\public\logo.png"
Create-BestBillIcon -width 512 -height 512 -outputPath $webLogoPath -isRound $false
Write-Host "Generated web logo at $webLogoPath (512x512)"

$sourceImage.Dispose()
