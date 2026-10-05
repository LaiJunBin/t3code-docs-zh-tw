---
title: 發版檢查清單
source: docs/operations/release.md
source_hash: d0da6154512819a1db77f7e08344fd10e6323260
---

> 這一頁是寫給維護者看的。如果你是 T3 Code 的使用者，請看 [docs/user](../user/)。

這份文件說明 stable 與 nightly 桌面版發版共用的同一套 release workflow。

## 這個 workflow 做了什麼 {#what-the-workflow-does}

- Workflow：`.github/workflows/release.yml`
- 觸發方式：
  - 手動 `workflow_dispatch` 並指定 `channel=stable`，這是發 stable 的一般做法。Stable 和 nightly 的 dispatch 必須選 `main`；preview 可以選任何分支。Channel 的預設值是 preview，所以就算漏選，也不會發出 stable 版本。
  - push 符合 `v*.*.*` 的 tag，用來針對某個明確指定的 commit 發 stable 版本
  - 排程的 nightly 檢查，每 30 分鐘一次
  - 手動 `workflow_dispatch` 並指定 `channel=nightly`
  - 手動 `workflow_dispatch` 並指定 `channel=preview`，這是維護者的測試列車（test train）。它會針對一個絕對不可以讓終端使用者收到的 commit，把整個發版流程（build、簽章、notarize、smoke、發佈）實際跑一遍；還沒 merge 的分支或有風險的變更，就是靠這個方式在進 `main` 之前先跑過一次真正的發版。它用 nightly 的版號規則來 build 觸發它的那個 commit，prerelease 識別字是 `preview`（`0.0.41-preview.<date>.<run>`），並且發佈一個 GitHub prerelease，以及掛在 `preview` dist-tag 底下的 npm 套件。Preview 不在排程裡，沒有任何預設的 npm dist-tag 指向它，它的桌面版 build 不帶更新來源（update feed），也不會附上任何 updater manifest（`latest*.yml`、`nightly*.yml`、blockmap），所以 stable 或 nightly 的安裝不會被提示更新到它。要裝到 preview 只有這幾種方式：手動下載該 release、`npx t3@preview`、對安裝腳本設定 `T3CODE_CHANNEL=preview`，或是在終端機執行 `t3 update --channel preview`；每一種都會印出警告，而且當目前執行中的 build 本身不是 preview 時，CLI 會要求確認。這個 release 本身的名稱會標明是維護者測試 build，內文是一段警告而不是自動產生的 release notes：未 merge 分支的歷史所組成的 changelog 不算是 changelog；nightly 和 stable 的 notes 不受影響，因為每個系列都只在自己的 channel 裡找前一個 tag。Hosted web app、AUR 和 Discord 公告都會跳過。請保留這個機制；閒置時它不花任何成本。
- 手動發 stable 時，build 的是「最新一個已發佈 nightly」的那個 commit，而不是 `main` 的 HEAD。Nightly 就是 release candidate：先驗證 nightly，再把它升級（promote）成 stable。在你驗證的期間，merge 會繼續進到 `main`，但絕對不會混進 stable 的 build。
  - 版號預設是 nightly 預告的那個版號（`0.0.39-nightly.*` 會以 `0.0.39` 發出）。要覆寫的話傳入 `version` input，例如要升 minor 版號時。
  - Stable tag 會在 GitHub Release 發佈時，建立在 nightly 的那個 commit 上。
  - 手動 push 一個 `vX.Y.Z` tag 的做法仍然可用，而且 build 的就是被 tag 的那個 commit。當要發的 commit 不是最新的 nightly 時用這個方式，例如 release 分支上 cherry-pick 進來的修正。
- 在 build artifact 的同時執行 lint、typecheck 和測試。發佈會等所有檢查都完成。
- 在打包各個 client 之前，先讀取共用的 production T3 Connect relay URL 與 Clerk client 設定。
- 與平台無關的 JS（server bundle、web client、Electron main）只在 `build_bundle` job 裡 build 一次，然後以 `js-bundle` artifact 的形式交給每個平台 job；平台 job 只負責打包，所以沒有任何 runner 會重新 build 它。
- 兩個 channel 都會平行 build 六個桌面版 artifact，每一個都是獨立的 job（`desktop_<platform>_<arch>`，各呼叫一次 `release-desktop.yml`），跑在與目標相同架構的硬體上，而且只需要等 bundle 完成。Windows 的 job 會把相同架構的 Linux CLI archive 內嵌進去當作 WSL runtime，它們在執行到一半時等的是那個 artifact，而不是整個 Linux job：
  - macOS `arm64` DMG
  - macOS `x64` DMG
  - Linux `x64` 與 `arm64` 的 AppImage 和 `.deb`，由同一次 electron-builder 執行產生。`.deb` 透過 electron-updater 在 app 內更新，electron-updater 會用 `dpkg` 安裝它。
  - Windows `x64` 與 `arm64` 的 NSIS 安裝程式
- 發佈一個 GitHub Release，包含所有產生出來的檔案。
  - 在 `X.Y.Z` 後面帶有後綴的 stable tag（例如 `1.2.3-alpha.1`）會發佈成 GitHub prerelease。
  - 只有單純的 stable `X.Y.Z` 版本會被標記為 repository 的 latest release。
  - Nightly 一律是 GitHub prerelease，絕對不會被標記為 latest。
  - 自動產生的 release notes 會固定以同一個 channel 的前一個 tag 為比較基準，所以 stable 是跟前一個 stable tag 比，nightly 是跟前一個 nightly tag 比。
