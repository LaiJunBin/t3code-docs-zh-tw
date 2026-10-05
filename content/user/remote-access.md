---
title: 遠端存取
source: docs/user/remote-access.md
source_hash: f3fb96b830f959c2b79e9797bf03b738bb8c6cd8
---

你可以用手機、瀏覽器或另一個桌面版 app，連到在另一台機器上執行的 T3 Code。工作期間，那台機器必須保持執行，而且連得到。

:::plain 這一頁有哪幾種連法
- **T3 Connect**：登入同一個帳號就能連，不用設定路由器轉送。
- **直接配對**：另一台裝置本來就連得到主機的網路位址時使用，例如同一個區域網路，或同一個 tailnet。
- **Tailscale HTTPS**：兩台裝置都在同一個 tailnet 裡，並且需要 HTTPS 位址時使用。
- **桌面版管理的 SSH**：你有一台可以 SSH 進去的機器，讓桌面版 app 幫你在上面啟動 server 並開好連接埠轉送。

不管用哪一種，agent 都是在主機那台機器上工作，你手上的裝置只是操作介面。
:::

## T3 Connect {#t3-connect}

T3 Connect 讓你的其他裝置可以連到某個 environment，不需要設定路由器轉送。在主機的桌面版 app 裡，開啟 **Settings → Connections**，登入，然後為那個 environment 啟用 **T3 Connect**。

如果主機只有命令列，請執行：

```bash
t3 connect
```

依照登入指示操作。設定過程會問你要不要安裝[背景服務](./background-service.md)；如果你選擇不要，請用 `t3 serve` 啟動 server。只是把登入資訊存起來，並不會讓這台機器連得到。

:::note 登入之後，server 還要在執行才連得到
`t3 connect` 做的是登入和連結。其他裝置要連得進來，主機上必須有一個正在執行的 server：不是由背景服務幫你一直開著，就是你自己開一個終端機執行 `t3 serve`，並且讓它保持開啟。
:::

在你的另一台裝置上，登入同一個 T3 Connect 帳號，然後選擇那個 environment。透過 SSH 操作時，CLI 會印出一個瀏覽器連結和一組簡短的代碼。在任何一台裝置上開啟這個連結，確認代碼相符，然後核准。CLI 會自己繼續往下執行，所以你不需要轉送 OAuth callback 的連接埠。

T3 Connect 會在需要時更新存取憑證，不會中斷正常的連線。前一份憑證過期之後，pull request 的 diff 和 Provider 設定仍然可以繼續使用。更新憑證失敗只會影響那一次請求；不會中斷原本正常的對話。

## 透過區域網路或私人網路配對 {#pair-over-a-lan-or-private-network}

當另一台裝置連得到主機的網路位址時，可以使用直接配對。

在桌面版的主機上，開啟 **Settings → Connections**，啟用 **Network access**，然後用另一台裝置連得到的位址建立配對連結。變更 network access 會重新啟動桌面版 app。你可以在同一個地方把它關掉。

如果主機只有命令列，請把 `<private-ip>` 換成主機的區域網路位址或 tailnet 位址：

```bash
t3 serve --host <private-ip>
```

如果 server 已經在執行，可以不重新啟動就產生一個新的連結：

```bash
t3 pair
```

用手機掃描 QR code，或是把配對 URL 貼到接收端 app 的 **Add environment** 裡。連線設定在網頁版和桌面版位於 **Settings → Connections**，在手機版位於 **Settings → Environments**。像 `127.0.0.1` 這樣的 loopback 位址，只能連到開啟連結的那台裝置自己。

:::example 用手機連到同一個 Wi-Fi 下的電腦
假設電腦在區域網路裡的位址是 `192.168.1.50`（請換成你自己的位址）：

1. 在電腦上執行 `t3 serve --host 192.168.1.50`。如果 server 早就在執行，改執行 `t3 pair` 就好。
2. 終端機會印出配對用的 QR code。
3. 在手機 app 開啟 **Settings → Environments**，選擇 **Add environment**，掃描 QR code，或是貼上配對 URL。

如果連結裡的位址是 `127.0.0.1`，手機會連到手機自己，所以連不上。這時候要回頭確認 server 是用區域網路位址啟動的。
:::

配對會授權那台裝置之後繼續連線。每一台新裝置請使用一個新的一次性連結；重新連線時不需要原本的 token。在 Settings 裡建立的連結，只能從建立它的那個 client 複製，而且它的 Connections 頁面必須一直開著。如果你離開或重新載入那個頁面，請再建立一個連結來分享。

:::screenshot connections-settings
**Settings → Connections** 頁面：可以看到 **T3 Connect**、**Network access** 的開關，以及建立配對連結與 **Add environment** 的位置。
:::

### 在多台機器之間分配新的 Thread {#balance-new-threads-across-machines}

