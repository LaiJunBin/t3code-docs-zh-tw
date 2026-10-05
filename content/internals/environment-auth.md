---
title: Environment 驗證
source: docs/internals/environment-auth.md
source_hash: 2428783ccc56531e1281ef056ed3b216539210e4
---

Environment 自己簽發 session，並強制執行這些 session 的能力範圍。雲端身分和 relay 憑證屬於另一條信任界線，在 [T3 Connect](./t3-connect.md) 裡說明。Relay token 絕對不是 environment 的登入憑證。

## 權限不因傳輸方式改變而改變 {#authority-survives-transport-changes}

配對（pairing）會委派一組 scope。交換 bootstrap 憑證時可以把這份授權縮小，但不能放大。一般的配對不會授予存取管理或 relay 管理的權限。要建立另一個配對連結，必須同時擁有 `access:write` 以及所有要委派出去的 scope。[Auth handler](../../apps/server/src/auth/http.ts) 在簽發時強制執行這一點；client 的標籤和裝置 metadata 在授權上沒有任何作用。

:::plain 權限只能往下傳，不能變多
你能分給別人的權限，不會超過你自己手上有的。要再產生一個配對連結給別的裝置，你自己得先有「管理存取」的權限（`access:write`），而且連結裡要給出去的每一項 scope，你自己都必須有。裝置叫什麼名字、是什麼機型，跟它能做什麼完全無關。
:::

存取的 read model 只包含配對的 metadata，絕不包含可以還原的配對 secret。只有建立時的那一次回應會回傳原始憑證。否則，只要能讀取連線列表，就等於有辦法取得另一個 client 的權限。

瀏覽器 cookie、bearer token 和 DPoP token，都是同一個帶 scope 的 session 模型的不同轉接方式。DPoP 把 token 綁定到 client 的 proof key；proof 無效時必須直接失敗，不可以退而改用 bearer 驗證。OAuth token-exchange 的詞彙讓這些授權有個大家熟悉的意義，但 environment 並沒有實作一個通用的 OAuth authorization server。

Bearer 和 DPoP client 透過已驗證的 HTTP 取得短效的 WebSocket ticket，這樣長效的 token 就不會出現在 socket 的 URL 裡。瀏覽器 session 可以用它的 cookie 來驗證 upgrade。握手成功並不會多給任何權限：[每個 RPC 都宣告了自己需要的 scope](../../apps/server/src/auth/RpcAuthorization.ts)。

:::note 新增 RPC 時
連線通過驗證，只代表「這個人是誰」確認了；每一個 RPC 方法還要各自檢查呼叫者有沒有對應的 scope。對應表是 `RpcAuthorization.ts` 裡的 `RPC_REQUIRED_SCOPES`：在 `WsRpcGroup` 新增一個 RPC 卻沒有替它選 scope，會是型別錯誤，而不是等到正式環境執行時才出錯。
:::

桌面 app 重新啟動後會忘記先前的本機 bearer token，所以它那份可重複使用的 bootstrap 授權，會取代同一個 subject 與 method 先前的 session。撤銷和新增是在同一個[資料庫 transaction](../../apps/server/src/persistence/AuthSessions.ts) 裡進行的；替換失敗時，必須讓舊的憑證仍然可用。配對 session 和瀏覽器 session 不適用這條替換規則。

### 可重複使用的開發憑證 {#reusable-dev-credential}

網頁開發環境可以在同一個 hostname 上，跨 worktree 和 port 接受同一個 `T3CODE_DEV_AUTH_TOKEN`。這個 token，以及含有它的啟動 URL，都會授予管理權限。桌面版和非開發用的 server 會忽略它。設定方式請看[開發 runbook](../operations/development.md#reusable-dev-credential)。

每個 environment 在啟動時會把這個值做雜湊，並在自己的資料庫裡建立一筆紀錄。Environment 之間不共用 SQLite 資料、簽章金鑰、environment ID、session 紀錄、配對授權，也不共用撤銷狀態。本機的撤銷在重新啟動後仍然有效，而且不會影響另一個 worktree。移除或輪替這個值之後重新啟動，會讓舊的憑證和它的 WebSocket ticket 失效。

一般的憑證仍然優先。一般憑證被拒絕時，絕對不會退而改用這個可重複使用的憑證。OAuth 交換會建立一般的本機 bearer 或 DPoP 子憑證，有正常的到期與撤銷機制。可重複使用的 cookie 會在 30 天後到期。

## Environment 才是檔案系統的界線 {#the-environment-is-the-filesystem-boundary}

專案是組織上的界線，不是檔案系統的 sandbox。`orchestration:read` 允許讀取 server 帳號讀得到的檔案，包括專案之外的絕對路徑。這讓 client 可以顯示 agent 寫在暫存目錄裡的產出物。相對路徑和寫入則仍然遵守 [workspace 路徑規則](../../apps/server/src/workspace/WorkspaceFileSystem.ts)。

:::plain 專案不是圍牆
把資料夾加成專案，並不會把讀取範圍限制在那個資料夾裡。擁有 `orchestration:read` 的 client，可以用絕對路徑讀到 server 那個帳號讀得到的檔案。真正的界線是「哪一台 environment、用哪個帳號在跑 server」。
:::

簽章過的 asset URL 本身就是 bearer 憑證。指向 host 上某個媒體檔的 URL，授予的是對一個正規化後的檔案及其 device/inode 身分的存取權，而不是它所在的整個目錄。[Asset access](../../apps/server/src/assets/AssetAccess.ts) 在提供檔案時，會重新檢查所開啟檔案的身分，所以用 atomic 方式替換檔案之後需要一個新的 URL，而原地編輯同一個檔案則不需要。用這種方式授權的 HTML 檔案無法載入同層的其他 asset；以目錄為範圍的 workspace 預覽是另一種授權。Client 應該分享作者寫下的檔案參照，這樣才不會洩漏暫時 URL 裡的憑證。

Host 上的影片可能被原地修改。它們的 [HTTP 回應](../../apps/server/src/http.ts)不帶快取驗證器（cache validator），因為檔案的 metadata 無法為 `If-Range` 證明內容每個位元組都相同。加上弱驗證器的話，會讓原生播放器的跳轉（seek）變成整個檔案重新下載。
