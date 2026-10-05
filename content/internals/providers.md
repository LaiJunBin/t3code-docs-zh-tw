---
title: Provider 的限制
source: docs/internals/providers.md
source_hash: a68980e548451570b8a662ca39f52a246ac4d330
---

Orchestration 記錄意圖和狀態時，並不知道一個 Thread 是由哪個 Provider 執行的。Provider 的協定、帳號歸屬、權限和能力，都屬於 [adapter 界線](../../apps/server/src/orchestration-v2/ProviderAdapter.ts)。請在那裡做正規化，不要把針對 Provider 的檢查散布到 orchestration 和各個 client 裡。

Driver kind 識別的是一種整合實作；instance 識別的是一份設定和一個帳號的生命週期。工作要依 instance 來路由，這樣使用同一個 driver 的兩個帳號，就不會共用可變的 session 狀態或 catalog 狀態。

:::plain driver 和 instance 的差別
Driver 是「哪一種 Provider」，例如 Claude；instance 是「哪一份設定、哪一個帳號」，例如公司帳號的 Claude 和個人帳號的 Claude。兩個 instance 可以共用同一個 driver，但 session 和模型清單這類會變動的狀態必須各管各的，所以程式裡要用 instance 來決定工作送去哪裡，而不是用 driver。
:::

## 行程與帳號的隔離 {#process-and-account-isolation}

`opencode` driver 會探測已安裝的版本，然後執行 1.x 或 2.x 的 runtime。OpenCode 的 MCP 註冊是以目錄為範圍，而 T3 的 MCP 連線是以 Thread 為範圍，所以同一個目錄裡的多個 Thread 不可以共用同一筆 T3 MCP 項目。

- **1.x** 每個 Thread 使用一個由 T3 管理的 chat server，所以 Thread 之間不會互相換掉對方的連線。Catalog 和文字生成的工作可以共用[由 instance 擁有的 helper](../../apps/server/src/provider/OpenCodeServerOwner.ts)，它在閒置一段時間後會關閉。參見 [1.x adapter](../../apps/server/src/orchestration-v2/Adapters/OpenCodeAdapterV2.ts)。
- **2.x** 用[每個 instance 一個 server](../../apps/server/src/provider/opencode2/OpenCode2Server.ts) 來服務所有目錄。每個 Thread 註冊自己的 `t3-code-<thread>` MCP 項目，而 session 的權限規則會拒絕其他所有 Thread 的項目。參見 [2.x adapter](../../apps/server/src/orchestration-v2/Adapters/OpenCode2AdapterV2.ts)。

外部的 OpenCode server 仍然由外部擁有，可能需要從外部重新啟動才能套用設定變更。OpenCode 會把「always」的核准授權存成整個專案適用。自動的 full-access 回覆使用 `once`，這樣它們就不會在共用的 server 上放寬一個 supervised Thread 的權限。在 2.x 上，整個 session 適用的核准同樣回覆 `once`，然後變成 T3 自己在那個 session 上的規則。

Pi 以 RPC 模式執行使用者自己安裝的 `pi`，並由它自己負責原生的 extension、package 和專案信任的探索。T3 只注入自己那個帶有命名空間的 MCP bridge，所以 Pi session 的行為和在 Pi TUI 裡一樣。Pi 的 session 檔案支撐了原生的 resume、rollback，以及同一個 instance 內的 Thread fork。Fork 是在目的地目錄裡使用 Pi 的 CLI 來做，因為透過 RPC 切換 session 會保留來源 session 的 cwd。切換 Provider 時仍然使用可攜的 handoff 摘要。參見 [adapter](../../apps/server/src/orchestration-v2/Adapters/PiAdapterV2.ts)。

Antigravity 每個 instance 各有獨立的帳號 profile，但已安裝的執行檔在整個 environment 內共用。它強制使用檔案形式的憑證儲存，因為原生的 macOS keychain 項目否則會被各個 instance 共用。啟動行程時所用的環境會移除周遭既有的 Google 憑證，所以一個 instance 不會悄悄用到另一個帳號或另一個計費專案。agent 也會在那個 profile 底下解析它的使用者全域 skill 目錄，所以 profile 會把那兩個目錄連結回使用者真正的 `~/.gemini`；那裡的 MCP server、hook 和規則則不會進到 profile 裡。參見 [profile 隔離](../../apps/server/src/provider/antigravityAuthSupport.ts)。

[Antigravity 安裝程式](../../apps/server/src/provider/AntigravityInstallation.ts)的生命週期比 client 連線和 Provider instance 的重建都長。每個發行版本都是不可變的，由一個 atomic 的指標來選定新行程要用的版本。執行中的行程對自己使用的版本持有 lease。更新和移除都必須尊重這些 lease，而不是在執行中的 agent 腳下換掉執行檔。

