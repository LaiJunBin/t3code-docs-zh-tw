---
title: 更新 T3 Code
source: docs/user/updating.md
source_hash: c0f05fc89351faca4075e4e3972dd10b1624ca62
---

你使用的 app 和執行 agent 的 server，可以分別在不同的機器上。當某個 server 的版本落後於你的網頁版或桌面版 app 時，對話裡和 **Settings → Connections** 都會出現更新提示。請更新提示裡指名的那台機器。

:::plain 要更新的常常不是你眼前這台
T3 Code 有兩個部分各自有版本：你正在操作的 app（client），以及實際執行 agent 的 server。例如你用筆電的桌面版 app 連到一台遠端開發機，提示指名的如果是那台開發機，只更新筆電上的 app 是沒有用的，要到開發機上更新 server。
:::

## 更新之前 {#before-you-update}

更新 server 會讓連線重新啟動，並且可能中斷正在執行的 agent 和終端機指令。已儲存的 Thread、設定和專案檔案都會保留。

**Settings → General → Continue threads after restarts**（重新啟動後繼續 Thread）預設是關閉的。啟用它之後，更新、當機或機器重新啟動之後，支援的進行中 Thread 會接續執行。變更會儲存到有連線、而且支援這個設定的 environment；較舊的 server 請先更新。如果某個支援的 environment 當時離線，或是它的值不一樣，請等它連上之後，在 Settings 裡使用 **Apply to all**。T3 Code 必須在那台機器上再次啟動；這個設定不會讓它自動啟動。終端機指令仍然可能被中斷，而沒有儲存 Provider 續接狀態的 Thread，需要你送一則新訊息才會繼續。如果你之前啟用過「更新後繼續」的功能，請把這個設定啟用一次，才能在沒有 client 連線的情況下恢復。

:::note 這個設定不會幫你把 T3 Code 開起來
**Continue threads after restarts** 管的是「T3 Code 再次啟動之後，要不要把先前進行中的 Thread 接下去」。至於機器重開機之後 T3 Code 會不會自己啟動，是另一件事。如果希望開機後自動啟動，請參考[在背景執行 T3 Code](./background-service.md)。
:::

從舊的 orchestration 系統更新上來時，對話紀錄會保留，但沒辦法把每一種 runtime 歷史紀錄都帶過來。在繼續一個重要的舊 Thread 之前，請先閱讀[舊版 T3 Code 的 Thread](./thread-migration.md)。

## 版本不一致時 {#when-versions-dont-match}

Client 和 server 必須使用相同的 orchestration 協定。如果不同，連線會被拒絕，而不是在只升級了一半的狀態下執行：

- 比 server 新的 app 會在連線之前就被擋下，並出現一則提示，告訴你要在提示裡指名的那台機器上更新 T3 Code。
- 比你的 app 新的 server 會拒絕連線，並顯示一則更新訊息。

更新提示裡指名的那一邊，然後重新連線。

## 更新已連線的 server {#update-a-connected-server}

畫面上提供的動作，取決於 server 是用什麼方式執行的：

| 動作                       | 該怎麼做                                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Update server**          | 在它安裝並重新連線的期間，讓 client 保持開啟。支援的背景服務可以遠端更新。如果是桌面版 app 內建的 server，這個動作也會關閉並重新開啟主機上的桌面版 app。 |
| **Update the desktop app** | 在執行 server 的那台機器上更新桌面版 app，需要的話再重新開啟它。                                                                                     |
| **Copy update command**    | 在主機上停止命令列的 server，然後用複製的指令重新啟動，並保留你平常使用的啟動選項。                                                                  |

:::screenshot server-update-notice
**Settings → Connections** 裡某個 environment 的更新提示：顯示需要更新的機器名稱，以及 **Update server** 或 **Copy update command** 按鈕。
:::

在主機上執行：

```sh
t3 update <client-version>
```

把 `<client-version>` 換成提示裡顯示的版本。這個指令在重新啟動背景服務之前會先詢問；如果你拒絕了，請在準備好的時候執行 `t3 service restart`。如果 server 是你手動啟動的，更新之後請把它停掉，再用你平常的選項（例如 `--host` 或 `--tailscale-serve`）重新啟動。

如果你是用 `npx` 執行 server，而不是用已安裝的 `t3`，主機上就沒有東西需要更新：停止 server，然後用 `npx t3@<client-version>` 加上相同的子指令和選項重新啟動。

:::example 提示顯示的版本是 0.0.42 時
以下用 `0.0.42` 當例子，實際請換成提示裡顯示的版本。

用背景服務執行的主機：

```sh
t3 update 0.0.42
```

它問要不要重新啟動服務時回答是，或是之後自己執行 `t3 service restart`。

手動用 `t3 serve --host <private-ip>` 啟動的主機：先執行上面的 `t3 update 0.0.42`，再把原本的 server 停掉，用一樣的 `t3 serve --host <private-ip>` 重新啟動。

用 `npx` 執行的主機：停掉 server，改用 `npx t3@0.0.42 serve --host <private-ip>` 重新啟動。
:::

## 更新失敗時 {#if-an-update-fails}

在 client 重新連上或回報失敗之前，請讓它保持開啟。服務更新失敗時，可以退回前一個版本。如果更新仍然失敗：

1. 把畫面提供的動作再試一次。
2. 確認你更新的是 server 所在的機器，而不只是你正在使用的裝置。
3. 如果是命令列的 server，把它停掉，然後重新啟動提示裡顯示的那個確切版本。

## 更新 Provider {#update-providers}

**Settings → Providers** 會顯示所選 environment 的 Provider 更新。**Update all** 會一次更新每一個已連線 environment 上所有過時的 Provider。把滑鼠停在上面，可以看到它會更新哪些 Provider。只提供手動更新指令的 Provider 不包含在內。

## 手機版的更新 {#mobile-updates}

要從手機更新某個 environment，請開啟 **Settings → Environments** 並選取它。**Check for updates** 會在那個 environment 目前的發行頻道上尋找最新版本。在 environment 更新並重新連線的期間，請讓 app 保持開啟。無法遠端更新的主機，會改為顯示如何在那台機器上更新的說明。

同一個頁面也可以重新整理 Provider 狀態，以及更新支援的 Provider。這些控制項需要有已連線的 environment，以及操作它的權限。Provider 更新檢查和重新啟動後繼續的偏好設定，位於 **Settings → Maintenance**。如果 Provider 更新檢查被停用了，請先在那裡啟用，再重新整理來尋找較新的版本。

App Store 或 Google Play 上的版本，照平常的方式安裝即可。手機 app 也可以在背景下載更新，並在你下次離開 app 時套用。它會在重新啟動之前儲存草稿和佇列中的訊息。如果你讓 app 開著很長一段時間，它可能會詢問要不要立刻安裝；選擇 **Later** 的話，更新會留在佇列裡，等下一個合適的時機再套用。
