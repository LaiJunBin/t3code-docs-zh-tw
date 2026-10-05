---
title: Dev container
source: docs/internals/devcontainer.md
source_hash: 60eb602a9024c6f61271bfc77841e9ab1095621c
---

> 這一頁是寫給維護者的。如果你是 T3 Code 的使用者，請看 [docs/user](../user/)。

`.devcontainer/` 提供一個開箱就能寫程式、而且和 CI 一致的 Linux 環境：Ubuntu 24.04、Node 24、pnpm、Rust stable、全域的 `vp` CLI，以及 GitHub CLI。用 VS Code 開啟這個 repo 並選擇「Reopen in Container」，或是建立一個 GitHub Codespace。相依套件安裝（`vp i`）、Electron 執行權限位元（exec-bit）的修復，以及 Vite 相依套件快取的預熱，都會在你連進去之前自動執行。

## 在 container 裡可以做的事 {#what-works-in-the-container}

- 完整的開發 stack：執行 `vp run dev`，然後透過轉送的 web 連接埠（5733）開啟它印出來的配對 URL。沒有配對 token 的話，光是那個 origin 本身沒有用。在 VS Code 裡，轉送的連接埠是真正的 localhost，所以印出來的 URL 可以直接使用；在瀏覽器版的 Codespaces 裡，轉送後的 origin 會不一樣，如果 server 拒絕它，請用 `T3CODE_DEV_ALLOWED_ORIGINS` 把轉送後的 origin 傳進去。
- Linux CI job 會執行的所有項目：針對特定檔案的 `vp test run <files>`、`vp lint <files>`、各 package 的型別檢查、`vp run build:desktop`，以及 resource-monitor 的 cargo build 和測試。（這裡的 PATH 上沒有 `vpr`；curl 安裝程式只替 `vp` 建立 shim。請使用 `vp run <script>`，或是在安裝之後使用 `node_modules/.bin/vpr`。）

:::note 要開的是「配對 URL」，不是連接埠本身
`vp run dev` 啟動後會印出一個帶有配對 token 的 URL。請直接開那個 URL。只開轉送出來的 5733 連接埠（不帶 token）是無法通過驗證的。
:::

## 狀態與安全 {#state-and-safety}

`T3CODE_HOME` 指向 workspace 裡被 gitignore 的 `.t3`，所以所有執行期狀態都留在 container 的 workspace 內，和 worktree 的預設行為一致。Container 裡沒有正式安裝的環境可以被弄壞，但 AGENTS.md 裡關於測試資料的規則仍然適用：把資料複製進來，絕對不要指向共用的狀態。

## 快取 {#caching}

兩個具名 volume 讓重建維持快速，也讓安裝不必落在緩慢的 macOS / Windows bind mount 上：一個是 pnpm store（跨 checkout 共用，掛載在 `vp i` 存放它的位置），另一個是根目錄的 `node_modules`（每個 container 各自一份；因為 workspace 的各個 package 只是 symlink 進去，所以它涵蓋了整個 `.pnpm` virtual store）。刪掉 container 再重新建立時，這兩個 volume 都會被重複使用，所以重建時的 `vp i` 只需要幾秒，而不是幾分鐘。Host 端看到的 `node_modules` 是空的；原本在 host 端跑的工具，請改在 container 裡執行。

:::plain 為什麼 host 上的 node_modules 是空的
`node_modules` 放在 Docker 的 volume 裡，不是放在從你電腦掛進去的那個資料夾裡。所以從 container 外面看，這個資料夾是空的。好處是安裝不必經過緩慢的 bind mount，而且 container 砍掉重建之後套件還在；代價是需要用到 `node_modules` 的工具，都得在 container 裡面跑。
:::

## 不在範圍內 {#out-of-scope}

- 有視窗的 Electron 開發只能在 host 上進行。在 container 裡建置並驗證 desktop bundle 沒有問題（CI 正是以 headless 的方式這麼做）；但要啟動 app 就需要顯示器。
- 手機的原生建置只能在 host 上進行（iOS 用 Xcode，Android 用 Android SDK）。型別檢查、lint 和手機的靜態檢查都可以正常執行。
- `vp run dev --share` 需要 tailscale 執行檔和一個 tailnet；這裡沒有配置。

## Prebuild {#prebuilds}

從零開始建立 container 時，要做一次完整的 `vp i`，再加上各個工具鏈的安裝，所以值得預先建置。Codespaces 的 prebuild 是在 repo 設定裡調整的，不是用檔案，而且會原樣採用這份設定：比較重的步驟放在 `onCreateCommand` 和 `updateContentCommand` 裡，prebuild 會把它們預先做好。請把 prebuild 限制在一個區域、只保留一個版本；儲存空間是依「每個區域、每個版本」計費的。要注意，prebuild 的 snapshot 不包含那些快取用的 volume，所以以 prebuild 為主的工作流程，可能會傾向把那些 mount 拿掉。在 Codespaces 之外，可以用 Dev Container CLI 推送一個預先建置好的 image：

```bash
devcontainer build --workspace-folder . --push true --image-name <registry>/t3code-devcontainer:latest
```