## 設定動作不可以是健康檢查的副作用 {#setup-must-not-happen-as-a-health-check-side-effect}

開啟一個 Provider session 可能會啟動 MCP server、執行 hook，或是開啟登入用的瀏覽器。[Grok 的探測](../../apps/server/src/provider/Layers/GrokProvider.ts)因此避開了身分驗證和建立 session。Antigravity 也一樣，把需要驗證的 catalog session 保留給明確的設定動作或模型重新整理；背景檢查只做初始化。

:::plain 為什麼健康檢查要這麼小心
健康檢查是在背景自動跑的。如果它為了確認 Provider 能不能用而真的開一個 session，使用者可能什麼都沒按，卻有 MCP server 被啟動、hook 被執行，甚至跳出登入用的瀏覽器。所以背景檢查只做不會引發這些事情的動作，其餘的留到使用者明確要求時才做。
:::

[Antigravity 登入](../../apps/server/src/provider/AntigravityAuth.ts)屬於發起它的那個 T3 auth session。Client 會把 return URL 帶回 environment，因為 Provider 的 loopback listener 可能在另一台機器上。只轉送屬於自己那個待處理流程的 callback；一次成功的 callback HTTP 請求，並不能證明 Provider 的身分驗證已經完成。Token 的交換與儲存由原生行程負責。

針對遠端 environment 的受管 ChatGPT 登入，可以在本機的 primary 上完成。[Primary handoff](../../apps/server/src/provider/CodexChatGptHandoff.ts) 使用暫時性的憑證儲存和目的地的 environment ID。它會先交換並驗證 code，然後才轉移所發出的 client registration 和 token。只有目的地會持久保存並更新那個 session；如果 primary 這邊也留著一個可以 refresh 的 session，就會和 refresh token 的輪替互相競爭。沒有本機 primary 時，client 會使用遠端的 callback 完成流程。

Antigravity 登出時，會先停止接受新行程、停掉既有的行程，然後才清除帳號的 metadata。否則某個 helper 或被恢復的 session 可能還握著舊帳號。快取的模型清單並不能證明目前有存取權，而一份具權威性的空 catalog 必須把舊清單清掉。

Antigravity 的文字生成 helper 會拒絕工具請求，但原生的 hook 和 MCP 設定可能在 prompt 之前就先執行。所以它們在啟動之前，就會拒絕帶有這類設定的 profile。Prompt 裡的指示和拒絕工具請求，並不會形成一個原生的 sandbox。參見 [helper 的限制](../../apps/server/src/textGeneration/AntigravityTextGeneration.ts)。

## Provider 的更新只透過擁有它的安裝程式執行 {#provider-updates-run-only-through-the-owning-installer}

只有在解析出來的執行檔路徑能夠證明是哪個安裝程式擁有它時，才會提供一鍵更新。Homebrew 和 npm 是用真實路徑（跟隨 symlink 之後）來證明：`brew --prefix` 底下一個帶版本的 keg 或 cask，或是 `<prefix>/lib/node_modules/<pkg>/`（Windows：`node_modules` 旁邊的 shim）。原生安裝程式的目錄配置，以及 pnpm、Bun 和 Vite+ 的全域 bin 目錄，可以用解析出來的路徑或它的真實目標任一個來比對，因為這些安裝程式會在那裡放真正的檔案或它們自己的 symlink。Cursor 和 Grok 是例外：它們唯一的更新方式就是 CLI 自己，而 CLI 會偵測自己的安裝程式，所以任何解析出來的執行檔都是執行 `<binary> update`。任何無法證明的情況都維持只能手動更新，但仍然會回報版本落差。npm 更新會固定 `--prefix`，因為 `PATH` 上的 `npm` 可能屬於另一個 Node，而不是擁有這個 Provider 的那一個。Homebrew 是和 `brew info` 比對，因為 cask 會比 npm 晚上幾個小時；原生安裝和 npm 走同一條版本列車，所以對它們來說仍然以 registry 為準。參見 [resolver](../../apps/server/src/provider/providerMaintenance.ts)。

:::plain 「證明擁有者」是什麼意思
同一個 Provider 可能是用 Homebrew、npm、pnpm 或它自己的安裝程式裝的。用錯工具去更新，動到的可能不是實際在用的那一份（例如 `PATH` 上的 `npm` 屬於另一個 Node）。所以 T3 Code 會先看執行檔實際放在哪裡，從路徑判斷它是誰裝的，確定了才提供一鍵更新；判斷不出來的話，只告訴你有新版本，由你自己手動更新。
:::

