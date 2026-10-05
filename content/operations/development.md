---
title: 開發
source: docs/operations/development.md
source_hash: b7e1b257d0b2f00959a1ea865e8c6e7a82f33e05
---

:::note 打算送 PR 的話，先讀貢獻指南
這個專案目前沒有積極徵求外部貢獻，review 的人力也有限。範圍集中的 bug 修正、可靠性修正、效能改善和維護工作最有機會被接受；新功能或刻意改變產品行為，則需要先經過討論並取得維護者明確的核准。動手之前請先讀 [CONTRIBUTING.md](../../CONTRIBUTING.md)。
:::

## 第一次 checkout {#first-checkout}

依照 [root README](../../README.md#install-vp) 安裝 `vp`。這個 checkout 需要 Node 24；Bun 是選用的。在 repository 根目錄執行：

```sh
vp i
vp run dev
```

開啟 dev runner 印出來的 pairing URL。只有 origin、不帶其他資訊的網址，沒辦法讓新的瀏覽器通過驗證。

:::plain 這兩個指令在做什麼
`vp` 是 Vite+ 的全域指令列工具，T3 Code 用它來安裝相依套件和執行各種工作。`vp i` 安裝相依套件；`vp run dev` 啟動 server 和 web。啟動後不要直接開只有主機名稱和 port 的網址（也就是 bare origin），要開終端機裡印出來的那個完整 pairing URL，新的瀏覽器才會通過驗證。
:::

比較想用 container 嗎？VS Code 與 Codespaces 的設定方式見 [Dev container](../internals/devcontainer.md)。

## 選擇要跑哪個開發行程 {#choosing-a-dev-process}

要跑 server 和 web 就用 `vp run dev`，要跑 Electron client 就用 `vp run dev:desktop`。`dev:server` 和 `dev:web` 會分別單獨啟動這兩個行程。原生 build 與 Metro 請看 [mobile README](../../apps/mobile/README.md)。

旗標直接接在 task 名稱後面，例如 `vp run dev --home-dir /tmp/t3code-dev`。加上 `--browser` 會自動開啟瀏覽器。

### 狀態與 port {#state-and-ports}

Linked worktree 預設使用它自己的 `.t3/userdata`，就算設定了 `T3CODE_HOME` 也一樣。主要的 checkout 預設使用 `~/.t3/dev/userdata`。明確指定的 `--home-dir` 在兩種情況下都優先。絕對不要讓開發用的 server 對著正式使用中的 `~/.t3/userdata` 執行。要複製一份一致的資料庫 snapshot，請看[測試資料](../../AGENTS.md#test-data)。

:::note 為什麼不能碰 `~/.t3/userdata`
`~/.t3/userdata` 是你平常在用的 T3 Code 的真實資料庫。讀它、從它複製資料都沒問題，但不要讓開發用的 server 直接對著它啟動，也不要去清理它。需要真實的測試資料時，先停掉 dev server，再執行 `vp run migrate-dev-db`：它會從 `~/.t3/userdata/statev2.sqlite` 的唯讀 snapshot，重建出 worktree 自己的 `.t3/userdata/statev2.sqlite`。
:::

Port 請從 `[dev-runner]` 的輸出讀取。Worktree 會從自己的路徑推導出穩定的偏好 port，但被佔用的 port 會讓它們位移。需要時，可以用 `T3CODE_PORT_OFFSET` 或 `T3CODE_DEV_INSTANCE` 選擇不同的偏好值。

### 分享與遠端除錯 {#sharing-and-remote-debugging}

`vp run dev --share` 會把 web 的 port 發佈到這台機器的 tailnet 上，並印出對應那個 origin 的 pairing URL。請把完整的 URL（包含裡面的 token）交給測試的人。Dev runner 結束時會移除它建立的對應。

`VITE_HTTP_URL` 和 `VITE_WS_URL` 請保持未設定。Vite 會透過瀏覽器的 origin 代理 backend，所以同一個 build 在 localhost 和遠端連線下都能運作。

:::note 設了這兩個變數會怎樣
開發模式是單一 origin，Vite 會代理 `/api`、`/ws`、`/oauth` 和 `/.well-known`。一旦設定了 `VITE_HTTP_URL` 或 `VITE_WS_URL`，localhost 就會被寫死進 bundle 裡，從遠端瀏覽器連進來時會壞掉，而且不會有任何錯誤提示。
:::

分享模式會啟用 bundled dev，避免每一層 import 都要多一次網路來回。要除錯 bundler 之間的差異時，可以用 `T3CODE_BUNDLED_DEV=0` 關掉它。修改這套設定時，有兩個和 reload 有關的陷阱要注意：

- Web 的進入點必須用 dynamic import 載入 app，這樣 React refresh 才會在應用程式的 chunk 之前完成初始化。Static import 可能在第一次載入時正常，卻在 route 拆分之後失敗。
- Bundled dev 是透過監看檔案來重新 build Tailwind 的。Tailwind 一般的 Vite hot-update hook 需要 server／module graph，而 Rolldown 並不提供。

這些因應做法放在 [web 進入點](../../apps/web/src/bootstrap.ts)和 [Tailwind plugin](../../apps/web/vite/tailwind.ts) 裡。

#### 可重複使用的開發憑證 {#reusable-dev-credential}

只在你信任上面每一個服務的 hostname 上使用這個功能。瀏覽器會把 cookie 送給該 hostname 上的所有 port。你在那個 hostname 上造訪的任何服務，都可能收到這個可重複使用的管理員憑證，包括和 T3 Code 無關的服務。如果你在那個 hostname 上有執行不受信任的服務，請維持一般的做法，每個 environment 各自配對。

要讓同一個瀏覽器 profile 在同一個 hostname 上的多個 web dev worktree 之間通用，先產生一個固定的值，只需要做一次：

```sh
openssl rand -hex 32
```

把這個值放進主要 checkout 裡那個被 gitignore 的 `.env`：

```dotenv
T3CODE_DEV_AUTH_TOKEN=<the value generated above>
```

`t3.json` 的 Setup Worktree 動作會把那個檔案連結到每個 worktree 的 `.env`。Dev runner 在啟動時讀取 repository 的 env 檔案。`.env.local` 和繼承而來的行程環境變數會蓋過 `.env`，所以設定好之後，不需要在每個 worktree 裡另外 export。

如果是手動建立的 worktree，或是沒有這個連結的 launcher，就改成 export 同一個固定值：

```sh
export T3CODE_DEV_AUTH_TOKEN="<the value generated above>"
```

不要在每次啟動時產生新的值。設定完成後，啟動或重新啟動 `vp run dev --share`，然後在那個 hostname 上，每個瀏覽器 profile 各開啟一次它在啟動時印出的 pairing URL。之後同一個 hostname 上的其他 web dev server，就會跨 port 接受這個共用的 cookie。Cookie 會在 30 天後過期。如果某個舊分頁的 URL 現在對應到的是替換過的 environment，請重新載入那個分頁。

這個 token 和啟動時的 pairing URL 都是可重複使用的管理員等級 secret。絕對不要把它們放進 commit、pull request 或任何公開的輸出。每個 server 仍然會在啟動時寫入自己的驗證資料庫紀錄，並保有自己的 SQLite 資料、簽章金鑰和撤銷狀態。桌面版和非開發用的 server 會忽略這個值。安全模型請看 [environment 驗證](../internals/environment-auth.md#reusable-dev-credential)。

## 檢查 {#checks}

針對你改到的檔案和套件執行檢查：

```sh
vp test run <files>
vp lint <files>
vp run --filter <package> typecheck
```

:::example 只檢查自己改到的範圍
假設你改了 `apps/web` 底下的一個檔案和它的測試，把 `<files>` 換成那些檔案的路徑、`<package>` 換成那個套件的名稱即可。不需要為了送 PR 而在本機跑整個 repo 的檢查；完整的檢查由 CI 負責。PR 裡要寫的是你怎麼確認問題存在、怎麼檢查這次修改、觀察到什麼結果，只寫一句「測試通過」是不夠的。
:::

改到原生 mobile 的部分時，使用 `vp run lint:mobile`。完整的測試由 CI 負責；目前有哪些 job 請看 [ci.yml](../../.github/workflows/ci.yml)。在 Windows 測試還不是必要關卡的期間，可以用[手動的 Windows lane](../../.github/workflows/windows-tests.yml) 針對 Windows 做重點調查。

### 未使用的程式碼 {#unused-code}

`vp run knip:check` 會先檢查整個 repo 裡未使用的檔案和相依套件，再檢查 `apps/server`、`apps/desktop`、`apps/web`，以及 `packages/` 底下每一個內部套件裡未使用的 runtime export。CI 會強制執行這兩項檢查。匯出的型別和 Effect schema 即使沒有被使用也是允許的。Schema preprocessor 認得 schema 型別，包括 alias 和 schema class；用來建立或解碼 schema 的函式則仍然會被檢查。標準的 Effect service 建構 API 會維持匯出，並加上明確的 `@public` 註記，Knip 認得這個註記。完全沒被用到的檔案同樣仍然會被檢查。Web UI 元件模組裡的 named export 會被當成完整的元件組合保留下來。Knip 會忽略 `apps/web/src/components/ui/*.tsx` 裡未使用的 export，但整個檔案都沒被用到時仍然會回報。用 `vp run knip --workspace apps/web` 可以稽核單一個 workspace（包含 export），用 `vp run knip:production --workspace apps/web` 可以找出只靠測試才沒被判定為無用的程式碼。完整的 export 稽核目前仍然有待處理的項目，所以不是整個 repo 的 CI 關卡。隨著更多 workspace 清理乾淨，請擴充 export 檢查的 workspace 選擇器。刪除程式碼之前請先檢視呼叫端；production 模式也可能回報開發用的腳本和測試用的 fixture。在 runtime 才被發現的進入點，以及相依套件的例外，請寫在 [knip.jsonc](../../knip.jsonc) 裡。

## 桌面版 artifact {#desktop-artifacts}

本機 build 出來的 artifact 預設不簽章，並寫到 `release/`：

```sh
vp run dist:desktop:dmg
vp run dist:desktop:linux
vp run dist:desktop:win
```

DMG 預設使用 host 的架構。用 `--arch` 選擇其他目標，用 `--keep-stage` 保留打包過程的檔案以便檢查。其他選項請執行 `vp run dist:desktop:artifact --help`。

### Linux AppImage 的前置需求 {#linux-appimage-prerequisites}

請在 Linux 上 build，因為 browser-secret helper 會連結到 host 的 libsecret。安裝 Rust、C/C++ build 工具、libsecret 的開發用 header、pkg-config 和 ImageMagick。

Ubuntu 與 Debian：

```sh
sudo apt-get update
sudo apt-get install cargo rustc build-essential libsecret-1-dev pkg-config imagemagick
```

Fedora：

```sh
sudo dnf install rust cargo gcc gcc-c++ make libsecret-devel pkgconf-pkg-config ImageMagick
```

Arch Linux：

```sh
sudo pacman -S rust base-devel libsecret pkgconf imagemagick
```

在 Linux 上做桌面版開發，同樣需要 C toolchain、pkg-config 和 libsecret 的 header。

### macOS DMG 的前置需求 {#macos-dmg-prerequisites}

用 `xcode-select --install` 安裝 Xcode Command Line Tools，並安裝 Rust。要做跨架構或 universal build 時，加入需要的 Rust target：

```sh
rustup target add aarch64-apple-darwin x86_64-apple-darwin
```

### Windows 安裝程式的前置需求 {#windows-installer-prerequisites}

安裝 Rust、Python 3，以及包含 **Desktop development with C++** 的 Visual Studio Build Tools。要包含 Windows SDK，以及目標架構的 MSVC build 工具和 Spectre-mitigated 函式庫。加入對應的 Rust target：

```powershell
rustup target add x86_64-pc-windows-msvc
# For an ARM64 installer:
rustup target add aarch64-pc-windows-msvc
```

NSIS 會由 electron-builder 下載。要支援 WSL，還需要用 `--wsl-runtime` 傳入 Linux CLI archive；見[發版 runbook](./release.md#windows-payload-topology-and-update-validation)。

### 簽章與 passkey {#signing-and-passkeys}

依照[發版 runbook](./release.md) 設定好平台憑證之後，加上 `--signed`。macOS 的 passkey 需要一個已簽章、已 provision 的 app；本機簽章與 renderer HMR 的做法請照 [Connect 設定](./connect-setup.md#desktop-passkeys)進行。
