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
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # Background Gradient (Deep Blue to Indigo)
    $rect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
    $c1 = [System.Drawing.ColorTranslator]::FromHtml("#0ea5e9")
    $c2 = [System.Drawing.ColorTranslator]::FromHtml("#4f46e5")
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45.0)

    if ($isRound) {
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddEllipse(0, 0, $width, $height)
        $graphics.FillPath($brush, $path)
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
        $graphics.FillPath($brush, $path)
    }

    # Center Emblem - Receipt/POS Card + Utensil
    $emblemPen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [Math]::Max(2.0, $width * 0.06))
    $emblemPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $emblemPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $emblemPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    # Draw Receipt Card Emblem at top-center
    $cardW = $width * 0.44
    $cardH = $height * 0.38
    $cardX = ($width - $cardW) / 2
    $cardY = $height * 0.14
    
    $cardPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $cRad = [Math]::Max(2, [int]($width * 0.06))
    $cDim = $cRad * 2
    $cardPath.AddArc($cardX, $cardY, $cDim, $cDim, 180, 90)
    $cardPath.AddArc($cardX + $cardW - $cDim, $cardY, $cDim, $cDim, 270, 90)
    $cardPath.AddArc($cardX + $cardW - $cDim, $cardY + $cardH - $cDim, $cDim, $cDim, 0, 90)
    $cardPath.AddArc($cardX, $cardY + $cardH - $cDim, $cDim, $cDim, 90, 90)
    $cardPath.CloseFigure()

    $cardBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, 255, 255, 255))
    $graphics.FillPath($cardBg, $cardPath)
    $graphics.DrawPath($emblemPen, $cardPath)

    # Draw Receipt Lines inside emblem
    $linePen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [Math]::Max(1.5, $width * 0.04))
    $graphics.DrawLine($linePen, [float]($cardX + $cardW * 0.2), [float]($cardY + $cardH * 0.3), [float]($cardX + $cardW * 0.8), [float]($cardY + $cardH * 0.3))
    $graphics.DrawLine($linePen, [float]($cardX + $cardW * 0.2), [float]($cardY + $cardH * 0.55), [float]($cardX + $cardW * 0.65), [float]($cardY + $cardH * 0.55))
    $graphics.DrawLine($linePen, [float]($cardX + $cardW * 0.2), [float]($cardY + $cardH * 0.78), [float]($cardX + $cardW * 0.5), [float]($cardY + $cardH * 0.78))

    # Draw "BESTBILL" Text at bottom center
    $fontSize = [Math]::Max(7.0, $width * 0.16)
    $font = New-Object System.Drawing.Font("Arial", [float]$fontSize, [System.Drawing.FontStyle]::Bold)
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

    $textRect = New-Object System.Drawing.RectangleF(0, [float]($height * 0.58), [float]$width, [float]($height * 0.36))
    $graphics.DrawString("BESTBILL", $font, $textBrush, $textRect, $sf)

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