擁有者資訊會依 instance 快取起來，並在更新執行前立刻重新讀取一次。[Runner](../../apps/server/src/provider/providerMaintenanceRunner.ts) 發現 lock key 在提出更新建議之後變了，就會拒絕執行；而且只有在重新整理後的 Provider 仍然是已安裝狀態、版本可讀取且是最新版時，才會回報成功。

## 協定的陷阱 {#protocol-traps}

Codex 的非同步提問是以通知的形式送來，要用一則新的使用者訊息來回答。並沒有一個等待中的 RPC 回應可以送。[Adapter](../../apps/server/src/orchestration-v2/Adapters/CodexAdapterV2.ts) 把它們持久化成 `user_input_request` turn item，以及帶有 `responseCapability: { type: "message" }` 的 runtime request。它們的 execution node 不會擋住 run。網頁、桌面和手機都使用各自一般的提問面板，而且在 turn 結束、Provider 退出或 server 重新啟動之後，這些請求仍然保持待處理狀態。

`runtime-request.respond` 會讀取已持久化的 request 和 question item，驗證必填的答案，然後在同一個 transaction 裡提交解決結果和一則使用者訊息。重複送出同一個 command 會回傳它的 receipt，不會把答案貼兩次。一般的訊息路徑會啟動或恢復一個 run、排在進行中的工作後面，或是在 adapter 支援時進行 steer。阻塞式的提問則保留 Provider 的即時回應路徑。不要只因為某個請求落在最近的歷史視窗之外，就推斷它已經消失了。

:::plain 兩種提問
一種是阻塞式的：Provider 停在那裡等答案，T3 Code 直接把答案回給那個還在等的請求。另一種是 Codex 的非同步提問：Provider 只是「通知」有個問題，沒有東西在等回應，也不會擋住 run，所以回答的方式是送一則新的使用者訊息。後者會被存起來，就算 turn 結束或 server 重新啟動，問題還是會留在那裡等你回答。
:::

能力（capability）必須描述 Provider 實際做得到的事。Antigravity 可以擷取 workspace 的 checkpoint，但無法 rollback 它的對話。因此 [checkpoint 界線](./overview.md#turn-completion-and-checkpoints)會在動到檔案之前就拒絕 revert。原生的權限選項 ID 和提問選項 ID 也必須在正規化之後保留下來；顯示用的標籤不一定是有效的回覆。

## 附件與已儲存的歷史 {#attachments-and-stored-history}

附件存放在專案 workspace 之外。[附件界線](../../apps/server/src/orchestration-v2/AttachmentClaims.ts)負責驗證上傳的檔案，並把它們 claim 給某個 Thread；adapter 則為這些位於 environment 本機的檔案選擇原生的輸入格式。Prompt 裡出現一個路徑，並不代表授予了檔案系統存取權。Provider 的 sandbox 和核准規則要維持有效；為了繞過它們而把上傳的檔案複製進專案，會改變這條界線。

檔案附件帶來了一個 replay 相容性的限制。只支援圖片的 client 無法解碼帶有檔案的訊息，而只支援圖片的 server 在 replay 到一個這樣的 event 時，可能讓整個 environment 啟動失敗。發布與降版時，除了目前 client 的支援程度，也必須把已持久化的歷史算進去。

## Provider 診斷 {#provider-diagnostics}

原生 event log 會保留生命週期 event、回應和失敗。Token delta 和重複的原始 frame，會在 adapter 複製或遮蔽（redact）payload 之前就被過濾掉。這個過濾器同時接受舊版的原生 event 和 v2 協定的 envelope；解碼失敗則仍然可以透過診斷 frame 看到。

Log 的 payload 有 64 KiB 的編碼後預算。很大或巢狀很深的 payload 會變成結構摘要，保留路由用的識別碼、method、狀態和錯誤欄位。走訪（traversal）在遮蔽和序列化之前就先設了上限，所以記錄一個很大的回應時，不需要做好幾份完整的複本。這些限制只套用在診斷上；Provider event 的處理不受影響。

Codex 只需要某個 Thread 的身分和更新時間時，會用只讀 metadata 的方式來 resume。它的初始化能力選擇不接收 `turn/diff/updated`：T3 是從 checkpoint 推導出 diff 的。較舊的 Provider 仍然送出這些通知時，logger 會在走訪之前就把它們過濾掉。

模型分類有它自己的 [manifest 限制](./model-manifest.md)。助理參照（assistant reference）的處理方式記載在 [citations](./assistant-citations.md)。