- Release 的檔案裡包含 Electron 自動更新的 metadata（例如 `latest*.yml`、`nightly*.yml` 和 `*.blockmap`）。
- 每個平台各 build 一個自給自足的 CLI archive（`t3-<version>-<platform>-<arch>.tar.gz`，Windows 上是 `.zip`），和該目標的桌面版 artifact 在同一個 job 裡 build，並連同一個 `SHA256SUMS` 檔案附加到 GitHub Release 上。每個 channel 都會做，共五個目標：macOS arm64、Linux x64 與 arm64、Windows x64 與 arm64。每個 archive 都是在與自己相同架構的硬體上 build、簽章並做 smoke test。沒有 macOS x64 的 archive：x64 macOS 不支援 Node single-executable（SEA 文件只把 macOS 列為 arm64），而且那個 binary 一啟動就會 segfault；x64 的桌面 app 是 Electron，不受影響。
  - 這個 archive 裡的 server 是一個 Node single-executable（`scripts/build-cli-archive.ts`），所以解開它不需要 Node、npm，也不需要編譯器。T3 Code 管理 runtime 時只用這一種形式：桌面版的 SSH environment、開機服務（boot service）、`t3 update` 和安裝腳本，全都是下載這個 archive 並對照 `SHA256SUMS` 驗證。npm 套件是給自己執行 `npx t3` 或 `npm install -g t3` 的人用的，內容與 archive 相同；產品本身沒有任何地方是從 npm 安裝的。`curl | sh` 的安裝程式是 `scripts/install.sh` 和 `scripts/install.ps1`；marketing 網站在 build 時把它們複製到自己的 `public/`（`apps/marketing/scripts/stage-install-scripts.mjs`），並在 `t3.codes/install.sh` 和 `/install.ps1` 提供下載。
  - 這個執行檔是用支援 `--build-sea` 的 Node 來 build 的（`VP_NODE_VERSION=26.8.2`，與 `apps/server/vite.config.ts` 裡的 `SEA_NODE_VERSION` 保持一致），而 repo 本身仍然維持在 `engines.node` 指定的版本。
  - 有 Apple secrets 時，macOS 的 archive 會用 Developer ID 憑證簽章並 notarize（沒有的話就用 ad hoc 簽章，透過 `curl`/`tar` 安裝時仍然可以執行）。Windows 的執行檔使用和安裝程式相同的 Azure Trusted Signing 設定。macOS archive 裡的每一個原生 addon 也都會簽章，因為 hardened runtime 會拒絕載入未簽章的函式庫。
  - 每個 archive 在上傳之前，都會先在 build 它的 runner 上解開並實際執行（`scripts/smoke-cli-archive.ts`）。
- 在同一個 workflow 檔案裡，以 OIDC trusted publishing 把 CLI 發佈到 npm，內容與 GitHub Release 上的是完全相同的位元組：`scripts/build-npm-platform-packages.ts` 把五個 CLI archive 解開成 `@t3code/t3-<platform>-<arch>` 套件（每個都設定了 `os`/`cpu`，所以 npm 只會安裝符合的那一個），並產生 `t3` launcher；launcher 的 `bin/t3.js` 把這些套件列為 `optionalDependencies`，並 exec 已安裝的執行檔。因此 `npx t3` 只需要 Node 來執行 launcher，執行 server 完全不需要。`node apps/server/scripts/cli.ts publish` 會先發佈各平台套件，最後才發佈 launcher；在這之前會先對全部套件跑一輪 `--dry-run`，這樣驗證或 scope 的錯誤會在任何東西上線之前就失敗。
  - stable 版本發佈到 npm dist-tag `latest`
  - nightly 版本發佈到 npm dist-tag `nightly`
  - preview 版本發佈到 npm dist-tag `preview`，除非指名要求，否則沒有任何東西會解析到它
  - 一次性設定：npm 上必須有 `@t3code` 這個 scope（org），而且 `t3` 和每一個 `@t3code/t3-<platform>-<arch>` 套件都要為這個 workflow 檔案註冊一個 trusted publisher（見下方）。
- 在桌面版 job 執行的同時，於 Vercel 上 build hosted web app，並且只在 release 發佈之後才讓它上線：
  - stable 版本會被 alias 到 hosted app 的 `latest` channel
  - nightly 版本會被 alias 到 hosted app 的 `nightly` channel
- 簽章是選用的，會依各平台的 secrets 自動偵測。

:::plain 三個 channel 的差別
- **stable**：給一般使用者的正式版。手動發 stable 時，build 的是最新一個已發佈 nightly 的 commit，所以流程是「先驗證 nightly，再把它升級成 stable」。
- **nightly**：排程自動發出的 prerelease，同時也是 stable 的 release candidate。
- **preview**：維護者用來測試發版流程本身的 channel。它會真的發佈，但只有指名要求的人才會裝到。

三者跑的是同一個 workflow，差別在版號、發佈到哪個 npm dist-tag，以及哪些後續步驟會執行。
:::

## Pull request 的 macOS 預覽版 {#pull-request-macos-previews}

