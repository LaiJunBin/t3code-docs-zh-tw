---
title: T3 Connect
source: docs/internals/t3-connect.md
source_hash: 367d9116e92e42a0e53a7d19a185199a121e25cf
---

T3 Connect 使用 Clerk 作為雲端身分。Relay 負責管理 environment 的連結（link）、用來連到 environment 的憑證，以及受管 tunnel 的配置。Bootstrap 完成之後，client 的應用流量是透過 environment 的 tunnel hostname 傳送；relay Worker 並不代理它們的 HTTP 或 WebSocket session。

Clerk、部署和原生驗證的設定，都放在 [Connect 設定 runbook](../operations/connect-setup.md)。

## Relay 是受信任的中介者 {#the-relay-is-a-trusted-broker}

一個已通過驗證的雲端使用者，仍然需要有一個有效的 environment 連結。Relay 會要求那個 environment 簽發一份一次性的 bootstrap 憑證，並綁定到 client 的 DPoP key。Client 直接拿它去和 environment 交換一個 [environment session](./environment-auth.md)。Relay 永遠不會收到那個 session token，而且光是持有 bootstrap 憑證、沒有 client 的私鑰，也無法兌換它。

:::plain Relay 做什麼、不做什麼
Relay 像是介紹人：它確認你是誰、確認你和這個 environment 之間有連結，然後請 environment 開一張只能用一次、而且只有你的裝置能用的入場憑證。真正的登入（換到 session）是你的裝置直接跟 environment 完成的，relay 看不到 session token，之後的對話流量也不經過它。
:::

這次交換的兩邊都會驗證對方。Environment 只接受有期限、有防重播保護的 relay proof，而且這份 proof 必須是針對它自己的身分、已連結的使用者，以及所要求的操作。Environment 簽章過的回應會把結果綁定到請求的 nonce；簽發憑證的回應還會把憑證綁定到 client 的 proof key。Relay 在回傳憑證之前會驗證這些綁定。這可以防止 tunnel 後面另一個行程冒充已連結的 environment。這些檢查落在 [environment 的 cloud handler](../../apps/server/src/cloud/http.ts) 和 [relay connector](../../infra/relay/src/environments/EnvironmentConnector.ts) 這兩處。

Relay 握有簽發請求的簽章權限。DPoP 保護的是一次誠實的交換不被重複使用憑證；它並不會讓「relay 簽章金鑰外洩」這件事變得無害。修改協定時，要把這個信任假設明確寫出來。

受管 tunnel 只會公開一個經過驗證的 loopback HTTP origin。連結 proof 的檢查會拒絕被轉送的 authority header，而 relay 是從它自己管理的配置來解析 endpoint，不是用呼叫端提供的 URL。健康檢查和簽發請求都不可以跟隨重新導向。這些限制是為了避免 endpoint 探索變成任意的 relay 對外連線，或是把 environment 主機上的另一個服務暴露出去。

## 連結的壽命比 connector 行程長 {#a-link-outlives-a-connector-process}

CLI 授權、期望的公開狀態，以及執行中的 connector，三者的生命週期各不相同。Server 停止時，連結動作仍然可以先把意圖記錄下來。啟動時再依這份意圖做對帳。CLI 登出會移除已儲存的雲端憑證並停用公開，但不會解除安裝 environment 的背景 service。

受管配置屬於一組「使用者／environment」配對。Provisioning 會為外部的 tunnel 和 DNS 資源留下 checkpoint，讓重試時可以對帳只做到一半的工作。由 CLI 管理的連結在正常關機時會釋放它的 tunnel，避免為閒置的資源付費，但會保留 hostname 的預留，供下次啟動使用。它也會保留配置紀錄，這樣 environment 會維持在「offline」，而不是變成「not authorized」。

有兩種情況必須在關機時保留 tunnel。透過 client 安裝的連結沒有啟動時的 provisioning 路徑，要靠它已儲存的 connector token。更新交接則會立刻啟動一個替代的 server，如果換掉 tunnel，每次更新都會多出路由傳播的延遲。這些例外屬於[關機處理](../../apps/server/src/cloud/http.ts)。

釋放和解除連結（unlink）會先 claim 配置的 generation，再刪除外部資源。延遲執行的清理，不可以刪掉一個已經被同時發生的重新啟動或重新連結再次使用的 tunnel。Unlink 會先提交授權的撤銷，再拆除外部資源，因為資料庫失敗時必須讓有效的連結仍然可用。拆除失敗時會保留足夠的狀態以便重試。參見[受管 endpoint 的生命週期](../../infra/relay/src/environments/ManagedEndpointProvider.ts)。

## 閒置 tunnel 的回收與復原 {#idle-tunnels-are-reclaimed-and-recovered}

