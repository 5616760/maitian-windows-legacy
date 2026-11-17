// Windows 适配层：Chrome 路径探测、端口占用查询、打开 URL、NAS 映射、防休眠
// 只在 win32 上被各模块引用；macOS 行为保持原样，不破坏上游。
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const IS_WIN = process.platform === 'win32';

// ---- Chrome 可执行文件探测 ----
let _chrome = null;
export function chromeBin() {
  if (_chrome) return _chrome;
  const cands = [
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
    process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    // 兜底：Edge（同为 Chromium，CDP 兼容；平台适配器理论上应优先 Chrome）
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ].filter(Boolean);
  _chrome = cands.find(p => fs.existsSync(p));
  if (!_chrome) throw new Error('没找到 Chrome/Edge：请安装 Google Chrome 后重试');
  return _chrome;
}

// ---- 查监听某 TCP 端口的 PID（替代 lsof）----
export function pidsOnPort(port) {
  try {
    const out = execFileSync('netstat', ['-ano', '-p', 'TCP'], { windowsHide: true, timeout: 8000 }).toString('latin1');
    const pids = new Set();
    for (const line of out.split('\n')) {
      const m = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/i);
      if (m && +m[1] === +port) pids.add(m[2]);
    }
    return [...pids];
  } catch { return []; }
}

export function portInUse(port) { return pidsOnPort(port).length > 0; }

// ---- 后台打开一个 URL 到 Chrome（替代 open -g -a 'Google Chrome'）----
export function openInChrome(url) {
  try {
    spawn(chromeBin(), [url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    return true;
  } catch { return false; }
}

// ---- 把窗口带到前台（替代 osascript frontmost）----
export function bringToFront() {
  // 非关键路径：Windows 下靠 PowerShell AppActivate，失败不影响功能
  try {
    execFileSync('powershell', ['-NoProfile', '-Command',
      '$p = Get-Process chrome -ErrorAction SilentlyContinue | Select-Object -First 1; if ($p) { (New-Object -ComObject WScript.Shell).AppActivate($p.Id) | Out-Null }'],
      { windowsHide: true, timeout: 8000 });
  } catch { /* 不影响 */ }
}

// ---- NAS：macOS 用 osascript mount volume；Windows 用 net use ----
// nasUrl 形如 smb://user@host/share 或 \\host\share；映射到盘符（config.nasDrive，默认 Z:）
export function parseSmb(url) {
  let m = url.match(/^smb:\/\/([^@/]*@)?([^/]+)\/(.+)$/i);
  if (m) return { user: m[1] ? m[1].slice(0, -1) : null, host: m[2], share: m[3].replace(/\//g, '\\') };
  m = url.match(/^\\\\([^\\]+)\\(.+)$/);
  if (m) return { user: null, host: m[1], share: m[2] };
  return null;
}
export function mountNas(nasUrl, drive = 'Z:') {
  const p = parseSmb(nasUrl); if (!p) return false;
  const unc = `\\\\${p.host}\\${p.share}`;
  try {
    // 先断开残留映射（忽略错误），再重新映射，持久化
    try { execFileSync('net', ['use', drive, '/delete', '/y'], { windowsHide: true, timeout: 15000, stdio: 'pipe' }); } catch {}
    const args = ['use', drive, unc, '/persistent:yes'];
    if (p.user) args.push('/user:' + p.user);
    execFileSync('net', args, { windowsHide: true, timeout: 20000, stdio: 'pipe' });
    return true;
  } catch { return false; }   // 需要密码/凭据管理器处理，失败不抛
}

// ---- 防休眠（替代 caffeinate）----
// 用 SetThreadExecutionState 让系统在守护进程存活期间不待机。
// 通过 PowerShell 调 kernel32（无 P/Invoke 编译依赖：用 Add-Type 内联 C#）
let _es = null;
export function keepAwakeOn() {
  if (_es) return;
  try {
    _es = spawn('powershell', ['-NoProfile', '-Command', `
Add-Type -Namespace W -Name ES -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
[W.ES]::SetThreadExecutionState(0x80000000 -bor 0x00000001 -bor 0x00000002) | Out-Null
while ($true) { Start-Sleep -Seconds 60 }`], { detached: true, stdio: 'ignore', windowsHide: true });
    _es.unref();
  } catch { /* 失败不影响主流程 */ }
}
export function keepAwakeOff() { try { _es && _es.kill(); } catch {} _es = null; }

// ---- 替代 launchd：登录自启 ----
// ONLOGON 计划任务需要管理员权限；免提权用「启动文件夹」快捷方式，登录即运行。
function startupDir() {
  const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(base, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
}

// 用 VBScript 建一个带参数的快捷方式（WScript.Shell，免提权）
export function scheduleTask(name, nodePath, scriptPath, cwd) {
  try {
    const dir = startupDir(); fs.mkdirSync(dir, { recursive: true });
    const lnk = path.join(dir, `${name}.lnk`);
    const vbs = path.join(dir, `${name}.vbs`);
    const target = `"${nodePath}" "${scriptPath}"`;
    fs.writeFileSync(vbs, [
      `Set fso = CreateObject("Scripting.FileSystemObject")`,
      `Set sh = CreateObject("WScript.Shell")`,
      `Set lnk = sh.CreateShortcut("${lnk.replace(/\\/g, '\\\\')}")`,
      `lnk.TargetPath = "${nodePath}"`,
      `lnk.Arguments = "${scriptPath} daemon"`,
      `lnk.WorkingDirectory = "${(cwd || '').replace(/\\/g, '\\\\')}"`,
      `lnk.WindowStyle = 7`,
      `lnk.Save`,
      `fso.DeleteFile(WScript.ScriptName)`,
    ].join('\r\n'), 'utf16le');
    execFileSync('cscript', ['//B', '//Nologo', vbs], { windowsHide: true, timeout: 15000, stdio: 'pipe' });
    fs.rmSync(vbs, { force: true });
    return fs.existsSync(lnk);
  } catch { return false; }
}