在 PR 加上 `preview:mac` label，會發佈一個已簽章、已 notarize、啟用 T3 Connect 的 Apple Silicon DMG 到滾動更新的 `desktop-preview` prerelease，fork 來的 PR 也適用。這個 label 是針對「加上 label 當下的那個 commit」的一次性請求：受信任的 workflow 拿到 build 之後就會移除它，之後的 push 不會再 build，直到維護者重新加上 label。因此每一個已簽章的預覽版，都是維護者針對單一 commit 做的決定；這一點很重要，因為產出物帶有 Developer ID 簽章。為某位貢獻者 vouch，代表他被加上 label 的 commit 可以被簽章；這並不是長期有效的授權。Build 被拆成兩段，讓 Developer ID 憑證絕對不會和 PR 的程式碼出現在同一個 job 裡：

- `.github/workflows/desktop-macos-preview.yml` 在 `pull_request` 上執行，不帶任何 secrets，只從 PR build 出 JS bundle（和 `release.yml` 產生的 `js-bundle` artifact 相同）。
- `.github/workflows/desktop-macos-preview-publish.yml` 在 `workflow_run` 上從 `main` 執行。除非 PR 仍然開啟、仍然帶著 label、它的 head 就是被 build 的那個 commit，而且作者是 bot、collaborator，或列在 `.github/VOUCHED.td` 裡（從預設分支讀取，所以 PR 不能替自己 vouch），否則它會拒絕執行。接著它透過在 `main` checkout 出來的 `release-desktop.yml` 來打包並簽章這個 bundle，所以打包流程、原生 helper，以及 Electron／桌面版的相依套件都來自 `main`，而不是 PR。只有版號和 `.env.example` 裡公開的 T3 Connect 識別字是從 PR 的 commit 讀取的，而且是當作資料來讀，這樣簽章後 app 的 passkey entitlement 才會和 bundle 相符。會改到打包流程的 PR，必須改用上面提到的 `channel=preview` 發版列車。

把 bundle 交給負責簽章的 runner 之前，受信任的 workflow 會先驗證它的 ZIP 項目，只接受 `server/dist` 和 `desktop/dist-electron` 底下的一般檔案，以及通往這兩個根目錄的目錄項目。這個 artifact 無法覆寫打包程式碼或已安裝的相依套件。在簽章 runner 上，bundle 只會被複製進 app，絕對不會被執行。當 PR 關閉時，或是 label 在 build 用到它之前就被手動移除時，publish workflow 裡的 `pull_request_target` 清理 job 會移除下載檔；這個 job 絕對不會 checkout PR 的程式碼。

## 發版必要的憑證 {#required-release-credentials}

Stable 發版除了下面各節記載的平台與部署憑證之外，還需要這些 GitHub Actions secrets：

- `RELEASE_APP_ID`
- `RELEASE_APP_PRIVATE_KEY`

Finalize job 用它們以 Release App 的身分，把對齊後的套件版號 commit 並 push 到 `main`。GitHub Release 的發佈使用的是 repository 範圍的 workflow token，這樣它的 rate-limit 配額就和共用的 Release App installation 分開。

## T3 Connect relay 部署 {#t3-connect-relay-deployment}

Relay 是共用的 control plane，版本與 client 的發版分開管理。Stable 和 nightly 的 client build 必須指向同一個 relay，使用者切換 release channel 時才會看到相同的已連結 environment。

`.github/workflows/deploy-relay.yml` 會在每次 push 到 `main` 時部署 Alchemy 的 `prod` stage。Release workflow 在 build 桌面版、CLI 或 hosted web 的 artifact 之前，會從既有的 `production` GitHub Actions environment 讀取 relay URL 和 Clerk client 設定。

Relay 部署共用的必要 repository variables：

- `CLOUDFLARE_ACCOUNT_ID`
- `PLANETSCALE_ORGANIZATION`
- `AXIOM_ORG_ID`

Relay 部署共用的必要 repository secrets：

- `CLOUDFLARE_API_TOKEN`
- `PLANETSCALE_API_TOKEN_ID`
- `PLANETSCALE_API_TOKEN`
- `AXIOM_TOKEN`

`production` environment 必要的 variables：

