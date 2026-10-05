---
title: Android 通知
source: docs/operations/android-notifications.md
source_hash: aa29ef3e1a7b4ab1f1dca7c267aa1b92754a2e01
---

Android app 接收的是 Firebase Cloud Messaging（FCM）的 data message。Relay 透過 FCM HTTP v1 直接送出這些訊息；不需要 Expo Push 帳號。

## Android 相容性與自動化檢查 {#android-compatibility-and-automated-checks}

App 的最低版本是 Android 7.0（API 24），宣告在 `app.config.ts` 裡，並由 relay 的裝置註冊 schema 強制檢查。Compile/target SDK 版本跟隨鎖定的 Expo/React Native 工具鏈（目前是 API 36）。通知頻道（notification channel）從 API 26 開始；通知權限的提示從 API 33 開始。Live Update 的升級顯示（promotion）需要 API 36，而且仍然受系統設定和裝置支援程度的限制。Alert 和一般的 activity card 在 API 36 以下也能運作。

在 Android 16 以上，請開啟 T3 Code 的 **Settings → Live Update Settings**，允許狀態列的 chip。Android 把這個設定和通知權限分開管理。工作進行中時 chip 顯示 `Working`，有核准請求時顯示 `Approve`，有輸入請求時顯示 `Answer`；工作完成後會回到一般的通知。請使用 Android 16 QPR2 或更新的模擬器映像檔，來驗證實際出貨的 promotion 行為。

API 24–25 使用單一個不精確（inexact）的系統鬧鐘，在行程結束之後讓 card 過期，不需要精確鬧鐘（exact-alarm）權限。Android 在省電模式下可能會延後這個鬧鐘。API 26 以上使用通知的 timeout。停用 activity、dismiss、切換帳號和登出，都會取消這個舊版的鬧鐘。過期的到期廣播（expiry broadcast）無法移除較新一次 run 的 card。

原生通知的測試使用 Robolectric 涵蓋 API 24、26、33 和 36（另外加上 API 25，用來測舊版的過期機制）。要編譯這個模組、執行這些測試並執行 Android lint，請在產生出來的 `apps/mobile/android` 專案裡執行以下指令，並且要有 JDK 21 可用。不需要 Firebase、簽署或 relay 的 secret：

```sh
./gradlew :t3-agent-notifications:testDebugUnitTest :t3-agent-notifications:lintRelease -Pandroid.lint.useK2Uast=false
```

Robolectric 的 API 36 runtime 需要 JDK 21；模組的編譯仍然使用 Expo 的 Java 17 工具鏈。既有的 Mobile Native Static Analysis job 會另外執行 ktlint 和 detekt。原生 fingerprint 檢查會把這項變更標記為需要新的 binary；正式環境的 workflow 無法用 OTA 把它送到較舊的 binary 上。如果已安裝的原生模組缺少必要的方法，Settings 會停用 Android 通知。

這個 lint 指令使用 K1 frontend，因為 AGP 的 K2 frontend 在分析 Worklets 0.10 的 Gradle Kotlin script 時會當掉。這並不會停用任何 lint 檢查。Live Update 是否符合資格，必須在實際裝置上驗證：Robolectric 的 API 36 映像檔實作的是較舊的 promotion 規則，那套規則要求通知要上色（colorization），而實際出貨的 Live Update 要求通知不上色。

## Firebase 與 app 建置 {#firebase-and-app-build}

1. 建立一個 Firebase 專案，並註冊你打算建置的每一個 Android application identifier：`com.t3tools.t3code.dev`、`com.t3tools.t3code.preview` 或 `com.t3tools.t3code`。
2. 下載 `google-services.json`。執行 Expo prebuild 和建置 app 時，把 `T3CODE_ANDROID_GOOGLE_SERVICES_FILE` 設成它的路徑。這個 JSON 必須包含所選 variant 的 package identifier。
3. 建立一把 service-account key，它要有權限替那個 Firebase 專案送出 FCM 訊息。這個私密的 JSON 要放在 repository 和 app bundle 之外。
4. 如果 Google 專案裡還沒有啟用 Firebase Cloud Messaging API，請啟用它。如果要用 hosted delivery（由託管的 relay 送出），請把 relay 的 `FCM_SERVICE_ACCOUNT` secret 設成 service-account 的 JSON。
5. 建置一個新的 Android binary。只更新 JavaScript 無法安裝原生的通知 handler 或 Firebase 設定。Hosted delivery 還需要 relay 的資料庫 migration，以及更新過的 relay 部署；本機驗證可以使用下面介紹的 watcher。

