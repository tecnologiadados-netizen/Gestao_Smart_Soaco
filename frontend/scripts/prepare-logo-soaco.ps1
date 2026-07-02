# Gera logo-soaco-clean.png — fundo transparente, sem halos/contornos do export raster.
param(
  [string]$InputPath = "$PSScriptRoot\..\public\logo-soaco-manual.png",
  [string]$OutputPath = "$PSScriptRoot\..\public\logo-soaco-clean.png"
)

Add-Type -AssemblyName System.Drawing

function Get-LumSat([int]$r, [int]$g, [int]$b) {
  $lum = 0.299 * $r + 0.587 * $g + 0.114 * $b
  $max = [Math]::Max($r, [Math]::Max($g, $b))
  $min = [Math]::Min($r, [Math]::Min($g, $b))
  $sat = if ($max -eq 0) { 0 } else { ($max - $min) / $max }
  return @{ Lum = $lum; Sat = $sat; Spread = $max - $min }
}

function Test-BrandYellow([int]$r, [int]$g, [int]$b) {
  return ($r -gt 130 -and $g -gt 70 -and $b -lt 150 -and ($r - $b) -gt 55 -and ($g - $b) -gt 25)
}

function Test-BrandWhite([int]$r, [int]$g, [int]$b, $ls) {
  return ($ls.Lum -gt 155 -and $ls.Spread -lt 35)
}

function Get-Alpha([int]$r, [int]$g, [int]$b) {
  $ls = Get-LumSat $r $g $b
  if (Test-BrandYellow $r $g $b) { return 255 }
  if (Test-BrandWhite $r $g $b $ls) { return 255 }
  # Contorno preto / sombra pixelada ao redor do amarelo
  if ($ls.Lum -lt 72 -and $ls.Spread -lt 55) { return 0 }
  # Franja escura amarelada (anti-alias sujo entre SÓ e fundo)
  if ($r -gt $b -and $r -gt $g -and $ls.Lum -lt 125 -and -not (Test-BrandYellow $r $g $b)) { return 0 }
  # Fundo escuro / caixa cinza
  if ($ls.Lum -lt 112 -and $ls.Sat -lt 0.38) { return 0 }
  # Halo claro/cinza (franja de exportação)
  if ($ls.Lum -gt 48 -and $ls.Lum -lt 225 -and $ls.Sat -lt 0.18) { return 0 }
  # Transição suave nas bordas
  if ($ls.Lum -lt 135 -and $ls.Sat -lt 0.24) {
    $fade = [Math]::Max(0, [Math]::Min(1, ($ls.Lum - 72) / 68))
    return [int](255 * $fade)
  }
  return 255
}

$src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $InputPath))
$w = $src.Width
$h = $src.Height
$alpha = New-Object 'int[]' ($w * $h)

for ($y = 0; $y -lt $h; $y++) {
  for ($x = 0; $x -lt $w; $x++) {
    $c = $src.GetPixel($x, $y)
    $alpha[$y * $w + $x] = Get-Alpha $c.R $c.G $c.B
  }
}

# Suaviza canal alpha (3x3)
$smoothed = New-Object 'int[]' ($w * $h)
for ($y = 0; $y -lt $h; $y++) {
  for ($x = 0; $x -lt $w; $x++) {
    if ($x -eq 0 -or $y -eq 0 -or $x -eq ($w - 1) -or $y -eq ($h - 1)) {
      $smoothed[$y * $w + $x] = $alpha[$y * $w + $x]
      continue
    }
    $sum = 0
    for ($dy = -1; $dy -le 1; $dy++) {
      for ($dx = -1; $dx -le 1; $dx++) {
        $sum += $alpha[($y + $dy) * $w + ($x + $dx)]
      }
    }
    $smoothed[$y * $w + $x] = [int][Math]::Round($sum / 9.0)
  }
}

$out = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt $h; $y++) {
  for ($x = 0; $x -lt $w; $x++) {
    $c = $src.GetPixel($x, $y)
    $a = $smoothed[$y * $w + $x]
    if ($a -le 0) {
      $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
      continue
    }
    $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($a, $c.R, $c.G, $c.B))
  }
}

$out.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$src.Dispose()
$out.Dispose()
Write-Host "Logo limpa gerada: $OutputPath (${w}x${h})"