- `RELAY_API_ZONE_NAME`
- `RELAY_TUNNEL_ZONE_NAME`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_JWT_AUDIENCE`
- `CLERK_JWT_TEMPLATE`
- `CLERK_CLI_OAUTH_CLIENT_ID`
- `APNS_ENVIRONMENT`
- `APNS_TEAM_ID`
- `APNS_KEY_ID`
- `APNS_BUNDLE_ID`

`production` environment 選用的 variables：

- `RELAY_DOMAIN`：要覆寫推導出來的 `relay.<RELAY_API_ZONE_NAME>` 網域時使用
- `RELAY_TUNNEL_CLEANUP_MODE`：值為 `off`、`dry-run` 或 `enabled`。沒設定或空白時使用 `off`。

`production` environment 必要的 secrets：

- `CLERK_SECRET_KEY`
- `APNS_PRIVATE_KEY`

Relay Worker 是在部署時讀取這些 variables 和 secrets 的。當只有其中一個值改變時，Alchemy 不會重新部署 Worker（[alchemy-run/alchemy#1831](https://github.com/alchemy-run/alchemy/issues/1831)），所以一次沒有改到 relay 程式碼的 `main` push，會讓舊的值繼續留著。改了其中任何一個之後，請從 `main` 手動執行 **Deploy T3 Connect relay** workflow，並勾選 **force**。

帳號範圍的 repository 憑證是 Alchemy 在佈建 relay stage 時使用的；它們不會被綁進 relay Worker。Production 部署使用的是 Axiom 的 personal access token，所以 `AXIOM_ORG_ID` 必須和 `AXIOM_TOKEN` 一起提供。`prod` stage 擁有那個被保留（retained）的 PlanetScale 資料庫。本機的個人 stage 會從它佈建出隔離的 branch，而且絕對不會由 CI 部署。Production 會把設定好的 relay API 與 tunnel DNS zone 接管（adopt）為被保留的 Cloudflare 資源。個人 stage 則是參照 production 所擁有的 zone。

開發者是在本機部署個人 stage，而不是透過 pull request 的自動化流程：

```sh
vp run --filter t3code-relay deploy -- --stage "$USER" --env-file .env.local
```

### Managed tunnel 清理機制的上線步驟 {#managed-tunnel-cleanup-rollout}

第一次 production 部署時，請讓 `RELAY_TUNNEL_CLEANUP_MODE=off`。這次部署會套用 nullable allocation 的 migration，並加入 recovery endpoint。Web 和 mobile client 不需要配合發版。CLI 和桌面版的 server build 則必須在啟用清理之前先送到使用者手上，因為這些 build 才會註冊 recovery，並且在喚醒之後替換掉已被刪除的 tunnel。

1. 以 cleanup `off` 部署 relay 和 migration。
2. 發佈 server build，並確認目前的 host 都有註冊 recovery。較舊的 host 會維持被標記為 legacy，絕對不會成為清理的候選對象。
3. 設成 `dry-run`，執行一次強制的 relay 部署，然後觀察多次 sweep 的計數器（`scanned`、`wouldDelete`、`skippedLegacy`、`skippedOrphan`、`failed`、`truncated`）。每次 sweep 都會把這些計數器連同當下生效的 `mode`，以 `relay.managed_endpoint_reaper.*` 屬性記錄在 Axiom 裡它自己的 `relay.managed_endpoint_reaper.sweep` span 上。
4. 執行下面的拋棄式 host canary 測試。
5. 只有在 canary 不需要重啟 server 就能復原之後，才設成 `enabled`。

這個 job 每五分鐘執行一次；對於失去 connector 的 tunnel 有五分鐘的寬限期，所以候選對象通常會在斷線後五到十分鐘被移除。從未連線過的 tunnel 會等一小時。一次 sweep 最多嘗試刪除 100 個，所以有積壓時會花更久。變更 `RELAY_TUNNEL_CLEANUP_MODE`（包括在事故期間把清理關掉）都需要一次強制的 relay 部署。請在下一個 sweep span 上確認新的 `mode`。

要 rollback 的話，先把 cleanup 設成 `off` 並執行一次強制的 relay 部署，之後才去降版任何 host。只要目前的 server build 還在使用中，就讓 recovery endpoint 繼續部署著。那些 nullable 欄位可以留著。

### 拋棄式 host canary 測試 {#disposable-host-canary}

這個測試還沒有對真正的 Cloudflare 帳號執行過。請用拋棄式的 relay stage、測試用的 Cloudflare 帳號、拋棄式的 host 和拋棄式的 T3 home 來執行。在它通過之前，production 的 cleanup 請維持在 `off` 或 `dry-run`。不要停掉每天在用的 T3 server。

1. 以 cleanup `dry-run` 部署拋棄式 stage。透過 web 或 mobile 的設定頁連結第一個拋棄式 environment，並確認它的 tunnel 狀態正常，而且已經註冊 recovery。
2. 停掉那台 host，然後用同一個 T3 home 在另一個本機 port 上重新啟動。確認公開的 hostname 會連到新的 port，而且不會送任何東西到舊的 port。
3. 用一個早於 recovery 註冊功能的 server build，連結第二個拋棄式 environment。記下它所管理的 `cloudflared` 子行程 PID，確認這個行程屬於那台 host，然後只暫停那一個子行程：`kill -STOP <legacy-pid>`。等到 Cloudflare 回報它已斷線超過五分鐘。
4. 從第一個 environment 的 server log 取得它的 `cloudflared` 子行程 PID，確認歸屬，然後用 `kill -STOP <first-pid>` 暫停它。等到 Cloudflare 回報它已斷線超過五分鐘。
5. 確認 dry-run 把第一個 tunnel 算進 `wouldDelete`，把第二個算進 `skippedLegacy`。
6. 在拋棄式 stage 上把 cleanup 設成 `enabled`，並用 `--force` 部署。在測試用的 Cloudflare 帳號裡確認第一個 tunnel 已被刪除，而 legacy tunnel 仍然存在。
7. 用 `kill -CONT <first-pid>` 恢復第一個子行程。確認執行中的 server 偵測到連續被拒絕、發出 recovery 請求，並且不需要重啟就能在同一個 hostname 上恢復連線。
8. 用 `kill -CONT <legacy-pid>` 恢復 legacy 子行程，並確認它的 tunnel 重新連上。
9. 在大範圍上線之前，用一台拋棄式筆電做一次實體的睡眠與喚醒，重複以上測試。

## Marketing 網站部署 {#marketing-site-deployment}

發 nightly 時，release workflow 會在桌面版 job 執行的同時，把同一個 commit build 成 marketing 網站 Vercel 專案的一個 staged production deployment，並在 release 發佈之後用 `vercel promote` 讓它上線。Stable 發版不會部署 marketing 網站，因為 stable 升級的可能是比較舊的 nightly commit。

這個 job 使用既有的 `VERCEL_TOKEN` 和 `VERCEL_ORG_ID` secrets 來查找 `t3code-marketing` 專案。它也會採用選用的 `VERCEL_TEAM_SLUG` variable。Vercel 專案的 root directory 必須是 `apps/marketing`。Git 部署在 `apps/marketing/vercel.ts` 裡維持停用。

## Hosted web app 的發版部署 {#hosted-web-app-release-deployment}

Hosted app 刻意不透過 Vercel 的 Git 整合來部署。Web 專案在 `apps/web/vercel.ts` 裡用 `git.deploymentEnabled: false` 停用了自動 Git 部署。`.github/workflows/release.yml` 會在桌面版 job 執行的同時，用 Vercel CLI 把 web app build 成一個 staged production deployment（`--skip-domain`），並在 GitHub Release 成功之後，把各 channel 的網域 alias 到它。

必要的 GitHub Actions secrets：

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

選用的 GitHub Actions variables：

- `VERCEL_TEAM_SLUG`：偏好使用 team slug 而不是 `VERCEL_ORG_ID` secret 時，用它覆寫 Vercel CLI 的 scope。
- `T3CODE_WEB_ROUTER_URL`：預設是 `https://app.t3.codes`。
- `T3CODE_WEB_LATEST_DOMAIN`：預設是 `latest.app.t3.codes`。
- `T3CODE_WEB_NIGHTLY_DOMAIN`：預設是 `nightly.app.t3.codes`。