:::plain 兩個 JSON 檔不要搞混
`google-services.json` 是給 app 用的，建置時透過 `T3CODE_ANDROID_GOOGLE_SERVICES_FILE` 提供。Service-account 的 JSON 是私密金鑰，用來送出 FCM 訊息，只放在 relay 那一側（`FCM_SERVICE_ACCOUNT`），不可以放進 repository 或 app 裡。
:::

要做本機的開發版建置，請在 `apps/mobile` 底下執行：

```sh
APP_VARIANT=development \
T3CODE_ANDROID_GOOGLE_SERVICES_FILE=/absolute/path/google-services.json \
vp run android:dev
```

如果是 EAS build，請透過每一個選用的 build environment 提供相同的設定，其中 Google services 檔案要用一個名為 `T3CODE_ANDROID_GOOGLE_SERVICES_FILE` 的 EAS file variable。這個檔案除了原生建置要能讀到，fingerprint 的產生過程也要能讀到。FCM 的 service-account 憑證屬於 relay，不屬於 EAS 的 app environment。如果要部署一個獨立的 hosted relay，請依照 [T3 Connect](../internals/t3-connect.md) 的說明，針對那個 relay 和 Clerk application 設定這次建置的 T3 Connect 公開設定。

在 prebuild 和打包私人 binary 之前，先設定 `T3CODE_MOBILE_UPDATES_ENABLED=0`，停用 repository 裡設定好的 Expo OTA 更新來源。Debug 的 development-client APK 需要 Metro；如果要在沒有 Expo development launcher 的情況下驗證冷啟動時點擊通知的行為，就需要一個已打包的 release build。

## 私人建置的 Clerk 登入 {#clerk-sign-in-for-private-builds}

Clerk 的原生 Android 登入使用 `clerk://<applicationId>.callback`。在這次建置的 publishable key 所選到的那個 Clerk instance 裡，必須由它的管理員在 **Native applications > Allowlist for mobile SSO redirect** 底下允許完全相符的 callback。以開發版的 package 來說，要加入：

```text
clerk://com.t3tools.t3code.dev.callback
```