Auto balance 預設是關閉的。在網頁版和桌面版，到 **Settings → Connections → Load balancing** 啟用它之後，如果專案是跨多個已連線 environment 分在同一組的，新 Thread 就會自動選擇要在哪一台機器上執行。這個區塊要有兩台以上的機器開啟之後才會出現。每台機器一開始都是 **Normal**。選擇 **Prefer**，會在它有可用的 CPU 和記憶體時優先使用它；選擇 **Less often**，會降低它被分配到的比例；選擇 **Manual only**，則會把它排除在自動選擇之外。這些是偏好設定，不是固定的流量百分比。偏好設定是每個 client 各自儲存的。

訊息輸入框（composer）會在為草稿選擇 environment 時檢查符合條件的機器，選定之後就維持不變。再選一次 **Auto balance** 會重新檢查目前的資源；選擇特定的機器則會覆寫自動選擇的結果。選擇分支或 worktree 也會讓草稿留在那台機器上。既有的 Thread 會留在它們開始的地方。如果無法檢查資源，或是所有符合條件的機器都滿了，請手動選擇一台機器才能繼續。手機版維持手動選擇 environment。

:::plain 自動分配只發生在「開新 Thread 的那一刻」
可以把它想成排隊時被帶位：帶位的人看當下哪一桌有空，把你帶過去，之後你就坐在那一桌，不會中途被換桌。同樣地，草稿選定機器之後不會再變，已經開始的 Thread 也不會被搬到別台機器。**Prefer**、**Less often** 只是告訴帶位的人你的偏好，不保證每台機器分到多少比例。
:::

### Tailscale HTTPS {#tailscale-https}

讓兩台裝置加入同一個 tailnet。在桌面版 app 的 **Settings → Connections** 啟用 **Tailscale HTTPS**。在同一個地方把它關掉，就會移除那條路由。

用 Tailscale HTTPS 啟動命令列的 server：

```bash
t3 serve --tailscale-serve
```

如果 server 已經在執行：

```bash
t3 pair --tailscale
```

配對連結會使用像 `https://machine.tailnet.ts.net/` 這樣的位址。`pair --tailscale` 建立的對應關係在重新啟動之後仍然存在。用以下指令移除它在預設連接埠上的對應：

```bash
tailscale serve --https=443 off
```

如果那個連接埠已經被佔用，可以用 `--tailscale-serve-port` 選擇另一個。其他配對選項請看 `t3 pair --help`。

### 託管的網頁版 app {#hosted-web-app}