必要的 Vercel 網域：

- `app.t3.codes`：使用者開啟的 router 網域，由 stable 發版更新。
- `latest.app.t3.codes`：channel alias，由 stable 發版更新。
- `nightly.app.t3.codes`：channel alias，由 nightly 發版更新。

Router 網域使用 `apps/web/vercel.ts` 裡的 routes。使用者造訪 `/__t3code/channel?channel=latest` 或 `/__t3code/channel?channel=nightly` 來選擇加入某個 channel；router 會存下 `t3code_web_channel` cookie，並把之後對 `app.t3.codes` 的請求 rewrite 到對應的 channel alias。

Release 的部署 job 會在上傳之前改寫 release 套件的版號，這樣 hosted app 的 About 面板才會顯示這次發版的版號。Stable 部署會把同一個 deployment 同時 alias 到 `latest` channel 和 router 網域，讓 router 規則保持在最新狀態。Nightly 部署只 alias `nightly` channel。這個 job 還會傳入 `VITE_HOSTED_APP_CHANNEL=latest|nightly`，它會讓 About 面板顯示 hosted 版的更新軌道（update track）選擇器。切換這個選擇器時，會先經過 router 網域上的 `/__t3code/channel`，這樣使用者的 channel cookie 會先被更新，然後才重新導向到 hosted app 的根路徑。

一次性的 Vercel dashboard 設定：

1. 確認 web 專案的 root directory 仍然是 `apps/web`。
2. 把上面三個網域加到 web 專案。
3. 想要的話，可以在 dashboard 裡停用自動 Git 部署；commit 進 repo 的 `vercel.ts` 設定才是唯一事實來源（source of truth），不過在 dashboard 裡中斷 Git 連結也是安全的。
4. 執行一次 stable 發版部署，或是手動 alias 目前的 stable deployment，讓 `app.t3.codes` 指向一個包含 `apps/web/vercel.ts` 裡 router 規則的 deployment。之後的 stable 發版會讓這個 alias 保持在最新狀態。

## Nightly build {#nightly-builds}

- Workflow：`.github/workflows/release.yml`
- 觸發方式：
  - 排程檢查，每 30 分鐘一次
  - 手動 `workflow_dispatch` 並指定 `channel=nightly`
- 自動的 nightly 需要有新的 commit，而且距離上一個 nightly 發佈（包含手動的 nightly）至少六小時。
- 手動的 nightly 會略過時間與變更的檢查。Nightly 的執行仍然是序列化的。排程的執行會等進行中的 nightly 完成，然後在 build 之前檢查發佈間隔。
- 執行和 tag 發版流程相同的桌面版品質關卡與 artifact matrix。
- 只發佈 GitHub prerelease：
  - 目前的 tag 格式：`vX.Y.Z-nightly.YYYYMMDD.<run_number>`
  - `nightly-v...` 只會被當作舊格式的「前一個 nightly tag」來接受
  - release 名稱包含短的 commit SHA
  - `make_latest` 一律是 `false`
- 用下一個 stable patch 版號當作 nightly 的基底。例如 `0.0.17` 會產生 `0.0.18-nightly.*` 的 nightly。
- 把 Electron 自動更新的 metadata 發佈到專用的 `nightly` updater channel，這樣桌面版使用者可以獨立於 stable 之外，自行選擇加入這個軌道。
- 用相同的 nightly 版號，把 CLI 的 npm 套件（`t3` 和 `@t3code/t3-<platform>-<arch>`）發佈到 npm 的 `nightly` dist-tag。
- 不會把版號變更 commit 回 `main`。

