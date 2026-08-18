# =====================================================================
# install-skin.ps1 — 安装一个新的 dsh 皮肤包并注册到管理器的皮肤列表
#
# 用途：以后想继续增加皮肤时，用这个脚本把皮肤装进
#       @dsh-external 目录 + profile 注册行，之后打开
#       设置 > 外观 · 皮肤 即可在管理器中切换（无需改代码）。
#
# 用法：
#   .\install-skin.ps1 -PackageDir "C:\path\to\skin-package"
#   .\install-skin.ps1 -Repo "https://github.com/user/repo" [-SubDir "skin-folder"] [-Tag "v1.0"]
#   .\install-skin.ps1 -PackageDir ... -Active          # 装完后马上作为当前皮肤
#   .\install-skin.ps1 -PackageDir ... -WhatIf          # 只预览，不写入
#
# 皮肤包必须满足的最小契约（详见 皮肤新增指南.md）：
#   * package.json：name 形如 @dsh-external/dsh-client-ui-skin-<short>，
#     dsh.client { platform: "web" }，exports["./client"] 指向浏览器包
#   * lib/client.js：实际的皮肤客户端（挂载时自动应用外观）
#   * skin.json：id / name / nameEn / tagline / accent / preview{light,dark}
#   * preview/ 预览图（webp/png，管理器画卡片用）
#
# 注意：注册行属于"安装期"操作，脚本运行完需要【重启一次服务】；
#       之后所有皮肤切换都走 HMR，无需再重启。
# =====================================================================
param(
  [string]$PackageDir = "",
  [string]$Repo = "",
  [string]$Tag = "",
  [string]$SubDir = "",
  [string]$Profile = "web",
  [string]$DshHome = "",
  [switch]$Active,
  [switch]$WhatIf
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "    OK  $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    !!  $msg" -ForegroundColor Yellow }

$REGISTRY_START = "# --- dsh-skin registry rows (installed skins; restart after editing) ---"
$REGISTRY_END = "# --- end dsh-skin registry rows ---"
$MANAGED_START = "# --- dsh-skin managed (auto-generated; do not edit) ---"
$MANAGED_END = "# --- end dsh-skin managed ---"

if (-not $DshHome) { $DshHome = Join-Path $env:USERPROFILE ".dsh" }
if (-not $Repo -and -not $PackageDir) { throw "请提供 -PackageDir 或 -Repo 之一" }

# ---------- 1. 解析皮肤源码目录 ----------
$srcDir = ""
if ($Repo) {
  $tmp = Join-Path $env:TEMP ("dsh-skin-src-" + [guid]::NewGuid().ToString("N"))
  Write-Step "克隆仓库: $Repo"
  if ($WhatIf) { Write-Ok "(WhatIf) 将 git clone 到 $tmp" }
  else {
    New-Item -ItemType Directory -Force $tmp | Out-Null
    if ($Tag) { & git clone --depth 1 --branch $Tag $Repo $tmp 2>&1 | Out-Null; if ($LASTEXITCODE -ne 0) { throw "git clone 失败 (tag=$Tag)" } }
    else { & git clone --depth 1 $Repo $tmp 2>&1 | Out-Null; if ($LASTEXITCODE -ne 0) { throw "git clone 失败" } }
  }
  $candidates = @(Get-ChildItem $tmp -Directory -ErrorAction SilentlyContinue)
  $srcDir = $tmp
  if ($SubDir) {
    $probe = Join-Path $tmp $SubDir
    if (-not (Test-Path $probe)) { throw "仓库内找不到子目录: $SubDir" }
    $srcDir = $probe
  } elseif ((Test-Path (Join-Path $tmp "package.json")) -and (Test-Path (Join-Path $tmp "skin.json"))) {
    $srcDir = $tmp
  } else {
    foreach ($c in $candidates) {
      if ((Test-Path (Join-Path $c.FullName "package.json")) -and (Test-Path (Join-Path $c.FullName "skin.json"))) { $srcDir = $c.FullName; break }
    }
    if ($srcDir -eq $tmp -and $candidates.Count -eq 1 -and (Test-Path (Join-Path $candidates[0].FullName "package.json"))) { $srcDir = $candidates[0].FullName }
  }
  if ($srcDir -eq $tmp -and -not (Test-Path (Join-Path $tmp "package.json"))) { throw "在仓库中找不到皮肤包目录（需要含 skin.json + package.json）" }
} else {
  $srcDir = (Resolve-Path $PackageDir).Path
  if (-not (Test-Path (Join-Path $srcDir "package.json"))) { throw "$srcDir 下没有 package.json" }
}
Write-Ok "皮肤源码目录: $srcDir"

