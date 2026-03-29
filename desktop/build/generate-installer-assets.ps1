Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logoPath = Join-Path $root "branding-logo.png"
$setupIconPath = Join-Path $root "setup.ico"
$loadingGifPath = Join-Path $root "loading.gif"

if (-not (Test-Path $logoPath)) {
  throw "Branding logo not found: $logoPath"
}

function New-RoundedRectPath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $Radius * 2
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Draw-InstallerScene {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$Width,
    [int]$Height,
    [System.Drawing.Image]$Logo,
    [bool]$IncludeCaption
  )

  $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $Graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $Graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

  $Graphics.Clear([System.Drawing.Color]::FromArgb(255, 7, 10, 17))

  $glowBrushOuter = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(50, 57, 153, 255))
  $glowBrushInner = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(90, 33, 231, 194))
  $Graphics.FillEllipse($glowBrushOuter, [float]($Width * 0.08), [float]($Height * 0.12), [float]($Width * 0.84), [float]($Height * 0.62))
  $Graphics.FillEllipse($glowBrushInner, [float]($Width * 0.22), [float]($Height * 0.2), [float]($Width * 0.56), [float]($Height * 0.44))
  $glowBrushOuter.Dispose()
  $glowBrushInner.Dispose()

  $panelHeightScale = 0.68
  if ($IncludeCaption) {
    $panelHeightScale = 0.54
  }
  $panelRect = New-Object System.Drawing.RectangleF([float]($Width * 0.18), [float]($Height * 0.12), [float]($Width * 0.64), [float]($Height * $panelHeightScale))
  $panelPath = New-RoundedRectPath -X $panelRect.X -Y $panelRect.Y -Width $panelRect.Width -Height $panelRect.Height -Radius ([float]($Width * 0.06))
  $panelBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(225, 14, 18, 28))
  $panelPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(110, 94, 168, 255), [float][Math]::Max(2, $Width * 0.012))
  $Graphics.FillPath($panelBrush, $panelPath)
  $Graphics.DrawPath($panelPen, $panelPath)
  $panelBrush.Dispose()
  $panelPen.Dispose()
  $panelPath.Dispose()

  $logoSizeScale = 0.34
  if ($IncludeCaption) {
    $logoSizeScale = 0.24
  }
  $logoSize = [float]($Width * $logoSizeScale)
  $logoX = [float](($Width - $logoSize) / 2)
  if ($IncludeCaption) {
    $logoY = [float]($Height * 0.2)
  } else {
    $logoY = [float](($Height - $logoSize) / 2)
  }
  $Graphics.DrawImage($Logo, $logoX, $logoY, $logoSize, $logoSize)

  if ($IncludeCaption) {
    $captionBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 232, 238, 250))
    $subCaptionBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 128, 142, 169))
    $headlineFont = New-Object System.Drawing.Font("Segoe UI Semibold", [float][Math]::Max(18, $Width * 0.038), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $subFont = New-Object System.Drawing.Font("Segoe UI", [float][Math]::Max(11, $Width * 0.02), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center

    $Graphics.DrawString("Preparing Karpik", $headlineFont, $captionBrush, [float]($Width / 2), [float]($Height * 0.74), $format)
    $Graphics.DrawString("Installing workspace components", $subFont, $subCaptionBrush, [float]($Width / 2), [float]($Height * 0.83), $format)

    $format.Dispose()
    $headlineFont.Dispose()
    $subFont.Dispose()
    $captionBrush.Dispose()
    $subCaptionBrush.Dispose()
  }
}

function Write-PngBackedIcon {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [string]$DestinationPath
  )

  $pngStream = New-Object System.IO.MemoryStream
  $Bitmap.Save($pngStream, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngBytes = $pngStream.ToArray()
  $pngStream.Dispose()

  $fileStream = [System.IO.File]::Open($DestinationPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
  try {
    $writer = New-Object System.IO.BinaryWriter($fileStream)
    $writer.Write([UInt16]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]1)
    $writer.Write([Byte]0)
    $writer.Write([Byte]0)
    $writer.Write([Byte]0)
    $writer.Write([Byte]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]32)
    $writer.Write([UInt32]$pngBytes.Length)
    $writer.Write([UInt32]22)
    $writer.Write($pngBytes)
    $writer.Flush()
    $writer.Dispose()
  } finally {
    $fileStream.Dispose()
  }
}

$logoImage = [System.Drawing.Image]::FromFile($logoPath)
try {
  $iconBitmap = New-Object System.Drawing.Bitmap 256, 256
  $iconGraphics = [System.Drawing.Graphics]::FromImage($iconBitmap)
  try {
    Draw-InstallerScene -Graphics $iconGraphics -Width 256 -Height 256 -Logo $logoImage -IncludeCaption:$false
    Write-PngBackedIcon -Bitmap $iconBitmap -DestinationPath $setupIconPath
  } finally {
    $iconGraphics.Dispose()
    $iconBitmap.Dispose()
  }

  $gifBitmap = New-Object System.Drawing.Bitmap 720, 420
  $gifGraphics = [System.Drawing.Graphics]::FromImage($gifBitmap)
  try {
    Draw-InstallerScene -Graphics $gifGraphics -Width 720 -Height 420 -Logo $logoImage -IncludeCaption:$true
    $gifBitmap.Save($loadingGifPath, [System.Drawing.Imaging.ImageFormat]::Gif)
  } finally {
    $gifGraphics.Dispose()
    $gifBitmap.Dispose()
  }
} finally {
  $logoImage.Dispose()
}