## Server 自我更新的發版不變條件 {#server-self-update-release-invariant}

已連線的 server 會更新到和 client 完全相同的版本，而不是更新到某個 npm dist-tag。因此每一個發出去的桌面版或 hosted client 版本，都必須先在 npm 上有對應的 `t3@<version>` 套件，使用者才可以收到那個 client。

Workflow 強制執行這個順序：

1. `publish_cli` 在每個 channel 上，都把確切的 release 版本發佈到 npm。
2. `release` 相依於 `publish_cli`，之後才在 GitHub Releases 公開桌面版 artifact。
3. `deploy_web` 相依於 `release`，之後才把 hosted channel 切到新的 client。`build_web` 會更早用 `vercel deploy --prod --skip-domain` build 出那個 client，這個指令不會動到自訂網域，但會移動專案自己的 `*.vercel.app` production hostname。那個 hostname 在 Vercel SSO 後面，所以使用者只會透過自訂網域拿到 client。

修改 release graph 時請保留這些相依關係。如果先發佈 client，**Update server** 這個動作就會指向一個還不存在的套件版本。

做發版 smoke test 時，先確認 `npm view t3@<version> version` 回傳預期的版本，然後把新的 client 連到一個還在前一版的 server，並驗證更新動作會重新連上對應版本的 server。當這次發版新增了資料庫 migration 時，要驗證遠端更新會套用它們並重新連線。試跑失敗時，必須還原資料庫 snapshot 並重新啟動前一版的 server。如果已安裝的 launcher 不支援目標 protocol，要驗證更新會在重啟之前停下來，然後在 server 那台機器上執行一次 `npx t3@<version> service update`。有對應的 environment 可用時，也請測試手動管理或由桌面版管理的引導流程。

## 桌面版自動更新的注意事項 {#desktop-auto-update-notes}

- Updater runtime：`apps/desktop/src/updates/DesktopUpdates.ts`。
- `electron-updater` adapter：`apps/desktop/src/electron/ElectronUpdater.ts`。
- `apps/desktop/src/main.ts` 只負責把 updater 的 layer 接進桌面版 runtime。
- 更新的使用體驗：
  - 背景檢查在啟動後延遲一段時間執行，之後每隔一段時間執行一次。
  - 不會自動下載或安裝。
  - 有可用的更新時，桌面版 UI 會顯示一個火箭圖示的更新按鈕；按一下開始下載，下載完成後再按一下就會重啟並安裝。
- Provider：GitHub Releases（`provider: github`），在 build 時設定。
- Repository slug 的來源：
  - 有設定的話用 `T3CODE_DESKTOP_UPDATE_REPOSITORY`（格式 `owner/repo`）。
  - 否則用 GitHub Actions 的 `GITHUB_REPOSITORY`。
- Updater 需要的 release 檔案：
  - 各平台的安裝檔（`.exe`、`.dmg`、`.AppImage`、`.deb`，另外還有 macOS 的 `.zip`，供 Squirrel.Mac 當作更新 payload）
  - channel metadata：stable 版本是 `latest*.yml`，nightly 版本是 `nightly*.yml`
  - `*.blockmap` 檔案（用於差異下載）
- macOS metadata 的注意事項：
  - 不論 Intel 或 Apple Silicon，`electron-updater` 在 stable 上讀的是 `latest-mac.yml`，在 nightly 上讀的是 `nightly-mac.yml`。
  - Workflow 會在發佈 GitHub Release 之前，把各架構的 mac manifest 合併成一份該 channel 專用的 mac manifest。

### Windows payload 的結構與更新驗證 {#windows-payload-topology-and-update-validation}

Windows 把 bundle 好的 server，以及它在 runtime 才外部載入的相依套件與原生相依套件的 closure（只有這些），打包在 `resources/server.asar` 裡。該 archive 宣告為 unpacked 的原生模組和 helper 執行檔，必須出現在 `resources/server.asar.unpacked` 底下的對應路徑。Windows 原生的 backend 透過 Electron 直接就地讀取這個 archive。打包後的 Windows build 還會附上 `resources/wsl-runtime.tar.gz` 和它的 SHA-256 sidecar：也就是 Linux CLI archive（`t3-<version>-linux-<arch>.tar.gz`，架構與 Windows host 相同），由 Linux 桌面版 job build 出來，再以 `--wsl-runtime` 交給 Windows 桌面版 build，原封不動複製進去，這樣 WSL 執行的就是和 Linux 使用者下載到的完全相同的位元組。WSL 會驗證這個 archive，並把它解開到所選 distro 裡的 `~/.t3/wsl-runtime/sha256-<archive-digest>`，之後同一個更新版本再次啟動時就重複使用它。

Windows 把 JavaScript 和套件 metadata 留在 `app.asar` 裡面，只把原生函式庫和 helper 執行檔 unpack 出來。請避免啟用整個套件的 smart unpacking：每一個散落在外的檔案都會增加 NSIS 安裝的工作量，並且計入 payload 上限。

只要下列任何一項不變條件被破壞，artifact builder 就會拒絕這個 Windows 套件：

