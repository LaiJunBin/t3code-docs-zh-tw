---
title: 安裝 T3 Code
source: docs/user/install.md
source_hash: 77b09863d746e2bdcb82ed3560ce1dc0be8c5ef2
---

T3 Code 在你的電腦上執行 coding agent，並讓你從桌面版、網頁版或手機版 app 控制它們。請先把 agent 要在上面工作的那台機器設定好。

:::plain 三種安裝方式，該選哪一個
這一頁有三種安裝方式，差別在於「誰負責執行 agent」：

- **命令列（`t3`）**：在這台機器上啟動 server，並開啟網頁版介面。
- **桌面版 app**：app 裡內建了一個 server，裝好就能在這台電腦上執行 agent。
- **手機版 app**：手機本身不執行 agent，它連到另一台機器上的 server。

所以至少要有一台電腦裝了命令列版或桌面版，手機版才有東西可以連。
:::

## 需求 {#requirements}

開始 Thread 之前，需要有一個已安裝、已通過驗證的 Provider。你可以先啟動 T3 Code，之後再設定 Provider。

## 命令列 {#command-line}

```bash
curl -fsSL https://t3.codes/install.sh | sh
```

Windows 請在 PowerShell 執行：

```powershell
irm https://t3.codes/install.ps1 | iex
```

這會把 `t3` 放進 `~/.local/bin`。如果之後 shell 回報 `command not found`，代表這個目錄還沒加進你的 `PATH`；安裝程式會印出要加的那一行。設定 `T3CODE_CHANNEL=nightly` 可以安裝 nightly 版本線，設定 `T3CODE_VERSION` 則可以鎖定某個確切的版本。

:::example 安裝 nightly 版，以及補上 PATH
`T3CODE_CHANNEL` 是給安裝腳本讀的環境變數，所以在 macOS、Linux 上要寫在管線右邊的 `sh` 前面，而不是 `curl` 前面：

```bash
curl -fsSL https://t3.codes/install.sh | T3CODE_CHANNEL=nightly sh
```

PowerShell 則是先設定環境變數再執行：

```powershell
$env:T3CODE_CHANNEL = "nightly"
irm https://t3.codes/install.ps1 | iex
```

`T3CODE_VERSION` 的用法相同。

如果裝完之後出現 `command not found`，在 macOS、Linux 上常見的做法是把下面這一行加進 shell 的設定檔（例如 `~/.zshrc` 或 `~/.bashrc`），然後重新開一個終端機：

```bash
export PATH="$HOME/.local/bin:$PATH"
```
:::

| 要做的事                                 | 指令                                                       |
| ---------------------------------------- | ---------------------------------------------------------- |
| 啟動 server 並開啟網頁版 app             | `t3`                                                       |
| 啟動 server，但不開瀏覽器                | `t3 serve`                                                 |
| 讓它在背景持續執行（macOS、Linux）       | `t3 service install`（[詳細說明](./background-service.md)） |
| 更新到最新的版本                         | `t3 update`                                                |
| 把它移除                                 | `t3 uninstall`                                             |

完整的指令說明請執行 `t3 --help`。

如果只想試用一次 T3 Code、不想安裝，可以改為執行 `npx t3@latest`（`npx` 需要 Node.js）。

### Intel Mac {#intel-macs}