App 已經宣告了對應的 callback receiver。出現「redirect url ... does not match an authorized redirect URI」這個錯誤時，需要修改的是 Clerk 的設定；重新建置同一個 APK 不會解決問題。等管理員儲存這個項目之後，再重新開啟登入流程。其他 variant 請看 [Android 原生登入的 redirect](./connect-setup.md#android-native-sign-in-redirects)。

使用 T3 既有的正式環境 publishable key，選到的會是維護者的 Clerk instance。這並不會讓你有權限修改那個 instance 的 allowlist。你所選 package 的 callback 必須已經在允許清單裡，或是由那個 instance 的管理員加進去。Android 的裝置註冊和 hosted delivery 另外還需要下面說明的 relay 部署。直接配對（direct-pairing）或 FCM 的 smoke test 成功，並不能驗證 hosted 登入或裝置註冊。

用 `APP_VARIANT=production` 建置，會選到 `com.t3tools.t3code` 以及它對應的 Clerk callback。Prebuild 和打包時要設定同一個 variant，並提供一個包含該 package 的 Google services 檔案。私人 binary 請維持停用 OTA 更新。使用這個 package 並在本機簽署的 build，無法更新由維護者簽署的官方安裝版本，也無法與它並存；移除那個安裝版本也會一併移除它存在 app 裡的本機資料。開發版的 package 則仍然是一個獨立的 app。

## 針對送達的檢查 {#focused-delivery-check}

`infra/relay/scripts/android-push-smoke.ts` 會透過正式環境的 FCM client 實作送出一則訊息，不需要佈建 relay 的資料庫、Clerk 整合或 Cloudflare 佇列。它只驗證從 Firebase 到裝置這一段的送達。

請提供一個私密的裝置 JSON 檔，內容包含 app 的原生 FCM `token`、已註冊的 `deviceId`、已登入的 `userId`，以及 Android 的 `packageName`。可以選擇性地加上 `deepLink`，指向一個既有的 Thread，用來驗證點擊行為。App 必須已經註冊它本機的原生通知 handler，並且擁有通知權限。在 `infra/relay` 底下執行：

```sh
vp run push:android:smoke /path/service-account.json /path/device.json running
vp run push:android:smoke /path/service-account.json /path/device.json approval
vp run push:android:smoke /path/service-account.json /path/device.json completed
```

支援的狀態有 `running`、`approval`、`input`、`completed`、`failed` 和 `end`。Firebase 接受了訊息，並不能證明裝置有顯示它。請檢查實際的通知、把 app 切到背景，並測試點擊通知。另外也要測試 dismiss、停用 ongoing activity、登出、token 輪替，以及 app 行程結束之後的送達。Android 設定裡的 **Force stop** 會刻意阻止送達，直到 app 再次被開啟為止。

App 在前景時，Android 只會抑制目前畫面上那個 Thread 的 alert，這和 iOS 的通知呈現方式一致；其他 Thread 的 alert 仍然會顯示。Activity card 在前景時仍然會更新，並且安靜地保留已完成的結果。請檢查以下幾點：完成通知在它的 Thread 開著時保持安靜；開著的是其他畫面時會跳出 alert；切到背景之後會跳出 alert；以及重試一個被抑制的 alert 不會讓它稍後才顯示出來。這裡依據的是收到通知的那支手機上的 app 生命週期和路由，不是 Thread 在其他 client 上是否可見。

啟用 ongoing activity 之後，請驗證：兩個 Thread 同時進入 approval/input 狀態時，只會產生一則 `2 agents need attention` 的 alert；兩個被觀察到處於 active 的 Thread 同時完成或失敗時，只會產生一則 `2 agents finished` 的 alert。內文會列出它們的標題。Relay 沿用 iOS 的狀態轉換選擇邏輯，並在工作結束時保留它已送達的基準狀態（baseline）；再次發布相同的狀態，不可以產生另一則 alert。群組 alert 會開啟彙總結果裡優先度最高的 Thread；個別的 alert 則保留它自己的 Thread 連結。

請驗證一張展開的 card：包含五個 Thread、attention/failure 的優先順序、專案名稱和狀態。所有工作都結束之後，card 應該顯示 **Agent work completed** 或 **Agent work failed**，失去 ongoing/promotion 旗標，並在最新一筆顯示出來的結果之後 15 分鐘過期。重播（replay）不可以延長這個期限。安靜執行中的工作使用 relay 的兩小時狀態存活時間；approval/input 狀態使用 24 小時。重新開啟同一個已登入的 app，確認既有的 alert 和 dismiss 狀態都還在，並且在冷啟動時、或是間隔至少 60 秒後回到前景時，會有一次安靜的彙總重播。另外也要檢查：空的重播會移除孤立的 card；超過兩分鐘的完成結果絕不會跳出 alert，即使 ongoing activity 是停用的也一樣。

Android prebuild 之後，在 `apps/mobile/android` 底下執行原生呈現的回歸測試：

```sh
./gradlew :t3-agent-notifications:testDebugUnitTest --tests expo.modules.t3agentnotifications.AgentNotificationsTest
```

## Relay 部署 {#relay-deployment}

### 用既有的 T3 服務做本機驗證 {#local-verification-with-existing-t3-services}

開發 Android 推播時，不需要把 T3 Connect 的託管基礎設施複製一份。維持平常的 Clerk 登入和 environment 連線即可。`scripts/android-push-watch.ts` 會訂閱一個已配對 environment 的 shell stream，使用共用的 agent-awareness projection，並透過新的 FCM client 送出更新。它把暫時性的狀態放在記憶體裡，不需要託管的資料庫或 Clerk secret。

建立一個私密的 `connection.json`，內容包含 `wsUrl`（該 environment 的 `/ws` URL）和 `bearerToken`（一個一般的已配對 environment access token）。請替這個 watcher 使用一組獨立的配對憑證。提供和上面說明相同的裝置檔，然後在 `infra/relay` 底下執行：

```sh
vp run push:android:watch /path/service-account.json /path/device.json /path/connection.json
```

Android 的原生 handler 必須已經用那個裝置和帳號設定好，而且必須允許通知。原生的 instrumentation harness 可以在測試前設定一台用完即丟的模擬器；已登入的開發版 app 則會在裝置註冊時設定 handler。這個 watcher 是開發用的傳輸方式：它會觀察所配對 environment 裡所有未封存的 Thread、啟用所有 alert 類型、沒有持久化的佇列，而且必須一直保持執行。它不會向既有的 hosted relay 註冊 Android 裝置。Hosted relay 需要先有下面的變更，它的通知設定和送達才能從頭到尾運作。

### Hosted delivery {#hosted-delivery}

既有的 Alchemy 部署預設會佈建 Cloudflare Workers、送達用的佇列、Hyperdrive、tunnel/DNS 資源、PlanetScale Postgres，以及 Axiom 的可觀測性。它需要所啟用服務的憑證和私密的 Clerk 設定；repository 裡公開的 app 設定並不會給你部署的權限。在只用於 Android 的開發用 relay 上，設定 `APNS_ENABLED=false` 可以跳過 Apple 的送達以及它所需要的憑證。APNs 預設仍然是啟用的。

#### 在既有部署帳號裡的個人 stage {#personal-stage-in-the-existing-deployment-accounts}

擁有既有 Alchemy state 和部署憑證存取權的維護者，可以把 Android 的變更部署到個人 stage。非正式環境的 stage 會參照 `prod` stage 所擁有、被保留下來的資料庫和 DNS zone，另外建立一個獨立的 PlanetScale 分支，並把 migration 套用到那個分支上。所以個人 stage 並不是部署到某個無關帳號裡的獨立部署。

1. 把 Android 的變更套用到一個擁有既有部署憑證的 checkout 上。建立一個私密的 `infra/relay/.env.android-dev`，內容使用 [relay README](../../infra/relay/README.md#deployment-ci) 所說明的既有 Cloudflare、PlanetScale、Axiom、網域和 Clerk 設定。`CLERK_PUBLISHABLE_KEY`、`CLERK_SECRET_KEY` 和 `CLERK_JWT_AUDIENCE` 要和測試用 client 所使用的 Clerk instance 保持一致。
2. 把 Firebase 的 service-account JSON 加進去，設成 `FCM_SERVICE_ACCOUNT`，並替這個只用於 Android 的 stage 設定 `APNS_ENABLED=false`。`RELAY_DOMAIN` 不要設定，這樣部署會替個人 stage 推導出一個 hostname，而不是使用正式環境的 hostname。
3. 在 repository 根目錄，先檢視部署計畫，再部署同一個 stage：

   ```sh
   vp run --filter t3code-relay deploy --stage dev_ryan_android --env-file .env.android-dev --dry-run
   vp run --filter t3code-relay deploy --stage dev_ryan_android --env-file .env.android-dev
   ```

4. 把部署好的 relay URL 和對應的公開 Clerk 設定交給測試者。Deploy wrapper 也會把 relay URL 和公開的 tracing 設定寫進那個 checkout 根目錄的 `.env`。用這個 `T3CODE_RELAY_URL`、既有的 Firebase Android 檔案，並在停用 OTA 更新的情況下，重新建置私人 APK。如果使用的是獨立的開發版 package，請依照上面的說明授權它的 Clerk callback。
5. 用同一個 relay URL 設定一台隔離的 T3 server，並透過新的 relay 連結那個測試用的 environment。既有的正式環境 relay 連結不會自動搬到個人 stage。替測試用的 environment 啟用 activity publishing，在手機上啟用通知，然後驗證：手機鎖定時，一次真正的 agent turn 會產生一則 running 更新和一則完成的 alert。

維護者可以自己執行部署，只把公開的 client 設定交回來；測試者不需要拿到他們的 hosting 或 Clerk server 憑證。完全獨立的部署則需要自己的初始 Cloudflare stack、PostgreSQL 資料庫、Firebase 專案，以及一個操作者可以自行設定的 Clerk instance。它的 Alchemy 部署需要 PlanetScale 和 Axiom 的憑證。

建置 host client 和手機 app 時，要使用相同的 relay URL 和 Clerk 公開設定。從原始碼執行的 server，或是桌面版的開發 build，都可以用來架設測試用的 environment；它的 T3 home 要和既有的安裝分開。只在手機上登入，並不會連結任何 host environment。請用 host client 的 T3 Connect 設定來連結它，並啟用 activity publishing。私人的 Clerk instance 在使用 `t3 connect login` 之前，還需要有自己的 CLI OAuth application；repository 裡的正式環境 CLI client ID 屬於維護者的 instance。

如果要透過 GitHub Actions 部署，請把 `FCM_SERVICE_ACCOUNT` 加到 `production` environment 的 secrets 裡。Relay 的 workflow 會把它傳給 Alchemy。維護者還必須在原生建置的環境裡，提供正式環境 Android package 用的 `google-services.json`；只改 relay 的 secret，無法把已安裝的 app 換到另一個 Firebase 專案。

Android 的送達使用 `RelayFcmDeliveryQueue` 和一個獨立的 dead-letter queue。失敗的 request 會重試；訊息在五分鐘後過期。送出之前，consumer 會重新檢查裝置 token、目前的偏好設定、environment 連結，以及目前的 Thread 狀態。`UNREGISTERED` 回應只會讓相符的那一個裝置 token 失效。OAuth token 會快取在 FCM service 內部，並在授權失敗之後重新取得。