- `resources/server.asar` 不存在，或是裡面沒有 server 的進入點。
- ASAR header 裡標記為 unpacked 的任何檔案，沒有出現在 `resources/server.asar.unpacked` 裡。
- 在相同架構的 Windows build 上，打包後的 primary 無法從 `server.asar` 內部，透過它旁邊的 `.unpacked` 目錄載入 fff 原生函式庫。
- 隔離並解開後的 sidecar，無法用單純的 Node 載入 server 的進入點。
- 有傳入 `--wsl-runtime` 的 Windows build 漏掉了 WSL archive 或 SHA-256 sidecar，或是 sidecar 的 digest 和產出的 archive 不相符。
- 產出的 WSL archive 不是 Linux CLI 的 release archive：它必須解開成單一個 `t3-<version>-linux-<arch>` 目錄，裡面有 `t3`、`client/` 和帶有 Linux node-pty binary 的 `node_modules/`，而且不可以帶有散落在外的 server bundle（`bin.mjs`）。
- 外部的 Windows resource monitor 不存在。
- Unpack 出來的 Windows 應用程式包含超過 80 個檔案。

跨架構的 Windows build 會保留所有結構檢查和解開 sidecar 的檢查，但會跳過執行目標架構的 Electron binary。每個發版目標都必須有一個相同架構的 build 來實際跑過 primary 的原生載入探測（native-load probe）。

NSIS 的差異打包（differential packaging）維持啟用。Sidecar 配置方式的轉換可能會造成一次性的較大下載；之後的小改版仍然保有 blockmap，一次具代表性的 sidecar 到 sidecar 更新，上限是 60 MB。

## 0) npm OIDC trusted publishing 設定（CLI）{#0-npm-oidc-trusted-publishing-setup-cli}

Workflow 會對下載回來的 CLI archive 執行 `node scripts/build-npm-platform-packages.ts`，接著執行 `node apps/server/scripts/cli.ts publish --packages-dir npm-packages`；後者會對每一個 `@t3code/t3-<platform>-<arch>.tgz` 執行 `npm publish`，最後才對 launcher `t3.tgz` 執行。這個腳本發佈的是它自己 build 出來的 tarball，而不是目錄：不管 `files` 怎麼寫，`npm publish <dir>` 都會把 `node_modules/` 從 tarball 裡去掉，而執行檔正是從那裡載入原生 addon 的。每次發版會發佈七個套件：`t3`、`@t3code/t3-darwin-arm64`、`@t3code/t3-darwin-x64`、`@t3code/t3-linux-arm64`、`@t3code/t3-linux-x64`、`@t3code/t3-win32-arm64`、`@t3code/t3-win32-x64`。

檢查清單：

1. 確認 npm org 擁有 `t3` 這個套件，而且 npm 上有 `@t3code` scope（沒有的話就建立這個 org）。
2. 針對 `t3` 和每一個 `@t3code/t3-<platform>-<arch>` 套件，在 npm 的套件設定裡設定 Trusted Publisher（從未發佈過的套件，要先發佈一次或放一個佔位版本，這個設定才會出現；`publish_cli` 裡的 `--dry-run` 步驟會回報哪些名稱仍然被拒絕）：
   - Provider：GitHub Actions
   - Repository：這個 repo
   - Workflow file：`.github/workflows/release.yml`
   - Environment（如果有用到）：和你的 npm trusted publishing 設定一致
3. 確保 npm 帳號和 org 的政策允許每一個套件使用 trusted publishing。
4. 建立 release tag `vX.Y.Z` 並 push；workflow 會：
   - build 五個 CLI archive 並做 smoke test
   - 用這些 archive build 出 npm 套件
   - 以 npm dist-tag `latest` 發佈它們
5. Nightly 的執行以 npm dist-tag `nightly` 發佈；preview 的執行則是 `preview`。

## 1) 發版驗證與未簽章的 build {#1-release-validation-and-unsigned-builds}

沒有「試跑用的 tag」這條路。Push 任何會被接受的非 nightly tag（包括 `v0.0.0-test.1`），都會讓這次執行被歸類為 stable channel。它會以 npm dist-tag `latest` 發佈 `t3`、建立一個真正的 GitHub Release、把 hosted app alias 到 `latest.app.t3.codes` 和 `app.t3.codes`，而且 finalize job 可能會把版號變更 commit 到 `main`。不要為了驗證 workflow 而 push 測試用的 tag。

這個 workflow 沒有「不發佈」的 `workflow_dispatch` 模式。想在不發版的情況下驗證檢查和 build，請用一般的 CI 或本機的品質關卡。想把完整的 release graph 跑一遍、又要降低對 stable 的風險，可以手動 dispatch `channel=nightly`；這仍然會發佈真正的 nightly npm 套件、GitHub prerelease、桌面版 updater release、hosted 的 nightly alias 和 marketing 網站，但不會更新 stable 的 app alias，也不會把版號變更 commit 到 `main`。只有在可以接受真的發出一個 nightly 版本時才執行它。

手動的 `channel=stable` 同樣是一次真正的 stable channel 發版。不提供簽章用的 secrets 只會讓各平台的 artifact 沒有簽章；並不會阻止發佈。

