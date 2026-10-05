---
title: 遠端 environment
source: docs/internals/remote.md
source_hash: 43d96f862e3b42fe48e8035ccff0c39595cc81db
---

每一條連線都是透過 HTTP 和 WebSocket，把一個 client 接到一個 environment。Provider、執行工作、檔案和持久狀態都屬於 environment。直接存取、Tailscale、SSH 和 T3 Connect 改變的只是 client 怎麼連到那台 server；它們並不會帶來另一種執行模型。設定方式請看[遠端存取](../user/remote-access.md)。

## 身分與路由無關 {#identity-is-independent-of-the-route}

Environment 在 server 重新啟動和 endpoint 變更之後，仍然保有同一個 ID。已儲存的連線是 client profile 本機的資料；server 的身分和狀態則不是。Repository 身分可以用來對應不同 environment 上的 clone，但絕對不會用來在它們之間路由工作。一個專案和它的 Thread 只屬於一個 environment。

:::plain 換了網址還是同一台
Environment 的 ID 是它自己的身分，跟你用哪個位址、哪種方式連過去無關。同一個 repository 在兩台機器上各 clone 一份，T3 Code 可以認出它們是同一個 repository，但兩邊的專案和 Thread 仍然各自獨立，工作不會從一台跑到另一台。
:::

[Environment ID 的初始化](../../apps/server/src/environment/ServerEnvironment.ts)必須以 atomic 的方式發布一個完整的 ID。修復空的 ID 檔案時，會保留一個 recovery 檔案，讓同時進行或延遲到達的初始化程序選出同一個贏家。把這份 recovery 狀態當成一般的暫存檔清掉，可能會讓一台已經在執行的 server 腳下的身分被換掉。

Server 宣告出來的 endpoint 只是「可能連得到」的提示。只有實際去連的那台裝置，才能證明一條路由行得通。特別要注意的是，host 的 loopback 位址在另一台裝置上打開時，指的是另一台機器。沒有可分享的 endpoint 時，endpoint 的選擇不可以悄悄退回成 loopback。

## Hosted web 也是一個 client {#hosted-web-is-a-client}

Hosted web app 把它的連線目錄存在瀏覽器裡，並直接連到每一個 environment。它不代理流量，也不在 server 端保存配對狀態。因此，就算 UI 是透過 HTTPS 提供的，也沒辦法讓一個純 HTTP 的區域網路後端，在那個瀏覽器環境裡變得可以存取。

[Hosted 配對 URL](../../apps/web/src/hostedPairing.ts) 用 query 來指明後端，並把配對 secret 放在 fragment 裡。Fragment 不會出現在送往 hosted origin 的請求裡。瀏覽器會拿這個 secret 去和 environment 交換，並把它從瀏覽紀錄中移除。如果把 token 改放到 query 參數，就會把它洩漏給錯誤的 origin。

:::plain 為什麼 secret 要放在 `#` 後面
URL 裡 `#` 後面的部分（fragment）只留在瀏覽器裡，不會隨著請求送到提供網頁的那台主機。配對 secret 只該交給你的 environment，不該讓 hosted 網站那一端看到，所以放在 fragment；放在 `?` 後面的 query 就會跟著請求送出去。
:::

## 存取方式和行程歸屬是兩回事 {#access-and-process-ownership-are-different}

Tailscale 提供的是一個可以拿來做一般配對的 endpoint，所以不需要另外一種 environment 類型。不論走哪一條路由，身分驗證都是 environment 的責任。參見 [environment 驗證](./environment-auth.md)和 [T3 Connect 的信任界線](./t3-connect.md)。

SSH 除了轉送 port，也可以啟動一個 server。這段生命週期由桌面 app 的 main 擁有，因為它能夠 spawn SSH 並處理驗證提示。Renderer 則透過共用的連線 runtime 使用轉送出來的 endpoint。[SSH 清理](../../packages/ssh/src/tunnel.ts)只有在 server 是由 launcher 擁有時才會停止遠端的 server；它發現時就已經在執行的 server，必須在 client 斷線之後繼續存活。重新連線時，會先恢復 port 轉送，再開啟應用層的傳輸。

遠端 server 的壽命可能橫跨好幾個 client 版本。Client 必須使用 server 宣告的能力，並處理能力不存在的情況，而不是假設自己的版本就能代表 server。行程的替換屬於 launcher 的[更新協定](./server-updates.md)；連線 runtime 負責處理隨之而來的斷線。

### 沒有本機 environment 的桌面版 {#desktop-without-a-local-environment}

桌面版通常會啟動它自己的 primary server，但桌面設定 `localEnvironmentEnabled`（`apps/desktop/src/settings/DesktopAppSettings.ts`）可以把它關掉。改動這個設定會重新啟動 app；不會刪除任何本機狀態。下次啟動時，main process 會跳過 port 選擇、server 對外公開，以及 primary 和 WSL 後端，並立刻開啟視窗。Renderer 透過 `desktopBridge.getLocalEnvironmentEnabled()` 得知這件事：`readPrimaryEnvironmentTarget` 回傳 null，所以 primary 驗證和由平台管理的探索都會被跳過，只有已儲存的 environment（配對、relay、SSH）會連線。之所以做得到，是因為桌面版的 renderer 不是由後端提供的：`t3code://` scheme 從磁碟提供打包好的 client（開發時則是 Vite），而 API 流量一律送往 environment 自己的 URL。
