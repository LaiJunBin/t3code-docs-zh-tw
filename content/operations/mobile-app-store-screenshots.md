---
title: 手機 app 商店截圖工具
nav: 商店截圖工具
source: docs/operations/mobile-app-store-screenshots.md
source_hash: 0078754ad9c2b246d0d00414e18037221716c5a4
---

> 這一頁是寫給維護者的。如果你是 T3 Code 的使用者，請看 [docs/user](../user/)。

這個截圖工具（harness）會讓真正的手機 app 連到三個用完即丟的本機 T3 environment 來執行。它替每個 environment 建立一個隔離的 base directory 和 server、內容固定（deterministic）的真實 Git 專案、預先塞入的 orchestration projection，以及持久化的終端機歷史紀錄。App 透過平常的連線流程和每一台 server 配對，再由 React Navigation 開啟正式版的 Home、Thread、ThreadTerminal、ThreadReview 和 SettingsEnvironments 路由。

沒有任何截圖專用的畫面去重做 app 的 UI。`EXPO_PUBLIC_SHOWCASE=1` 只做三件事：啟用一個不會渲染任何畫面的配對與就緒狀態協調器（pairing/readiness coordinator）；停用終端機的自動聚焦，讓截圖裡不會出現螢幕鍵盤；以及提供內容固定的 T3 Connect 探索項目給真正的 Environments 畫面。本機 environment 的卡片一律來自真正配對好的 server。

## 擷取預設的組合 {#capture-the-default-matrix}

在 repository 根目錄執行：

    pnpm screenshots:mobile

這個指令會：

1. 建立三個暫時的 T3 base directory，並替每一個在可用的 port 上啟動一台本機 server。
2. 建立 T3 Code、React 和 Linux 三個 Git repository，帶有容易辨識的 favicon、功能分支，以及一份內容固定的 T3 Code review diff。
3. 在每台 server 已完成 migration 的 SQLite 資料庫裡，塞入帶點趣味的 Thread、訊息、活動和終端機歷史紀錄，再加上兩筆持久化、正在等待送出的 mobile-outbox 任務。
4. 啟動一個隔離的 Metro server，建置所選的原生 app，並啟動每一台裝置。
5. 把每一個全新安裝的 app 和 Moonbase Terminal、Suspense Station、Kernel Cabin 配對。
6. 針對每一個要求的場景，導覽到真正的 app 路由。
7. 設定要求的系統外觀和配色（palette）、統一狀態列的顯示、把擷取結果轉成不含 alpha 的 24-bit RGB PNG，並在成功結束之前驗證尺寸、長寬比、檔案大小和截圖數量。
8. 把可以直接上架的資料夾寫到 `artifacts/app-store/screenshots/` 底下，可以直接上傳到 App Store Connect 或 Google Play Console。

由 runner 啟動的 server、Metro、暫時的根目錄和裝置，在擷取結束後都會清理掉。加上 `--keep-running` 可以把它們保留下來供檢查；runner 會印出 base directory 的路徑和 server 的 port。

擷取時會等待真正的 environment snapshot 載入完成（hydrate），以及要求的路由變成作用中。兩個平台都會把就緒狀態記錄在模擬器的 app container 裡。最後還有一段等待畫面穩定的延遲（settle delay），讓原生終端機和 Git review 的資料有時間完成渲染。

完整的擷取會先用 Expo 的 clean production prebuild 重新產生所選的原生專案，然後才建置。第一次建置之後要重複擷取時，請使用 --skip-build。

這個工具使用固定的 Metro port `8199`。這讓它和 Expo 平常的預設 port 分開，但每一個 checkout 都共用這個 port。就緒檢查只確認 port 是開著的；它不會確認那個行程是誰的。所以在不同 worktree 裡同時執行截圖工具，可能會互相衝突，或是接到錯的 Metro 行程上。

每一台設定好的裝置預設都是深色外觀和 `t3-code` 配色，所以單純執行 `pnpm screenshots:mobile` 會產生 35 張深色的 PNG。加上 `--appearance light`、`--appearance dark` 或 `--appearance both` 可以覆寫設定好的外觀；`both` 會產生 70 張 PNG。

:::plain 35 張是怎麼算出來的
預設組合有六個目標（見下方的表格）。其中五個各擷取六個場景，iPad 少了 agent activity 這個場景，只擷取五個：5 × 6 + 5 = 35。`both` 是深色、淺色各一輪，所以是 70。
:::

加上 `--theme <id>`（可以重複指定）或 `--theme all`，可以擷取 app 的其他配色：`t3-code`、`t3-chat`、`grove`、`ocean`、`ember` 和 `iris`。Runner 把配色當成啟動參數交給 app，app 把它套用到兩種色彩模式上，而場景要等到要求的配色已經生效之後才會回報自己就緒，所以擷取結果絕不會顯示成前一個主題。`--theme all` 會讓整次執行的量變成六倍；只有原生建置是共用的。

預設的組合是：