:::note 這個 workflow 沒有安全的試跑方式
上面三段講的是同一件事：不論用 tag 還是 `workflow_dispatch` 觸發 stable 或 nightly，都會真的發佈出去，少了簽章用的 secrets 也一樣。只想確認程式碼能不能通過檢查和 build 的話，用一般的 CI 就好。
:::

## 2) Apple 簽章與 notarization 設定（macOS）{#2-apple-signing--notarization-setup-macos}

Workflow 使用的必要 secrets：

- `CSC_LINK`
- `CSC_KEY_PASSWORD`
- `APPLE_API_KEY`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`
- `MACOS_PROVISIONING_PROFILE`（base64 編碼的 provisioning profile，需包含 Associated Domains）

必要的 repository variables：

- `APPLE_TEAM_ID`

選用的 repository variables：

- `CLERK_PASSKEY_RP_DOMAINS`：以逗號分隔的 RP 網域覆寫值。預設情況下，build 會從 production 的 Clerk publishable key 推導出網域。

檢查清單：

1. Apple Developer 帳號的存取權：
   - Team 有權限建立 Developer ID 憑證。
2. 為 `com.t3tools.t3code` 建立一個 explicit App ID，並啟用 Associated Domains。
3. 建立一張 `Developer ID Application` 憑證，以及一個與該 App ID 相容、已啟用 Associated Domains 的 provisioning profile。
4. 從 Keychain 把憑證和私鑰匯出成 `.p12`。
5. 把 `.p12` 做 base64 編碼，存成 `CSC_LINK`。
6. 把 provisioning profile 做 base64 編碼，存成 `MACOS_PROVISIONING_PROFILE`。
7. 把 `.p12` 的匯出密碼存成 `CSC_KEY_PASSWORD`，並把 `APPLE_TEAM_ID` 設成 10 個字元的 Apple Developer Team ID。
8. 在 App Store Connect 建立一把 API key（Team key）。
9. 加入 API key 的各個值：
   - `APPLE_API_KEY`：下載回來的 `.p8` 的內容
   - `APPLE_API_KEY_ID`：Key ID
   - `APPLE_API_ISSUER`：Issuer ID
10. 完成 [T3 Connect 設定](./connect-setup.md#desktop-passkeys)裡的 Clerk Native API 與 AASA 設定。
11. 重新跑一次 tag 發版，確認 macOS 的 artifact 已簽章並 notarize，而且包含預期的 `com.apple.developer.associated-domains` entitlement。

備註：

- `APPLE_API_KEY` 在 secrets 裡是以 key 的原始文字儲存。
- Workflow 在執行時把它寫到一個暫時的 `AuthKey_<id>.p8` 檔案。
- Workflow 會解碼 `MACOS_PROVISIONING_PROFILE`，用 `security cms` 驗證它，再把它交給桌面版的 packager。

## 3) Azure Trusted Signing 設定（Windows）{#3-azure-trusted-signing-setup-windows}

Workflow 使用的必要 secrets：

- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_TRUSTED_SIGNING_ENDPOINT`
- `AZURE_TRUSTED_SIGNING_ACCOUNT_NAME`
- `AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME`
- `AZURE_TRUSTED_SIGNING_PUBLISHER_NAME`

檢查清單：

1. 建立 Azure Trusted Signing 帳號和 certificate profile。
2. 記下 ATS 的各個值：
   - Endpoint
   - Account name
   - Certificate profile name
   - Publisher name
3. 建立或選擇一個 Entra app registration（service principal）。
4. 授予 service principal Trusted Signing 所需的權限。
5. 為 service principal 建立一組 client secret。
6. 把上面列出的 Azure secrets 加到 GitHub Actions secrets。
7. 重新跑一次 tag 發版，確認 Windows 安裝程式已簽章。

## 4) 每次發版的檢查清單 {#4-ongoing-release-checklist}

1. 選定最新的 nightly 並驗證它：對它的 artifact 執行上面的 smoke test，並檢查 nightly channel 有沒有 regression。
2. Dispatch Release workflow 並指定 `channel=stable`。除非版號要和 nightly 預告的不同，否則 `version` 留空。
3. 確認 `Resolve release commit` 的 notice 指出的，正是你驗證過的 nightly tag 和 commit。如果這段期間有更新的 nightly 發佈，這次執行 build 的會是那一個。
4. 檢查 workflow 的各個步驟：
   - preflight 通過
   - release 的品質檢查通過
   - `build_bundle` 和所有平台的 build 通過
   - `publish_cli` 在 release job 之前發佈了確切的 release 版本
   - release job 上傳了預期的檔案
5. 對下載回來的 artifact 做 smoke test。

## 5) 疑難排解 {#5-troubleshooting}

- macOS build 預期有簽章，結果沒有：
  - 檢查所有 Apple secrets 以及 `APPLE_TEAM_ID` 都有填寫，而且不是空的。
  - 確認 provisioning profile 屬於 `APPLE_TEAM_ID.com.t3tools.t3code`，並且包含 Associated Domains。
- Windows build 預期有簽章，結果沒有：
  - 檢查所有 Azure ATS 與驗證用的 secrets 都有填寫，而且不是空的。
- Build 因為簽章錯誤而失敗：
  - 把 secrets 移除後重試，確認未簽章的流程仍然可以運作。
  - 重新檢查憑證與 profile 的名稱，以及 tenant／client 的憑證。