# ---------- 2. 读取 & 校验元数据 ----------
$pkgJson = Get-Content (Join-Path $srcDir "package.json") -Raw | ConvertFrom-Json
$skinJson = $null
if (Test-Path (Join-Path $srcDir "skin.json")) { $skinJson = Get-Content (Join-Path $srcDir "skin.json") -Raw | ConvertFrom-Json }
else { Write-Warn "没有 skin.json —— 管理器将不会在列表里显示它（仍可安装，但无卡片）" }

$name = [string]$pkgJson.name
if ($name -notmatch '^@[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$') { throw "package.json name 必须是 @scope/name 形式，得到: '$name'" }
$dcl = $pkgJson.dsh.client
if ($null -eq $dcl) { Write-Warn "package.json 缺少 dsh.client 声明 —— 皮肤不会作为客户端插件加载" }
elseif ($dcl.platform -ne "web") { throw "dsh.client.platform 必须是 'web'，得到: '$($dcl.platform)'" }
$exp = $pkgJson.exports
$clientRel = $null
if ($exp.'./client' -is [string]) { $clientRel = $exp.'./client' }
elseif ($exp.'./client' -and $exp.'./client'.default) { $clientRel = $exp.'./client'.default }
if (-not $clientRel) { Write-Warn "exports['./client'] 未声明 —— 客户端包不会进入启动图" }
elseif (-not (Test-Path (Join-Path $srcDir $clientRel))) { Write-Warn "exports['./client'] 指向的文件不存在: $clientRel" }

$base = $name.Substring($name.LastIndexOf('/') + 1)
if ($base -like 'dsh-client-ui-skin-*') { $short = $base.Substring('dsh-client-ui-skin-'.Length) } else { $short = $base }
$rowId = "ui-skin-" + $short
$destName = $name.Substring($name.IndexOf('/') + 1)
Write-Ok "包名: $name | 行 id: $rowId"

