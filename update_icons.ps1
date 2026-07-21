Add-Type -AssemblyName System.Drawing

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

    # Background Gradient (Deep Blue to Indigo)
    $rect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
    $c1 = [System.Drawing.ColorTranslator]::FromHtml("#0ea5e9")
    $c2 = [System.Drawing.ColorTranslator]::FromHtml("#6366f1")
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45.0)

    if ($isRound) {
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddEllipse(0, 0, $width, $height)
        $graphics.FillPath($brush, $path)
    } else {
        # Rounded Rect
        $radius = [Math]::Max(4, [int]($width * 0.22))
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $diameter = $radius * 2
        $path.AddArc(0, 0, $diameter, $diameter, 180, 90)
        $path.AddArc($width - $diameter, 0, $diameter, $diameter, 270, 90)
        $path.AddArc($width - $diameter, $height - $diameter, $diameter, $diameter, 0, 90)
        $path.AddArc(0, $height - $diameter, $diameter, $diameter, 90, 90)
        $path.CloseFigure()
        $graphics.FillPath($brush, $path)
    }

    # Draw White Cross Utensils / Receipt Symbol in center
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [Math]::Max(2.0, $width * 0.08))
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    # Center fork/knife diagonal lines
    $padding = $width * 0.28
    $w = $width
    $h = $height
    $graphics.DrawLine($pen, [float]($padding), [float]($padding), [float]($w - $padding), [float]($h - $padding))
    $graphics.DrawLine($pen, [float]($w - $padding), [float]($padding), [float]($padding), [float]($h - $padding))

    # Center circle accent
    $centerSize = $width * 0.16
    $cPen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [Math]::Max(1.5, $width * 0.06))
    $graphics.DrawEllipse($cPen, [float]($w/2 - $centerSize/2), [float]($h/2 - $centerSize/2), [float]($centerSize), [float]($centerSize))

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
