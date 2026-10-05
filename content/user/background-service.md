---
title: 在背景執行 T3 Code
nav: 背景服務
source: docs/user/background-service.md
source_hash: 9964fba54f74c83f8ba4b15f493ff76392ad5481
---

在 Linux 和 macOS 上，T3 Code 可以用你的使用者身分當成服務執行，這樣就不需要一直開著一個終端機。

## 管理服務 {#manage-the-service}

請先安裝 `t3` CLI（[安裝 T3 Code](./install.md#command-line)），然後在要當作 T3 Code 主機的那台機器上執行這些指令：

| 工作                         | 指令                   |
| ---------------------------- | ---------------------- |
| 安裝並啟動                   | `t3 service install`   |
| 檢視狀態和紀錄檔位置         | `t3 service status`    |
| 換到較新的版本               | `t3 update`            |
| 重新啟動                     | `t3 service restart`   |
| 停止，並且不再隨開機啟動     | `t3 service uninstall` |

解除安裝服務不會動到你的專案、Thread 和設定。當 `t3 service status` 回報服務損壞時，再執行一次 `t3 service install` 就會修復它。

:::example 第一次安裝後確認服務狀態
```sh
t3 service install
t3 service status
```

服務正常時，`t3 service status` 的輸出大致是這個樣子，角括號的部分會是你機器上的實際值：

```text
T3 Code service
  Status: installed · t3@<版本>
  Unit: <服務設定檔的路徑>
  Logs: <紀錄檔的路徑>
```

如果有問題，會多出一行方括號開頭的問題代碼，例如 `[linger-disabled]`，可以對照下方「疑難排解」的說明處理。
:::

`t3 update` 會下載你所在頻道上最新的版本，並把 `t3` 和服務都切換過去。重新啟動會中斷執行中的 agent turn、終端機和遠端 client，所以它會先問你；如果回答否，服務會繼續執行舊版本，直到你執行 `t3 service restart` 為止。在腳本裡使用時請加上 `--yes`。你自己手動啟動的 server 會繼續執行不受影響；把它停掉再重新啟動，才會換成新版本。如果有遠端更新正在進行，請等它完成再更新；如果要配合遠端 client 的版本，請依照[更新 T3 Code](./updating.md)處理。

:::plain 下載新版本和「換成新版本在跑」是兩個步驟
`t3 update` 先把新版本下載好，再問你要不要重新啟動服務。只有重新啟動之後，實際在執行的才是新版本。所以如果你有 agent 正在工作，可以先回答否，等它做完再執行 `t3 service restart`。這段期間 `t3 service status` 會顯示 `restart-pending`。
:::

指定確切的版本（`t3 update 0.0.42`）可以固定在某一版；用 `--channel nightly` 切換發行頻道；用 `--allow-downgrade` 退回較舊的版本。`preview` 是維護者用的測試頻道：它的版本可能是壞的，而且絕對不會被當成更新提供給你，所以安裝程式和 `t3 update` 在安裝這種版本之前會先請你確認。

`t3 uninstall` 會移除背景服務、`t3` 啟動器和已下載的各個版本；它會先把清單列給你看，並且詢問一次。你在 `~/.t3/userdata` 底下的專案、Thread 和設定會保留下來。在腳本裡使用時請加上 `--yes`。

## 平台支援 {#platform-support}

Linux 需要 systemd 的使用者服務。設定過程會啟用 lingering，讓 T3 Code 在開機時啟動，並且在你登出之後繼續執行。如果這一步需要系統管理員權限，設定程式會在變更服務之前，先印出一個補救用的指令。

:::plain lingering 是什麼
systemd 的「使用者服務」預設是跟著你的登入狀態走的：你登入時啟動，最後一個登入工作階段結束時跟著停止。對一台用 SSH 管理的主機來說，這表示你一關掉 SSH，T3 Code 就停了。啟用 lingering 之後，系統在開機時就會啟動你的使用者服務，並且在你登出後繼續保留，T3 Code 才能一直在背景執行。
:::

macOS 會在你登入時啟動服務，在你登出時停止服務。如果要在無人看管的情況下遠端存取，請讓 Mac 保持登入且不要進入睡眠。在沒有人於 Mac 螢幕前登入的情況下透過 SSH 安裝，可能會在最後的啟動步驟失敗；這時服務其實已經安裝好了，下次登入時就會啟動。

不支援 Windows 的背景服務。

T3 Connect 在設定過程中可以提供安裝服務的選項，但這兩者是分開管理的。登出 T3 Connect 不會停止服務，也不會解除安裝服務。

## 疑難排解 {#troubleshooting}

先在主機上執行 `t3 service status`。它會印出紀錄檔的路徑；在 Linux 上，還會檢查已安裝的服務是否正在執行、是否已啟用，以及是否被允許在登出後繼續存活。

如果它在你的 SSH session 關閉時就停止，請檢查有沒有出現 `linger-disabled`。系統管理員可以用以下指令啟用 lingering：

```sh
sudo loginctl enable-linger "$(id -un)"
```

透過 SSH 時，要讓 sudo 能夠提示你輸入密碼：

```sh
ssh -t your-server 'sudo loginctl enable-linger "$(id -un)"'
```

然後用你平常的使用者身分重新執行服務設定。只有 `loginctl` 這個指令要用 sudo 執行；用 root 身分執行 T3 Code，會建立出另一份獨立的安裝和 Connect 身分。如果沒有系統管理員權限，請在終端機裡執行 `t3 serve`，並且讓那個 session 保持開啟。

:::note 不要用 sudo 執行 `t3`
上面只有 `loginctl enable-linger` 那一行需要 sudo。`t3 service install` 請用你平常的使用者身分執行。如果寫成 `sudo t3 service install`，服務會裝在 root 底下，那是另一份安裝，也有另一個 T3 Connect 身分，跟你自己帳號底下的專案和登入資訊是分開的。
:::

| 狀態問題                                | 下一步                                                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `linger-unavailable`                    | 執行 `loginctl show-user "$(id -un)" --property=Linger`，並確認 systemd-logind 可以使用。                                   |
| `user-manager-unavailable`              | 在服務使用者的登入工作階段裡執行 `systemctl --user status`；確認你的發行版是否支援 systemd 的使用者工作階段。               |
| `service-disabled` 或 `service-stopped` | 閱讀紀錄檔和 `systemctl --user status t3code.service` 的輸出，然後使用 T3 Code 印出的修復指令。                             |
| `restart-pending`                       | 已經安裝了較新的版本，但服務還在執行前一個版本。執行 `t3 service restart`。                                                 |

在 macOS 上，如果服務不再於登入時啟動，請檢查 **System Settings → General → Login Items**（系統設定 → 一般 → 登入項目）。如果 agent 的工作無法存取「桌面」、「文件」或「下載項目」資料夾，可能需要為 `t3` 執行檔開啟 Full Disk Access（完全取用磁碟）；這個執行檔的路徑列在 `~/Library/LaunchAgents/com.t3tools.t3code.service.plist` 的 `ProgramArguments` 裡。

如果是登入 T3 Connect 之後發生的失敗，請看[連線疑難排解](./remote-access.md#t3-connect-troubleshooting)。