| 輸出資料夾                            | 擷取目標                     | 上傳尺寸  | 商店欄位                                  |
| ------------------------------------- | ---------------------------- | --------- | ----------------------------------------- |
| `apple/iphone-6.9/dark/t3-code/`      | 用完即丟的 iPhone 17 Pro Max | 1320×2868 | App Store Connect iPhone 6.9-inch         |
| `apple/iphone-6.5/dark/t3-code/`      | 用完即丟的 iPhone 14 Plus    | 1284×2778 | App Store Connect iPhone 6.5-inch         |
| `apple/ipad-13/dark/t3-code/`         | iPad Pro 13-inch (M5)        | 2752×2064 | App Store Connect iPad 13-inch，橫向      |
| `google-play/phone/dark/t3-code/`     | Pixel AVD，420 dpi           | 1080×1920 | Google Play 手機，直向 9:16               |
| `google-play/tablet-7/dark/t3-code/`  | Pixel AVD，寬度 600dp        | 1080×1920 | Google Play 7 吋平板，直向 9:16           |
| `google-play/tablet-10/dark/t3-code/` | Pixel AVD，寬度 800dp        | 1440×2560 | Google Play 10 吋平板，直向 9:16          |

每個目標都會擷取 thread、terminal、review、thread list 和 environments；除了 iPad 以外，每個目標還會擷取 agent activity。每個配色資料夾裡的五張或六張截圖，都符合設定好的幾項限制：Apple 的 1–10 張、Google 手機要求的 2–8 張，以及 Google 平板的建議／欄位最低 4 張、最多 8 張。每一種配色都有自己的最底層資料夾，所以同一個上傳欄位絕不會混到不同主題，而且每個資料夾的截圖數量都符合商店規定。

