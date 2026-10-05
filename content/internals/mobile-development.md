---
title: 手機版開發的生命週期
nav: 手機版開發
source: docs/internals/mobile-development.md
source_hash: 9f0cb9d2e2fb4c72992e65b53d0ea8dc81d93532
---

[連線 runtime 的 HMR 邊界](../../apps/mobile/src/lib/hot-swappable-atom-runtime.ts)會保留一個穩定的 atom runtime，並透過一個可寫入的 atom 來替換它的 Effect layer。它只有在裝好新的 layer 之後，才接受這次更新。否則，即使 Metro 回報重新整理成功，匯入它的模組仍然會保有舊的行為。

不要為了讓連線 runtime 的修改生效，就去重設共用的 atom registry。重設會把已掛載的使用者（consumer）身上的 listener 移除，而 Metro 並沒有理由重新 render 它們。當 registry 或 managed-runtime 模組本身有變動時，Metro 正常的更新傳遞機制會釋放它的舊資源。這個邊界並不會讓任意的模組層級 atom family 變得可以安全地 hot-swap。正式環境使用的是一般的 atom runtime。

[Environment supervisor 的 scope](../../packages/client-runtime/src/connection/registry.ts) 是 registry scope 的子 scope。以 environment 為單位的 map 支援針對性的關閉，但是在清理工作執行之後才建立的 supervisor 會逃過它。父 scope 關閉時，也會把晚到的一併關掉，避免被中斷的啟動流程或 runtime 替換，在新的 registry 之外留下一條還活著的 WebSocket。

[Uniwind patch](../../patches/uniwind@1.11.0.patch) 仍然會在 Metro 更新時編譯 CSS，這樣才能發現新用到的 class。只有在產生出來的 stylesheet 和主題清單都沒變時，它才跳過全域的樣式失效（invalidation）。跳過編譯會漏掉新的 class；而輸出沒變卻讓每一個使用者都失效，會讓一次普通的元件修改重新整理整個 app。Fingerprint 只有在初始化成功之後才會被記錄下來。

[expo-notifications patch](../../patches/expo-notifications@57.0.15.patch) 用一把鎖來保護 `NotificationCenterManager` 的 delegate 和待處理的 response。在重新載入或 scene 啟動期間，多個 React runtime 可能同時註冊和移除 delegate。遞送時會在持有鎖的狀態下替 delegate 做一份 snapshot，放開鎖之後才呼叫它們。重播待處理的 response 時，只會移除它那份 snapshot 裡的 response，保留在 callback 執行期間收到的 response。修改這個原生 patch 之後，需要重新安裝相依套件並重新建置 iOS app。`apps/mobile/modules/` 底下的原生模組是 `file:` 相依套件，pnpm 會把它們複製進自己的 virtual store，而不是建立連結。Metro 打包的是那份複本，所以修改某個模組的 TypeScript 之後，在 `vp i` 重新同步之前，執行中的 dev client 都看不到這個修改；而 Gradle 和 CocoaPods 則是直接編譯 worktree 裡的目錄。在裝置上「改了 JavaScript 卻沒有效果」，通常就是這個原因。

:::note 改了原生模組的 TypeScript 卻沒反應
`apps/mobile/modules/` 裡的模組，Metro 讀的是 pnpm 複製出來的那一份，不是你正在編輯的那一份。改完之後先執行 `vp i` 讓複本同步，再看結果。原生程式碼（Gradle、CocoaPods 編譯的部分）沒有這個問題，它們讀的就是 worktree 裡的目錄。
:::
