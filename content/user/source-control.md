---
title: 版本控制
source: docs/user/source-control.md
source_hash: 64beb946c4081a80660e89f9dc53913651aacc35
---

T3 Code 整合了 GitHub、GitLab、Forgejo、Gitea、Bitbucket 和 Azure DevOps，可以用來 clone 和發布 repository、建立 pull request，以及審查變更。

## 連接帳號 {#connect-an-account}

在執行 T3 Code server 的那台機器上安裝 Git 並設定好身分驗證。如果是遠端 environment，就要在遠端那台機器上做。登入之後，開啟 **Settings → Source Control**，選擇 **Rescan**（重新掃描）。

:::example 以 GitHub 為例，從頭到尾的步驟
以下指令都在 server 那台機器的終端機執行：

```bash
gh --version     # 確認版本是 2.81.0 以上
gh auth login    # 依照提示登入
```

登入完成後回到 T3 Code，開啟 **Settings → Source Control**，按 **Rescan**。其他平台的流程相同，只是換成各自的 CLI 與登入指令，見下方各小節。
:::

:::screenshot source-control-settings
**Settings → Source Control** 頁面，列出各個託管平台的連接狀態，以及 **Rescan** 按鈕。
:::

### GitHub {#github}

安裝 [GitHub CLI](https://cli.github.com/) 2.81.0 或更新的版本，然後登入：

```bash
gh auth login
```

### Forgejo 與 Gitea {#forgejo-and-gitea}

在 T3 Code server 上安裝 [Forgejo CLI（`fj`）](https://codeberg.org/forgejo-contrib/forgejo-cli)，或是 0.16 以上版本的 [Gitea CLI（`tea`）](https://gitea.com/gitea/tea)。用 `fj --host https://your-server auth add-token` 或 `tea login add` 登入。你用到的每一台伺服器都要各做一次，Codeberg 也算在內。

T3 Code 會優先使用對應得上的 `fj` 登入；如果沒有 `fj`，或是 `fj` 沒有登入那台伺服器，才退而使用 `tea`。一旦選定了帳號，之後失敗的操作也會留在那個帳號上，不會改用另一個。設定頁會顯示偵測到的是哪一個 CLI。Forgejo 和 Gitea 共用同一個整合項目。架設在 URL 子路徑底下的伺服器（例如 `https://example.com/forgejo`）會使用 `tea`，因為 fj 0.6 在檢查帳號時不會保留子路徑。

clone 或發布時，使用完整的 repository URL 可以指定特定的伺服器。只設定了一台 fj 伺服器時，可以直接寫 `owner/repo`；fj 無法使用或尚未設定時，`owner/repo` 會搭配你預設的 `tea` 登入。設定了多台 fj 伺服器時，請使用完整 URL。如果你在同一台伺服器上有多個 `tea` 帳號，用 `tea login default <login-name>` 選擇其中一個。Git 的 push 和 clone 另外還需要那台伺服器的 Git 憑證或 SSH 金鑰。

:::plain T3 Code 怎麼決定用 fj 還是 tea
簡單記：能用 `fj` 就用 `fj`，不行才用 `tea`。有兩種情況會直接落到 `tea`：機器上沒有 `fj`（或 `fj` 沒登入那台伺服器），以及伺服器的網址帶有子路徑。不確定目前用的是哪一個時，到設定頁看它顯示的 CLI 即可。
:::

### GitLab {#gitlab}

安裝 [GitLab CLI](https://gitlab.com/gitlab-org/cli)，然後登入：

```bash
glab auth login
```

### Bitbucket {#bitbucket}

開啟 **Settings → Source Control**，展開 **Bitbucket**，選擇登入方式：

- **Access token**：為單一 repository、專案或 workspace 建立的 token。它只能存取當初建立時指定的範圍。
- **API token**：你帳號的 Atlassian API token，搭配帳號的 email 使用。你能存取的每一個 repository，它都能存取。請給它 repository 和 pull request 的讀寫權限，再加上使用者的讀取權限（`read:user:bitbucket`）。

選擇 **Save**；變更會立即生效，並取代用另一種方式儲存的憑證。憑證儲存在 environment 的 server 上，所以要設定遠端 environment 時，請先選擇那個 environment。已儲存的 token 無法再次檢視；要更換就輸入新的 token，或是選擇 **Remove**。

如果沒有儲存任何憑證，T3 Code 會退而使用 server 環境裡的這些變數。修改之後要重新啟動 server：

```bash
export T3CODE_BITBUCKET_ACCESS_TOKEN="your-access-token"
# or
export T3CODE_BITBUCKET_EMAIL="you@example.com"
export T3CODE_BITBUCKET_API_TOKEN="your-token"
```

### Azure DevOps {#azure-devops}

安裝 [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/)，加入 DevOps 擴充套件，然後登入：

```bash
az extension add --name azure-devops
az login
```

## 新建、clone 或發布專案 {#start-clone-or-publish-a-project}

要從零開始，在指令面板（`Cmd/Ctrl+K`）選擇 **New project**，或是在任何 client 的 **Add Project** 底下選擇 **New project**，然後輸入名稱。T3 Code 會在 `~/.t3/projects`（T3 資料目錄裡的 `projects` 資料夾）建立一個 Git repository，裡面有 README、圖示和第一個 commit，接著在這個專案裡開啟一個新 Thread。資料夾會以專案名稱命名，例如「Pinball Stats」會變成 `pinball-stats`。開啟 **Create private repository on GitHub**（在 GitHub 建立私有 repository）可以同時把它發布出去。如果那台機器上的 Git 沒有設定名稱或 email，專案仍會建立，但不會有第一個 commit。

:::note 沒有第一個 commit 時該怎麼辦
這代表 server 那台機器的 Git 還不知道你是誰。在那台機器上設定 `user.name` 和 `user.email` 之後，再自己 commit 即可：

```bash
git config --global user.name "你的名字"
git config --global user.email "you@example.com"
```
:::

在指令面板（`Cmd/Ctrl+K`）使用 **Add Project** 來 clone repository。選擇一個託管平台或貼上 Git URL，再選擇要存放的位置。專案會立刻開啟，clone 則在背景進行：你可以先寫好第一則訊息，送出的動作會等到檔案就位才進行。畫面上會有一則提示訊息（toast）顯示進度，也可以從那裡取消；如果 clone 失敗，可以從提示訊息或訊息輸入框（composer）上方的橫幅重試。

對於還沒有 remote 的本機 Git repository，**Publish Repository** 會建立一個託管的 repository、把它加為 `origin`，並 push 你的 commit。如果還沒有任何 commit，它只會建立 remote；請先做出第一個 commit 再 push。

## 建立 pull request {#create-a-pull-request}

使用 Thread 的 Git 操作來 commit、push 和建立 pull request。T3 Code 可以根據你的變更，產生 commit 訊息，以及 review 的標題和說明。

在 **Settings → Source Control** 選擇撰寫風格和模型。**Repository conventions** 會參考專案的指示檔，以及最近幾個 commit 的標題。

:::note 撰寫風格有哪些選項
設定頁提供三種：**Repository conventions**（沿用這個 repository 既有的寫法）、**Conventional Commits**（使用 Conventional Commit 的前綴，例如 `feat:`、`fix:`），以及 **Custom instructions**（照你自己寫的指示）。
:::

## 審查與 merge {#review-and-merge}

開啟 **Pull requests** 可以審查變更和留言、指定 reviewer、checkout 分支，或是 merge。只要託管平台允許，你可以編輯 review 的標題和說明，以及你自己的留言。GitLab 把這些稱為 merge request。

GitHub、GitLab 和 Azure DevOps 支援在檢查尚未完成時設定 auto-merge。GitHub 另外支援核准等待中的 fork workflow，以及為已經 merge 的變更開一個 revert pull request。

GitHub sharing（GitHub 共用）預設是關閉的。在 Settings → Connections → GitHub sharing（手機版是 Environments）裡，為每一個你信任、願意讓它共用 GitHub 存取權的 environment 選擇 **Read PRs** 或 **Read and act**。「原本的 environment」和「替它回應請求的 environment」，兩者都要在這個 client 上啟用。**Read and act** 可能會用到比原本 environment 的憑證更廣的 GitHub 權限；只對你自己掌控而且信任的 environment 啟用它。變更已儲存的端點或移除 environment，都會清除它的這項權限。

啟用之後，GitHub 的 review 詳細資料、已連結 PR 的狀態，以及被允許的 review 操作，就可以改由另一個已連線、而且登入同一個 GitHub 帳號的 environment 來處理。每個 environment 都需要有一個位在該 host 上的專案。操作會優先交給已連線的本機 environment，它也可以代為回應太慢或失敗的讀取。瀏覽器和手機 client 需要一個已配對的 environment，才能使用它的 GitHub CLI 憑證。憑證會留在各自的機器上。GitHub 服務中斷時，先前驗證過的憑證在十分鐘內仍可用來分派請求；新的憑證則必須先通過驗證。結果不確定的操作，絕對不會自動改到別處重試。列表、diff，以及從 Git 操作進行的 checkout 或建立 PR，仍然使用專案所在的 environment。

:::plain GitHub sharing 在解決什麼問題
假設專案在一台遠端開發機上，但那台機器的 GitHub 登入不完整或連線很慢，而你的筆電上有登入同一個 GitHub 帳號。開啟 GitHub sharing 之後，T3 Code 可以請筆電那個 environment 代為讀取 PR 資料或執行 review 操作。憑證本身不會被複製到別台機器，只是「由誰去跟 GitHub 講話」換了。這等於把一台機器的 GitHub 權限借給另一台用；這個功能預設關閉，要由你逐一指定信任的 environment。
:::

Azure DevOps 的留言請到託管平台的網站上修改。Bitbucket 不支援重新開啟已經 decline 的 pull request。

### 把檔案標記為已看過 {#mark-files-as-viewed}

在 **Code** 分頁裡讀完一個檔案後把它勾起來，它就會收合；工具列會持續顯示目前的計數。勾選記號屬於 pull request，而不是某個 commit，所以把分頁範圍縮小到單一 commit 時，記號仍然保留。你勾過之後又有新的 push 改到那個檔案時，它會重新出現並標示為 **Changed**。

在 GitHub 上，這些就是 GitHub 自己的 viewed 標記，所以審查進度在 T3 Code 和 github.com 之間是雙向互通的。Forgejo、GitLab、Bitbucket 和 Azure DevOps 沒有提供 T3 Code 可以讀取的紀錄，所以改由你連線的那個 server 保存：在連到那個 server 的各個 app 之間，這些記號都會跟著你，但託管平台自己的網站上不會顯示，而且計數會寫成 **viewed in T3 Code**。

**Code** 分頁只有網頁版和桌面版才有。手機 app 會回報 pull request 的狀態，但不顯示它的 diff，所以標記的動作和檢視都要在網頁版或桌面版進行。

## 疑難排解 {#troubleshooting}

- **Not authenticated（未通過驗證）：** 在 server 上執行該平台的登入指令，然後重新掃描。如果是 Bitbucket，請檢查 Settings → Source Control 裡儲存的憑證，或確認執行中的 server 有收到環境變數。
- **無法驗證 GitHub 登入：** 把 GitHub CLI 更新到 2.81.0 以上。
- **帳號已連接但 push 仍然失敗：** 檢查 Git remote 的憑證。SSH 和 HTTPS 的 remote，可能需要在託管平台的 API 存取之外另行設定。
- **某個 review 無法載入：** 先到託管平台的網站上開啟它，同時排查連線、權限或速率限制的問題。

:::plain 為什麼「帳號連上了」還是 push 不出去
連接帳號用的是各平台的 CLI（例如 `gh`），它負責的是 API 這條路：讀 PR、建立 PR、留言。`git push` 走的是另一條路，靠的是 Git 自己的憑證或 SSH 金鑰。兩條路各有各的登入，所以其中一條通了，不代表另一條也通。
:::

## 連結的 pull request {#linked-pull-requests}

一個 Thread 可以帶有多個 pull request，包括同一個 host 上另一個 repository 的 review。可以在指令面板或 **Linked pull requests** 面板使用 **Link pull request**，或是在對話裡的 pull request 連結上按右鍵。從 Git 操作建立的 pull request 會自動連結。agent 可以用 `link_pull_request` 工具連結它們自己的 pull request。

在「由分支偵測到」的徽章的提示框裡使用 **Link this PR**，可以讓這個 PR 固定跟著 Thread。在 Pull Requests 頁面的某個 review 裡，**Link to thread** 可以讓你搜尋進行中的 Thread。review 的標頭也會列出連結到它的 Thread，包括已封存的 Thread，方便你回到當時的脈絡。

Thread 的徽章會顯示 stack 的層數，或是目前的 review 編號加上其餘連結的數量。點擊帶有不只一個 review 的徽章，會開啟 **Linked pull requests** 面板。在手機上，Git 總覽會列出已連結的 review 和它們的 stack；點一下 review 就能開啟。連結和取消連結的功能在網頁版和桌面版 client 提供。

**Linked pull requests** 面板會列出每一個 review，並把 stack 歸在一組。要取消連結某個 review，使用它那一列的選單。被取消連結的 stack 層，之後的同步都不會再把它加回來。開啟中的已連結 review 會在 server 上更新；已關閉的 review 會定期更新，這樣在託管平台上被重新開啟時才偵測得到。已 merge 的 review 只在有人要求時才更新。啟用 **Auto-settle merged threads** 之後，當每一個已連結的 review 都到了終結狀態，Thread 就可以 settle（結案）。只要還有一個開啟中或尚未同步的連結，Thread 就會維持在進行中。

:::screenshot linked-pull-requests-panel
**Linked pull requests** 面板，列出一個 Thread 連結的多個 review，其中屬於同一個 stack 的被歸在一組。
:::

請 agent watch、monitor 或 babysit（盯著、監看、照顧）某個 pull request，它就會呼叫 `watch_pull_request`。Thread 進行中的期間，server 每分鐘檢查一次這個 pull request，並在以下情況喚醒 agent：有檢查失敗、必要的檢查都通過、有其他人留言或 review，或是分支開始出現衝突。你自己帳號的留言不會喚醒它。以下情況會結束 watch：pull request 被 merge 或關閉、連續 10 次喚醒都只帶來留言，或是 server 連續 15 分鐘讀不到這個 pull request。想自己啟動或停止它，可以使用 **Linked pull requests** 面板裡那一列的選單。

:::example 請 agent 幫忙盯 PR
PR 開好之後，用平常說話的方式交代就可以：

```text
請幫我 watch 這個 PR。CI 失敗的話就修好再 push，有人留言就依照意見處理。
```

agent 呼叫 `watch_pull_request` 之後會先結束這個 turn，不會一直佔著跑。之後由 server 每分鐘去看一次，有事才把 agent 叫起來。要注意只有開始 watch 之後才出現的留言會喚醒 agent，所以原本就有的留言，要請它先處理完。
:::

跨 repository 的連結，會用到同一個 host 上的某個專案。Azure DevOps 的 review 需要一個從相符的組織和 repository checkout 出來的專案。

## GitHub stack {#github-stacks}

Pull Requests 頁面會顯示每個 PR 在它的 GitHub stack 裡的位置。在 review 裡開啟 stack 徽章，就能在各層之間切換。**Merge stack** 會把選定的 pull request，連同它下方所有尚未 merge 的層，一起送交給 GitHub，並遵守分支規則和 merge queue。確認視窗會顯示這次操作的範圍和 merge 策略。merge 之後，GitHub 會 rebase 剩下的 stack。

**Rebase stack** 會由下往上更新遠端分支，不會改動你本機的 checkout。它可能改寫歷史，並讓檢查重新執行。如果某一層失敗，在它之前已經完成的更新會保留；請先解決那一層再重試。下層被修改（amend）之後，即使它的變更看起來互不相干，GitHub 仍可能要求你手動解決衝突。stack 操作需要一個支援它們的 environment。

:::plain stack 是什麼
stack 是一串一個疊一個的 pull request：第二個 PR 以第一個 PR 的分支為基礎，第三個又以第二個為基礎，依此類推。這樣可以把一個大改動拆成幾個小的、能分開審查的 PR。文中說的「層」就是其中一個 PR，「下方」指的是比較靠近主分支的那幾層。因為上層依賴下層，所以 merge 和 rebase 都要照順序、由下往上進行。
:::