[app.t3.codes](https://app.t3.codes) 需要一個 HTTPS endpoint。它會直接連到你的 server；託管的配對連結不會讓一個連不到的後端變得連得到，也不會把 HTTP 轉成 HTTPS。

如果是區域網路上一般的 HTTP endpoint，請在開得了它的瀏覽器裡使用直接配對的 URL，或是從桌面版 app 配對。在手機上，輸入 IP 位址時如果沒有寫協定，會使用 HTTP；所以當你的 server 使用 HTTPS 時，要把 `https://` 寫進去。

## 桌面版管理的 SSH {#desktop-managed-ssh}

在桌面版 app 裡，開啟 **Settings → Connections → Add environment**，選擇 **SSH**，然後輸入主機或 SSH 別名，例如 `user@example.com`。T3 Code 會在那裡啟動一個 server，或是沿用既有的，並且幫你開好連接埠轉送。專案、Provider 憑證和 agent 的工作都留在遠端機器上。

遠端主機必須是 Linux 或 Apple Silicon 的 Mac，具備 `curl` 或 `wget`、`tar`、`sha256sum` 或 `shasum`，並且完成 [Provider 設定](./install.md#providers)。第一次啟動時，會把 T3 Code 的 server 下載到主機上的 `~/.t3/runtime`，所以會比之後幾次花更久的時間。Provider 的 CLI 必須位於那台機器上非互動式 login shell 的 `PATH` 裡；可以用以下指令檢查：

```bash
ssh user@example.com 'sh -lc "command -v claude codex"'
```

:::note 這個檢查指令在看什麼
它用 SSH 登入遠端主機，啟動一個 login shell，然後問「`claude` 和 `codex` 這兩個指令找不找得到」。找得到的會印出路徑。如果你平常登入後打得出這些指令、這裡卻沒有印出路徑，通常代表 `PATH` 是設在只有互動式 shell 才會讀取的設定檔裡，T3 Code 啟動的 server 讀不到。指令裡的 `claude codex` 請換成你實際要用的 Provider CLI。
:::

如果 app 更新之後 SSH 重新連線失敗，請再試著啟動一次。移除這個連線時，會停止由 T3 Code 啟動的 server；原本就已經在執行的 server 則不會被動到。

關於 Antigravity 在遠端主機上的 Google callback，請看[遠端登入](./providers-antigravity.md#sign-in-from-a-remote-device)。

## 管理或撤銷存取權 {#manage-or-revoke-access}

在主機上，獲得授權的管理者可以在 **Settings → Connections** 建立配對連結，以及撤銷 client 的 session。撤銷一個還沒用過的連結，可以防止新的配對；撤銷某台裝置的 session，則會移除它既有的存取權。命令列的管理方式請看 `t3 auth --help`。

有連線開著的 session，在它的存取憑證過期之後，仍然會留在清單上。

要把某個 environment 從 T3 Connect 移除，請開啟帳號選單裡的 **T3 Connect** 頁面，手機版則是 **Settings → T3 Connect**，然後選擇 **Deregister**。這會撤銷它的雲端存取權，並釋出它佔用的主機名額，即使那個 environment 已經離線或已經被清空也一樣。從某台裝置的連線設定裡移除 environment，只是讓那台裝置忘記它；它仍然註冊在你的帳號底下。

:::plain 「從裝置上移除」和「Deregister」的差別
從裝置的連線設定裡移除，像是把通訊錄裡的某個聯絡人刪掉：只有這台裝置不再記得它，那個 environment 在你的帳號裡還在。**Deregister** 才是真的把它從帳號裡註銷。機器已經不用了、想把名額空出來時，要用的是 **Deregister**。
:::

當閒置 tunnel 清理功能啟用時，已連結的 environment 離線幾分鐘之後，T3 Connect 會移除它的 tunnel。這個 environment 仍然保持連結，位址也不變。主機再次啟動或喚醒時，T3 Connect 會自己建立一條替代的 tunnel。你不需要重新配對。清理通常在 tunnel 中斷之後五到十分鐘執行。

在命令列的主機上，`t3 connect unlink` 會停止對外開放，但保留你的登入資訊；`t3 connect logout` 則會連登入資訊一起清除。背景服務的[移除](./background-service.md#manage-the-service)是另一回事。

請把配對 URL 和授權碼當成密碼看待。不要讓它們出現在截圖、紀錄檔或錯誤回報裡。

## T3 Connect 疑難排解 {#t3-connect-troubleshooting}

在主機上執行 `t3 connect status`，可以檢視已儲存的授權和連結設定。它不是即時的連線檢查。如果 environment 顯示為離線，請執行 `t3 service status`，並閱讀它顯示的紀錄檔。如果 SSH 一關閉它就消失，請看[背景服務的疑難排解](./background-service.md#troubleshooting)。

| 錯誤                                                       | 處理方式                                                                                                                                     |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `environment_link_limit_exceeded` 或 managed tunnel 數量上限 | 把一個沒在用的 environment deregister，然後在主機上重新啟動 T3 Code。                                                                        |
| `auth_invalid` 或 `invalid_bearer`                         | 執行 `t3 connect login`。如果憑證已經被撤銷，先執行 `t3 connect logout`，再執行一次 `t3 connect`。登入之後重新啟動 server。                  |
| link proof 過期或無效                                      | 檢查主機的日期和時間，更新 T3 Code，然後重新啟動它。                                                                                         |
| HTTP 403，但沒有可辨識的錯誤                               | 檢查 relay 的存取、proxy 和防火牆規則。如果有 Cloudflare Ray ID，請留下來供錯誤回報使用。                                                    |
| HTTP 408、429 或 5xx                                       | 檢查網路和 relay 是否可用。啟動時遇到暫時性的失敗，會持續重試最多十分鐘。                                                                    |

修正了永久性的拒絕之後，請重新啟動主機上的 server。在 Linux 上，背景服務請用 `systemctl --user restart t3code.service`。如果是前景執行的 server，請把它停掉，再用你平常的選項執行一次 `t3 serve`。回報持續發生的失敗時，請附上診斷訊息和 trace ID。

如果連結之後連線仍然失敗，請檢查兩台裝置的日期和時間。如果出現 server 版本的警告，請依照[更新 T3 Code](./updating.md)處理。

## 只把桌面版 app 當成遠端操作介面 {#using-the-desktop-app-as-a-remote-only}

如果某台電腦只需要用來操作在別處執行的工作，可以把它的本機 environment 關掉。在桌面版 app 裡，開啟 **Settings → Connections**，把 **Local environment** 關閉。T3 Code 會重新啟動，而且不帶本機 server：本機不會執行任何 agent 或終端機，WSL 後端保持關閉，其他裝置也無法再連到這台電腦。你的專案、歷史紀錄和已儲存的連線都會保留，你可以繼續透過配對、T3 Connect 或 SSH 工作。

在同一個地方把 **Local environment** 重新開啟，就會帶著你先前的本機設定重新啟動。