不論有沒有 connector 接著，Cloudflare 都會對 tunnel 計費，所以一台帶著已連結 environment 進入睡眠的筆電，會留下一條要付費的 tunnel。Relay 每五分鐘執行一次的維護工作可以回收這些 tunnel。`RELAY_TUNNEL_CLEANUP_MODE` 可以選擇 `off`、`dry-run` 或 `enabled`，預設是 `off`。這個模式是在部署時讀取的，所以要改它就得重新部署 relay，而不是切一下變數就好。回收的候選對象，是同一個 stage 裡、Cloudflare 回報已經 down 至少五分鐘的 tunnel，或是從未連線過、而且建立至少一小時的 tunnel。給從未連線的 tunnel 較長的寬限期，是為了涵蓋仍在進行中的配對。

清理只會刪除 host 已經註冊過復原（recovery）的 tunnel。沒有復原註冊的配置，屬於無法替換被刪除 tunnel 的 host，這些會被放著不動。沒有記錄 tunnel ID 的配置，或是 tunnel ID 不同的配置，都會被跳過，因為可能有一次 provision 正擁有它們。完全沒有配置資料列的 tunnel 會被計為 `skippedOrphan`，而且絕對不會被刪除：沒有資料列可以上鎖，所以一次用名稱把它接收過去的重新連結，可能會和刪除動作互相競爭。這類 tunnel 要手動清除。每次清掃都有上限：最多十次 list 請求、100 次刪除、兩分鐘的期限，遇到 Cloudflare 的 rate limit 就提早停止。每次清掃會從候選清單往後移一個預算的位置開始，所以一整批一直刪除失敗的項目，不會讓排在它們後面的 tunnel 永遠輪不到。參見 [reaper](../../infra/relay/src/environments/ManagedEndpointReaper.ts)。

:::plain 哪些 tunnel 會被回收
會被刪的只有同時符合這幾點的：斷線夠久（或建立夠久卻從沒連上）、relay 的紀錄和它對得上、而且它的 host 已經登記過「被刪掉之後我有辦法自己要一條新的」。只要有一點不確定（紀錄對不上、找不到紀錄、host 沒登記復原），就寧可留著不刪。
:::

Host 在啟動時註冊復原：它送出自己的 tunnel ID 和 loopback origin，並附上一個由 environment key 產生的短效簽章。註冊只有在本機的 host 或 port 改變時才會動到 Cloudflare；另外，升級之後的第一次註冊，每個既有的配置也會各動到一次，因為當時儲存的 origin 是空的。第一次註冊會加上 jitter，這樣一波自動更新不會同時打到 relay。Host 會把一個「已確認 origin」的標記和 connector 設定存在一起；之後開機時，只有在這個標記和目前的設定與 port 相符的情況下，才會在註冊之前先啟動 connector。如果註冊有十分鐘都連不上 relay，host 還是會先用已儲存的設定啟動，並在背景持續註冊，直到能夠把 origin 對帳完成為止。如果 connector 結束了，或是 `cloudflared` 回報 tunnel 一再被拒絕，host 會向 relay 要求一條替代的 tunnel，最多每兩分鐘一次。Relay 會在同一個配置底下做 provisioning，所以 hostname 和 DNS 紀錄都會保留，client 也能保有它們的綁定。對一個配置的每一次變更都會讓它的 `generation` 加一，而刪除時會把資料列鎖在它 claim 的那個 generation，所以在清掃途中重新連上的 host 會勝出。

## OAuth 的陷阱 {#oauth-traps}

互動式 client 和 headless 的 CLI 使用同一個 Clerk 應用程式，但使用不同的憑證。Relay 同時接受 session-template JWT 和 CLI 的 OAuth token；如果要求 CLI 也使用 JWT template，會把有效的登入擋掉。CLI 是使用 PKCE 的公開 OAuth client，不儲存 client secret。

Loopback 的 CLI 授權是從 hosted 的 `/connect` 頁面開始，這樣登入會在進入 Clerk 的 authorize endpoint 之前完成。把一個尚未登入的瀏覽器直接送到那個 endpoint，會在登入重新導向的過程中遺失 authorize 參數。[共用流程](../../packages/shared/src/connectAuth.ts)會為 loopback callback 保留 PKCE 和 state。

SSH 和 headless 的 session 使用 Clerk 的 OAuth device authorization grant，因為瀏覽器通常連不到遠端機器上的 listener。使用者在 Clerk 的 hosted 裝置頁面上核准一組短代碼的同時，CLI 會直接輪詢 Clerk 的 token endpoint；hosted app 完全沒有參與，也沒有 redirect URI 或 PKCE。這個 grant 必須在 CLI 的 OAuth 應用程式上啟用，否則 device endpoint 會在顯示任何提示之前就回傳錯誤。
