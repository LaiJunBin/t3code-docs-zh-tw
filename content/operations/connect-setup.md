---
title: T3 Connect 設定
source: docs/operations/connect-setup.md
source_hash: 899d5c4a33a8e9d52dcd51cd5607481170f97c33
---

T3 Connect 的部署與 client 設定。信任邊界的說明見[架構筆記](../internals/t3-connect.md)；relay 的佈建步驟則以 [relay README](../../infra/relay/README.md#deployment) 為準。

## 公開的應用程式設定 {#public-application-configuration}

剛 clone 下來的 repo 裡，T3 Connect 是停用的。要對著 production 部署來 build，請複製 repository 根目錄的範例檔：

```sh
cp .env.example .env
```

要用其他的部署，就在 repository 根目錄的 `.env` 或 `.env.local` 裡設定這些值：

```dotenv
T3CODE_CLERK_PUBLISHABLE_KEY=<publishable key>
T3CODE_CLERK_JWT_TEMPLATE=<JWT template name>
T3CODE_CLERK_CLI_OAUTH_CLIENT_ID=<public OAuth application client ID>
T3CODE_RELAY_URL=https://relay.example.com
```

行程的環境變數優先於 `.env.local`，其次才是 `.env`。請使用這些標準名稱；build loader 會自動補上各個框架專用的別名。這些值都是公開的識別字。`CLERK_SECRET_KEY` 只屬於 relay 的 secrets，絕對不要放進 client 的設定。

:::plain 哪些值可以公開，哪個不行
上面四個 `T3CODE_` 開頭的值是公開識別字，會被嵌進 build 出來的 client 裡。`CLERK_SECRET_KEY` 則是真正的 secret，只能放在 relay 那一側。
:::

Client 和內建 server 的 build 會把這些公開的值嵌進去，所以請在 build 之前設定好。EAS 的 preview 和 production environment 需要 publishable key、JWT template 名稱和 relay URL。對於由營運者自行管理的部署，內建的 server 也接受在 runtime 覆寫這些值。

Relay 的部署設定，請把 `infra/relay/.env.example` 複製成 `infra/relay/.env`。請先部署 `prod`，再部署個人 stage，因為 `prod` 擁有那個被保留的資料庫，個人 stage 的 branch 相依於它。Stack 的 `PublishClientConfig` 動作會把最後得到的 relay URL 寫回根目錄的 `.env`。

## CLI 的 OAuth application {#cli-oauth-application}

在 Clerk 的 OAuth applications 設定裡：

1. 為 T3 CLI 建立一個 public OAuth application，使用搭配 PKCE 的 authorization-code exchange。
2. 允許 redirect URI `http://127.0.0.1:34338/callback`。
3. 啟用 `openid`、`profile`、`email` 和 `offline_access` 這幾個 scope。
4. 在這個 application 上啟用 **Device authorization grant**。Headless 和 SSH 的授權流程會用到它，而且 Clerk 要在它開啟之後才會公告 device endpoint。這個功能還在 beta，Clerk 是依申請逐個帳號開通的。
5. 在本機與發版的 build 環境裡，把 `T3CODE_CLERK_CLI_OAUTH_CLIENT_ID` 設成產生出來的 public client ID。

## JWT template {#jwt-template}

建立一個名為 `t3-relay` 的 Clerk JWT template，claims 如下：

```json
{ "aud": "t3-code-relay" }
```

Client 設定 `T3CODE_CLERK_JWT_TEMPLATE=t3-relay`，relay 設定 `CLERK_JWT_AUDIENCE=t3-code-relay`。Production 的 relay 部署 environment 另外還定義了 `CLERK_JWT_TEMPLATE`。Audience 在各個 relay stage 之間都相同；選擇哪一個部署，是由 relay URL 決定的。

## 桌面版的 OAuth redirect {#desktop-oauth-redirects}

啟用 Clerk 的 Native API，並把桌面版的 redirect 加進它的 SSO redirect allowlist：

```text
t3code-dev://app/
t3code://app/
```

把對應的 origin 加進 Clerk instance 的 Backend API `allowed_origins` 陣列。開發用的是 `t3code-dev://app`；production 用的是 `t3code://app`。用 Clerk secret key 呼叫 `PATCH https://api.clerk.com/v1/instance` 來更新這個陣列，並保留既有的項目。Token 的保存，以及系統瀏覽器 callback 的傳遞，由 Clerk 的 Electron 整合負責處理。

## Android 原生登入的 redirect {#android-native-sign-in-redirects}

Clerk 的原生 Android SDK 使用 `clerk://<applicationId>.callback`。在 app 的 publishable key 所選定的那個 Clerk instance 裡，把每一個支援的 package 加到 **Native applications > Allowlist for mobile SSO redirect**：

| Variant     | Callback                                      |
| ----------- | --------------------------------------------- |
| Development | `clerk://com.t3tools.t3code.dev.callback`     |
| Preview     | `clerk://com.t3tools.t3code.preview.callback` |
| Production  | `clerk://com.t3tools.t3code.callback`         |

請保留既有的項目。這些 callback 和 `t3code-dev` / `t3code-preview` / `t3code` 這些導覽用的 scheme 是分開的。使用 production Clerk key 的私人 development build，仍然需要該 instance 的管理員把它的 development callback 加入允許清單；重新 build 同一個 package 並不會改變 allowlist。

## 桌面版 passkey {#desktop-passkeys}

針對 bundle ID 為 `com.t3tools.t3code` 的 production macOS app：

1. 在 Apple Developer portal 建立一個帶有 **Associated Domains** 的 explicit macOS App ID。
2. 為那個 App ID 和發佈用的簽章憑證建立一個 provisioning profile。
3. 在 Clerk 的 Native API 設定裡，新增一個 iOS app，使用相同的 Apple Team ID 和 bundle ID。這個設定同時也會套用到 Electron／macOS 的 passkey。
4. 檢查 `https://<frontend-api>/.well-known/apple-app-site-association`。它的 `webcredentials.apps` 必須包含 `<TEAM_ID>.com.t3tools.t3code`。
5. 依照[發版 runbook](./release.md#2-apple-signing--notarization-setup-macos) 的說明設定簽章。

本機的已簽章 build 另外還會用到：

```dotenv
T3CODE_APPLE_TEAM_ID=ABC1234567
T3CODE_MACOS_PROVISIONING_PROFILE=/absolute/path/to/t3code.provisionprofile
# Override only when the RP domain differs from the Clerk Frontend API hostname.
T3CODE_CLERK_PASSKEY_RP_DOMAINS=example.clerk.accounts.dev,clerk.example.com
```

沒有設定覆寫值時，build 會從 Clerk publishable key 推導出 RP 網域。修改 Associated Domains 之後，重新 build 之前請先把 build 版號往上加。否則 macOS 可能會對同一組 app／版號，重複使用過期的 Shared Web Credentials metadata。

一般的 `dev:desktop` launcher 沒有簽章，無法測試 macOS 的 passkey。要搭配 renderer HMR 的話，先安裝一個已簽章的 build，啟動 `vp run dev:web`，再用實際的 web 與 server port 啟動已安裝的執行檔。例如使用預設 port 時：

```sh
VITE_DEV_SERVER_URL=http://127.0.0.1:5733 \
T3CODE_PORT=13773 \
  "/Applications/T3 Code (Alpha).app/Contents/MacOS/T3 Code (Alpha)"
```

改到原生相依套件、main process、preload、entitlement、provisioning 或簽章之後，要重新 build 已簽章的 app。只改 renderer 的話可以沿用同一個 app。測試之前先驗證已安裝的 bundle：

```sh
codesign --verify --deep --strict "/Applications/T3 Code (Alpha).app"
codesign -d --entitlements :- "/Applications/T3 Code (Alpha).app"
```

## 限制註冊 {#restricting-sign-ups}

用 Clerk 的 allowlist 指定允許的 email 地址或網域，或是用 Restricted mode 做成只有受邀才能註冊。已啟用但內容是空的 allowlist，會擋下所有新的註冊。

註冊限制不會撤銷既有帳號的存取權。需要讓某個帳號目前的 session 和之後的登入都失效時，請在 Clerk 裡 ban 那個帳號。