Intel Mac 沒有 `t3` 執行檔（桌面版 app 則有提供）。要在 Intel Mac 上執行 server，請用 Node.js 24 和 `vp` 從原始碼建置（[安裝 vp](https://github.com/pingdotgg/t3code#install-vp)）：

```bash
git clone https://github.com/pingdotgg/t3code
cd t3code && vp i && vp run build:desktop
node apps/server/dist/bin.mjs
```

`t3 update` 和背景服務都不適用於用這種方式執行的 server；要更新時請用 `git pull` 再重新建置。

## 桌面版 app {#desktop-app}

從 [GitHub Releases](https://github.com/pingdotgg/t3code/releases) 下載發行版，或是使用套件管理工具：

| 平台               | 安裝方式                           |
| ------------------ | ---------------------------------- |
| Windows            | `winget install T3Tools.T3Code`    |
| macOS              | `brew install --cask t3-code`      |
| Debian、Ubuntu     | `sudo apt install ./T3-Code-*.deb` |
| Arch Linux         | `yay -S t3code-bin`                |
| Arch Linux nightly | `yay -S t3code-nightly-bin`        |

`.deb` 版和其他桌面版一樣會自行更新。每次安裝更新時，它都會要求你輸入密碼。如果你的桌面環境沒有密碼輸入提示，更新就會失敗。這時請下載新的 `.deb`，用同樣的方式安裝。

### Windows Subsystem for Linux {#windows-subsystem-for-linux}

在 **Settings → Connections** 選擇一個 WSL distro，就可以在裡面執行 agent 和專案。Provider 的 CLI 要安裝在那個 distro 裡面。T3 Code 會自動在裡面安裝它自己的 server runtime；app 更新之後第一次啟動，可能會花比較久的時間。

### 從終端機開啟專案 {#open-a-project-from-a-terminal}

在同一台機器上的桌面版 app 已經執行的情況下：

```bash
t3 app
```

這會為目前所在的目錄開一個新 Thread，必要時會順便把這個專案加進來。傳入一個路徑（例如 `t3 app ../my-project`）就可以開啟其他目錄。這個指令需要桌面版 app，所以只有獨立執行的 server 或只有 SSH session 是不夠的。如果指令連不上 app，請啟動或更新桌面版 app 之後再試一次。

## 手機版 app {#mobile-app}

從 [App Store](https://apps.apple.com/us/app/t3-code-remote-claude-more/id6787819824) 或 [Google Play](https://play.google.com/store/apps/details?id=com.t3tools.t3code) 安裝 T3 Code。手機連的是另一台機器上的 server。請依照[遠端存取](./remote-access.md)的說明，透過 T3 Connect 或配對 URL 把手機連上去。

Nightly 版需要搭配 beta 版 app，商店裡的 app 連不上 nightly 版。Nightly 版也會在 **Settings → General → Mobile app** 把以下這些連結顯示成 QR code。

- **iPhone 與 iPad**：加入 [TestFlight beta](https://testflight.apple.com/join/XgaxaRtd)。
- **Android**：加入 [beta 群組](https://groups.google.com/g/t3-code-v2-beta)。再用同一個 Google 帳號開啟 [Google Play 測試頁面](https://play.google.com/apps/testing/com.t3tools.t3code)，成為測試人員。

如果 app 在啟動過程中當掉，請在下一次成功啟動時開啟 Settings → Diagnostics。那裡會列出最近 7 天的啟動當機紀錄，附上商店的當機報告裡沒有的錯誤訊息和 component stack。請複製這份報告，貼到 GitHub issue 裡。錯誤訊息可能會引用 app 裡的資料，所以分享之前請先自己看過一遍。

## Providers {#providers}

在網頁版或桌面版 app 開啟 **Settings → Providers**，選擇 environment，再啟用你要的 Provider。安裝、登入和設定都屬於那個 environment 所在的機器，即使你是從手機或另一台電腦連線也一樣。

:::screenshot settings-providers
**Settings → Providers** 頁面，上方可以選擇 environment，下方列出各個 Provider 的卡片與啟用狀態。
:::

| Provider    | 安裝與驗證                                                                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex       | [用 ChatGPT 連接](./providers-codex.md#connect-with-chatgpt)，或是安裝 [Codex CLI](https://developers.openai.com/codex/cli) 後執行 `codex login`。           |
| Claude      | 安裝 [Claude Code](https://claude.com/product/claude-code)，然後執行 `claude auth login`。                                                                  |
| Cursor      | 安裝 [Cursor CLI](https://cursor.com/cli)，然後執行 `agent login`。                                                                                         |
| Grok Build  | 安裝 [Grok Build CLI](https://x.ai/cli)，然後執行 `grok login`。                                                                                            |
| OpenCode    | 安裝 [OpenCode](https://opencode.ai)，然後執行 `opencode auth login`。                                                                                      |
| Antigravity | 在 T3 Code 的 Provider 設定裡安裝，並用 Google 帳號登入。                                                                                                   |
| Pi          | 安裝 [Pi](https://pi.dev)，然後執行一次 `pi`，完成它的登入或 API key 設定。                                                                                 |

Provider 的 CLI 必須在 server 的 `PATH` 上。如果 T3 Code 找不到某個 CLI，請在 Provider 設定裡指定它的 **Binary path**（執行檔路徑），使用版本管理工具時尤其需要。Cursor 的執行檔叫做 `cursor-agent`，不過它的登入指令是 `agent login`。透過 ChatGPT 連接的 Codex 以及 Antigravity，可以使用它們受管理的 runtime，不需要 `PATH` 裡有對應的項目。

:::example T3 Code 找不到已經裝好的 CLI
先在 server 那台機器的終端機確認 CLI 實際裝在哪裡。以 Claude 為例，在 macOS、Linux 上執行：

```bash
which claude
```

把印出來的完整路徑填進該 Provider 設定裡的 **Binary path**。Cursor 要查的是 `cursor-agent`，不是 `agent`。
:::

當某個 Provider 版本和你使用的 T3 Code 版本有已知的相容性問題時，T3 Code 會提出警告。請到那個 environment 的 **Settings → Providers** 查看建議的版本或版本範圍。如果它的套件管理工具支援安裝指定版本，可以直接在那裡安裝建議的版本。否則請在 environment 所在的機器上使用 Provider 自己的安裝程式。沒有列出來的版本代表尚未驗證。

當某個 Provider CLI 比它的最新版本舊時，它的 Provider 卡片會顯示可用的版本。只有在 T3 Code 能判斷這個 CLI 是由哪個安裝工具管理時（CLI 自己的更新指令、Homebrew，或是全域的 npm、pnpm、bun、Vite+ 安裝），才會出現 **Update now**，按下後執行的就是那個安裝工具。其他情況請用你當初安裝的方式更新 CLI。用 Homebrew 安裝的會和 Homebrew 提供的版本比較，而那個版本可能比 npm 上的版本晚幾個小時。

需要另一個帳號或另一組設定時，可以再新增一個 Provider instance。每個 instance 可以有自己的環境變數，例如 API key 或自訂的 base URL。請把機密的值標記為 sensitive；儲存之後，T3 Code 就不會再顯示它們原本的值。

各 Provider 專屬的設定與帳號說明，請看 [Codex](./providers-codex.md)、[Claude](./providers-claude.md)、[OpenCode](./providers-opencode.md)、[Antigravity](./providers-antigravity.md) 和 [Pi](./providers-pi.md)。

## 接下來 {#next-steps}

- [使用 Thread](./thread-sidebar.md)：開始任務，並整理同時進行的工作。
- [權限模式](./permission-modes.md)：選擇 agent 在什麼時候要先問過你才動作。
- [遠端存取](./remote-access.md)：從另一台裝置連線。
- [在背景執行](./background-service.md)：讓 Linux 或 macOS 主機保持可用。
- [更新 T3 Code](./updating.md)：更新 app 和已連線的 server。