agent-activity 這個場景呈現的是使用者不在 app 裡時看到的畫面。App 會替四個預先塞入的 Thread，準備好和 relay 所發布的相同的 Live Activity（iOS）或 ongoing Live Update（Android）。在 iOS 上，runner 接著會鎖定模擬器，並用 `simctl push` 推送對應的 approval alert；在 Android 上，準備好的更新本身就帶有 alert，runner 則會打開通知欄。鎖定模擬器和回答通知權限的提示，用的是 [AXe](https://github.com/cameroncooke/AXe)，所以擷取 iOS 之前請先安裝它（`brew tap cameroncooke/axe && brew install axe`），或是設定 `AXE_PATH`。iPad 會跳過這個場景，因為鎖定畫面不會跟著 app 自己轉成的橫向。

產生出來的目錄結構是刻意對齊商店的上傳欄位的：

    artifacts/app-store/screenshots/
    ├── apple/
    │   ├── iphone-6.9/dark/t3-code/{thread,terminal,review,threads,environments,agent-activity}.png
    │   ├── iphone-6.5/dark/t3-code/{thread,terminal,review,threads,environments,agent-activity}.png
    │   └── ipad-13/dark/t3-code/{thread,terminal,review,threads,environments}.png
    └── google-play/
        ├── phone/dark/t3-code/{thread,terminal,review,threads,environments,agent-activity}.png
        ├── tablet-7/dark/t3-code/{thread,terminal,review,threads,environments,agent-activity}.png
        └── tablet-10/dark/t3-code/{thread,terminal,review,threads,environments,agent-activity}.png

只擷取淺色的執行會把同樣的結構寫在 `light/` 底下；`--appearance both` 會寫出兩種外觀的資料夾，而每一個要求的主題都會在 `t3-code/` 旁邊多一個同層的資料夾。

要修改模擬器或 AVD 的名稱、淺色／深色外觀、預設配色、iOS 的方向、場景、輸出目錄、擷取延遲、Android ABI 或 viewport，請編輯 [mobile-showcase.config.ts](../../scripts/mobile-showcase.config.ts)。可以選用的配色 id 來自 [themePalettes.ts](../../packages/shared/src/themePalettes.ts) 裡的 `MOBILE_THEME_IDS`，所以這個工具和 app 的外觀設定絕不會彼此不一致。

## 在 GitHub Actions 裡擷取 {#capture-in-github-actions}

從 GitHub 的 Actions 分頁執行 `Mobile Showcase Screenshots` workflow，選擇 `all`、`ios` 或 `android`，選擇 `light`、`dark` 或 `both`，再挑一個配色（或是 `all`，這會把每個 job 的 timeout 從 60 分鐘提高到 300 分鐘）。預設的觸發設定會擷取 `t3-code` 配色的兩種外觀，並且同時執行 iOS 和 Android：iPhone 和 iPad 在一台 12-vCPU 的 Blacksmith macOS runner 上擷取，Android 手機、7 吋平板和 10 吋平板則在一台 16-vCPU 的 Blacksmith Linux runner 上，用 KVM 加速的 x86_64 模擬器擷取。

每個 job 即使擷取失敗，也會上傳它的 PNG，所以只跑完一部分的結果也能拿來診斷。另外的驗證步驟則以成功為前提：只有擷取成功時，它才會在上傳之前執行。如果擷取失敗，`always()` 的上傳步驟仍然會發布那些不完整的 PNG，但不會重新驗證它們。請從該次 workflow 執行的 Artifacts 區塊下載 `app-store-connect-screenshots` 和 `google-play-screenshots`。Artifact 會保留 14 天。

:::note 失敗的執行所留下的 PNG 沒有經過驗證
擷取失敗時驗證步驟不會執行，所以那次執行的 artifact 是給你診斷用的，裡面的 PNG 並沒有通過尺寸、數量這些檢查。
:::

這個 workflow 使用的裝置和場景組合，和本機擷取用的是同一份已 commit 的設定。為了配合本機的 Apple Silicon 開發，Android 預設仍然是 ARM64；CI 會設定 `T3_SHOWCASE_ANDROID_ABI=x86_64`，讓 debug APK 和它那台有加速的模擬器相符。

## 快速反覆調整 {#fast-iteration}

只擷取一個場景或一台裝置：

    pnpm screenshots:mobile --device iphone-6.9 --scene thread
    pnpm screenshots:mobile --platform android --scene review

覆寫設定好的外觀，或是兩種都擷取：

    pnpm screenshots:mobile --appearance light
    pnpm screenshots:mobile --appearance dark
    pnpm screenshots:mobile --appearance both

擷取其他配色：

    pnpm screenshots:mobile --device iphone-6.9 --theme ocean
    pnpm screenshots:mobile --device iphone-6.9 --theme ocean --theme ember
    pnpm screenshots:mobile --device iphone-6.9 --theme all

沿用原生建置，並保留用完即丟的 environment：

    pnpm screenshots:mobile --device ipad-13 --skip-build --keep-running

預設情況下，讓截圖 runner 自己在 port `8199` 啟動 Metro 就好。如果想把 Metro 放在另一個終端機裡執行，請用相同的 showcase 環境變數，並明確指定這個工具用的 port 來啟動它：

    cd apps/mobile
    APP_VARIANT=development EXPO_PUBLIC_SHOWCASE=1 pnpm exec expo start --dev-client --port 8199

接著在 repository 根目錄執行擷取：

    pnpm screenshots:mobile --skip-build --skip-metro --device iphone-6.9

`pnpm --filter @t3tools/mobile showcase` 會在 Expo 平常的 port 上啟動，所以它和這個工具的 `--skip-metro` 模式不相容。

列出組合和可用的旗標：

    pnpm screenshots:mobile --list

驗證既有的檔案，不啟動 Metro、server、模擬器：

    pnpm screenshots:mobile --validate-only
    pnpm screenshots:mobile --platform ios --validate-only

## 自訂預先塞入的環境 {#customize-the-seeded-environment}

- 專案 repository、Thread projection、對話、終端機的輸出紀錄和 Git 變更：[mobile-showcase-environment.ts](../../scripts/mobile-showcase-environment.ts)
- 裝置和擷取的組合：[mobile-showcase.config.ts](../../scripts/mobile-showcase.config.ts)
- 模擬器的調度：[mobile-showcase.ts](../../scripts/mobile-showcase.ts)

Fixture 的時間戳記是相對於擷取開始的時間產生的，所以每個路由顯示的相對時間標籤都是穩定的，同時 server 收到的仍然是有效的當下資料。iPhone、iPad、Android 手機和 Android 平板的擷取，用的都是同一組內容固定的三個 environment；不同螢幕尺寸之間的差異，完全來自正式版 app 自己的版面配置。

Pending 的那幾列使用的是正式版的離線 outbox，指向真正的 T3 Code 和 React fixture 專案。Showcase 的協調機制會在擷取期間把這兩筆項目留在 outbox 裡，就像一個目前正開著編輯的任務一樣，所以重新連上預先塞入的 environment 時，不會在截圖拍下之前就把它們送出並移除。

Environments 的擷取會把三個本機 fixture 的連線，分別顯示成一個 Tailscale HTTPS hostname、一個赫爾辛基 VPS 的 hostname，以及一個 Tailnet IPv4 位址。這只是顯示上的替換：卡片看起來以遠端連線為主，而工具本身仍然用可靠的 loopback 連線連到它那些短暫存在的 server。

## 本機的前置需求 {#local-prerequisites}

- iOS：Xcode command-line tools、設定檔裡指定的模擬器 runtime，以及已安裝的 CocoaPods。
- Android：解析 SDK 位置時會先檢查 `ANDROID_HOME`，再檢查 `ANDROID_SDK_ROOT`，都沒有的話，在 macOS 上預設使用 `$HOME/Library/Android/sdk`，在其他平台上預設使用 `$HOME/Android/Sdk`。解析出來的 SDK 必須提供 `adb` 和 `emulator`，而且設定檔裡指定的 AVD 必須存在。

上傳尺寸以這個工具為唯一事實來源（source of truth）；不要自己縮放它的輸出。如果商店的規定變了，請更新該目標的 `storeAsset` 規格。遇到以下情況，擷取會失敗：PNG 的尺寸不對、帶有 alpha、不是 8-bit RGB、超過設定的檔案大小上限、違反 Google Play 的 9:16 形狀或範圍限制，或是一組完整的輸出少於商店要求的最低數量。