# ---------- 3. 目标路径 & 复制 ----------
$dest = Join-Path $DshHome ("profiles\" + $Profile + "\node_modules\@dsh-external\" + $destName)
$profilePatch = Join-Path $DshHome ("profiles\" + $Profile + "\cordis.patch.yml")
$homePatch = Join-Path $DshHome "cordis.patch.yml"

Write-Step "复制皮肤到: $dest"
if ($WhatIf) { Write-Ok "(WhatIf) 将复制 $srcDir -> $dest（排除 node_modules/.git）" }
else {
  New-Item -ItemType Directory -Force (Join-Path $dest "..") | Out-Null
  if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
  Copy-Item -Recurse $srcDir $dest
  foreach ($junk in @("node_modules", ".git")) {
    $j = Join-Path $dest $junk
    if (Test-Path $j) { Remove-Item -Recurse -Force $j }
  }
  Write-Ok "已复制"
}

# ---------- 4. profile 注册行（幂等 + 容错追加） ----------
# 容错：若起始标记存在但结束标记丢失（如手工编辑吞掉），
# 从起始标记到文件末尾整块重建（保留已有行 + 补回结束标记），不抛错。
function Add-RegistryRow($file, $rowId, $name) {
  $text = ""
  if (Test-Path $file) { $text = Get-Content $file -Raw }
  if ($text -match [regex]::Escape("- id: " + $rowId)) { return $false }
  $start = $text.IndexOf($REGISTRY_START)
  if ($start -ge 0) {
    $end = $text.IndexOf($REGISTRY_END, $start)
    $tail = ""
    if ($end -ge 0) {
      $zoneText = $text.Substring($start, $end - $start + $REGISTRY_END.Length)
      $tail = $text.Substring($end + $REGISTRY_END.Length)
    } else {
      $zoneText = $text.Substring($start)   # 结束标记缺失：块到文件末尾
    }
    # 逐行提取 (id, name) 对，保序去重
    $order = [System.Collections.Generic.List[string]]::new()
    $names = @{}
    $lines = $zoneText -split "`n"
    for ($i = 0; $i -lt $lines.Count; $i++) {
      $m = [regex]::Match($lines[$i], '^\s*- id:\s*([A-Za-z0-9_.-]+)\s*$|^\s+id:\s*([A-Za-z0-9_.-]+)\s*$')
      if ($m.Success) {
        $rid = if ($m.Groups[1].Value) { $m.Groups[1].Value } else { $m.Groups[2].Value }
        if (-not $names.ContainsKey($rid) -and $i + 1 -lt $lines.Count) {
          $nm = [regex]::Match($lines[$i+1], '^\s+name:\s*[''"]?(@?[^''"\s]+)[''"]?\s*$')
          if ($nm.Success) { $names[$rid] = $nm.Groups[1].Value; [void]$order.Add($rid) }
        }
      }
    }
    $rows = @()
    foreach ($rid in $order) { $rows += ("    - id: " + $rid + "`n      name: '" + $names[$rid] + "'") }
    $rows += ("    - id: " + $rowId + "`n      name: '" + $name + "'")
    $newBlock = $REGISTRY_START + "`n- insert:`n" + ($rows -join "`n") + "`n" + $REGISTRY_END
    $text = $text.Remove($start) + $newBlock + $tail
  } else {
    $newBlock = $REGISTRY_START + "`n- insert:`n    - id: " + $rowId + "`n      name: '" + $name + "'`n" + $REGISTRY_END + "`n"
    $text = $text.TrimEnd() + "`n`n" + $newBlock
  }
  Set-Content -NoNewline -Encoding utf8 $file $text
  return $true
}

Write-Step "注册行到 profile 补丁: $profilePatch"
if ($WhatIf) { Write-Ok "(WhatIf) 将追加行 $rowId -> $profilePatch" }
else { if (Add-RegistryRow $profilePatch $rowId $name) { Write-Ok "已追加行 $rowId" } else { Write-Ok "行已存在，跳过" } }

# ---------- 5. home 层 flag（幂等 + 容错追加；默认新皮肤不激活） ----------
function Add-FlagRow($file, $rowId, $disabled) {
  $text = ""
  if (Test-Path $file) { $text = Get-Content $file -Raw }
  if ($text -match [regex]::Escape("- id: " + $rowId)) { return $false }
  $flag = if ($disabled) { "disabled: true" } else { "disabled: false" }
  $flagText = "- id: " + $rowId + "`n  " + $flag
  $start = $text.IndexOf($MANAGED_START)
  if ($start -ge 0) {
    $end = $text.IndexOf($MANAGED_END, $start)
    $tail = ""
    if ($end -ge 0) {
      $zoneText = $text.Substring($start, $end - $start + $MANAGED_END.Length)
      $tail = $text.Substring($end + $MANAGED_END.Length)
    } else {
      $zoneText = $text.Substring($start)
    }
    # 保序提取已有 flag 行（连同其当前 disabled 值），跳过注释与空数组占位行
    $flags = [System.Collections.Generic.List[object]]::new()
    $lines = $zoneText -split "`n"
    for ($i = 0; $i -lt $lines.Count; $i++) {
      if ($lines[$i] -match '^\s*-[ \t]*id:\s*([A-Za-z0-9_.-]+)\s*$') {
        $rid = $Matches[1]
        $val = "true"
        if ($i + 1 -lt $lines.Count -and $lines[$i+1] -match '^\s*disabled:\s*(true|false)\s*$') { $val = $Matches[1] }
        [void]$flags.Add(@{ id = $rid; d = $val })
      }
    }
    $rows = @()
    foreach ($rec in $flags) { $rows += ("- id: " + $rec.id + "`n  disabled: " + $rec.d) }
    $rows += $flagText
    $newBlock = $MANAGED_START + "`n" + ($rows -join "`n") + "`n" + $MANAGED_END
    $text = $text.Remove($start) + $newBlock + $tail
  } else {
    $newBlock = $MANAGED_START + "`n" + $flagText + "`n" + $MANAGED_END + "`n"
    $text = $text.TrimEnd() + "`n`n" + $newBlock
  }
  Set-Content -NoNewline -Encoding utf8 $file $text
  return $true
}

Write-Step "home 层 flag: $homePatch"
if ($WhatIf) { Write-Ok "(WhatIf) 将追加 $rowId disabled=$(-not $Active) -> $homePatch" }
else { if (Add-FlagRow $homePatch $rowId (-not $Active)) { Write-Ok "已追加 $rowId ($(-not $Active))" } else { Write-Ok "flag 已存在，跳过" } }

# ---------- 6. 汇总 ----------
Write-Step "完成"
Write-Host ""
Write-Host "  已安装皮肤: $name" -ForegroundColor Green
Write-Host "  行 id:       $rowId"
if ($Active) { Write-Host "  状态:        已设为当前皮肤（其它皮肤将被禁用）" } else { Write-Host "  状态:        默认停用，可在管理器里启用" }
$listener = Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
  Write-Warn "检测到 3080 端口服务正在运行 —— 注册行属于安装期操作，请【重启一次服务】后再使用"
} else {
  Write-Host "  下一步:      重启服务（dsh）后，打开 设置 > 外观 · 皮肤 即可看到并切换"
}
Write-Host "  皮肤包目标:  $dest"
Write-Host "  注意:        皮肤版权归原作者；非商用皮肤请遵守其许可证（如 CC BY-NC-SA 4.0）"