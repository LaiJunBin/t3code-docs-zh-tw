---
title: Claude
source: docs/user/providers-claude.md
source_hash: cce194dbd2b4ac690fc23086a992c1c962d3eb34
---

T3 Code 使用的是 Claude Code 的登入和設定。只有一個帳號的話，從預設的 Provider 開始就好；安裝方式和各 Provider 共通的設定見 [Provider 設定](./install.md#providers)。

## 分開的帳號或設定 {#separate-accounts-or-configurations}

每個帳號使用一個獨立的 Claude 設定目錄。如果你需要幾組具名的預設組合，各自用不同的 Claude 設定或 router 連線，也可以用同樣的做法。

既有的帳號留在預設目錄。在 environment 所在的那台機器上，建立第二個登入：

```bash
mkdir -p ~/.claude_personal
CLAUDE_CONFIG_DIR=~/.claude_personal claude auth login
```

在 **Settings > Providers** 新增另一個 Claude instance：

| Instance        | Binary path | CLAUDE_CONFIG_DIR path |
| --------------- | ----------- | ---------------------- |
| Claude Work     | `claude`    | 留空                   |
| Claude Personal | `claude`    | `~/.claude_personal`   |

設定目錄這一欄留空，就會使用 Claude Code 平常的設定。填了自訂值則會改變 `CLAUDE_CONFIG_DIR`，`HOME` 和系統鑰匙圈的位置維持不變。執行登入指令時也要用同一個變數。如果改成設定 `HOME`，憑證可能會被放到這個 Provider 找不到的地方。

登入之後，請到 Provider 設定裡確認回報的帳號。既有的 Thread 只能在設定目錄相同的 Claude instance 之間切換。不同帳號的目錄彼此隔離，連本機的對話狀態也是分開的。Claude 沒有 Codex 那種共用 home 加 shadow home 的安排。

:::plain 和 Codex 多帳號的差別
Codex 可以讓兩個帳號共用同一份對話紀錄，所以同一個 Thread 能換帳號接著做。Claude 不行：一個設定目錄就是一個獨立的世界，帳號、設定、對話紀錄都在裡面。用「Claude Work」開的 Thread，不能中途改用「Claude Personal」接續。
:::

如果幾組預設組合之間只差在 API key 或端點，請用 instance 的 **Environment variables**。變數賦值不要放在 **Launch arguments** 裡。

:::note Environment variables 和 Launch arguments 不要填錯欄
**Launch arguments** 是啟動 session 時額外傳給 Claude 的命令列參數，欄位裡的提示範例是 `--chrome` 這種旗標。像 `ANTHROPIC_BASE_URL=...` 這樣的「變數名稱=值」不是參數，要填在 **Environment variables**。API key 這類機密值記得標成 sensitive，儲存之後 T3 Code 就不會再顯示原本的值。
:::

即使你把 Claude 用在文字產生上（包括 Thread 標題、分支名稱、commit 訊息和 pull request 說明），Claude Code 的 verbose 模式也可以維持開啟。透過遠端連線時，T3 Code 使用的是所連線 server 上的 Claude 設定。

## 壓縮很長的對話 {#compact-long-conversations}

在 Claude 的 Provider 設定裡，把 **Auto-compact after** 設成 `100000` 到 `1000000` 之間的整數。例如 `300000` 會要求 Claude 在大約 300,000 個 token 時做摘要。這個設定改變的是「什麼時候壓縮」，不是模型的 context window。留空則使用 Claude Code 的預設值。

:::plain 壓縮（compact）是在做什麼
壓縮指的是讓 Claude 把到目前為止的對話整理成摘要。**Auto-compact after** 只是調整「累積到多少 token 就開始整理」的門檻，模型一次能讀進去的上限並沒有變大。這一欄只接受空白，或 100000 到 1000000 之間的整數，其他的值存不進去。
:::

你也可以在既有的對話裡送出 `/compact`。網頁版和桌面版可以從 context 用量表選 **Compact context**，當你回到一個很大的舊 Thread 時，也可能主動建議你這麼做。訊息輸入框（composer）裡指令的用法見[指令與 skill](./composer.md#commands-and-skills)。

## 用量上限 {#usage-limits}

如果你的 Claude 訂閱在 turn 進行到一半時用量耗盡，Thread 會顯示達到的是哪一項上限；Claude 有提供重置時間的話，也會顯示還要等多久。Claude Code 會把這個 turn 保留住，直到那個時間區間重新開放，所以它可能會一直顯示為工作中。你可以等到重置，或是停止這個 turn、之後再繼續。警告上的時間戳記，代表畫面上那段等待時間是從什麼時候開始算的。

:::note 一直顯示工作中，不一定是卡住
達到用量上限時，turn 並沒有結束，只是在等額度恢復，所以 Thread 看起來還在跑。先看 Thread 裡有沒有用量上限的警告，再決定要繼續等，還是先停掉。
:::

## Skills {#skills}

Claude 的 skill 來自設定目錄底下的 `skills` 資料夾，以及專案的 `.claude/skills` 資料夾。如果兩邊定義了同一個名稱，以設定目錄的那一份為準。在 Claude 設定裡停用的 skill 不會出現在 composer 裡。

在 composer 裡用 `$` 選擇 skill。標記為 `disable-model-invocation` 的 skill 還是可以由你來啟動。這類 skill 請一則訊息只叫用一個：Claude 只會直接執行最後一個被點名的 skill，前面的幾個它可能會試著透過自己的 Skill 工具啟動，但這個工具會拒絕保留給手動叫用的 skill。

:::example 同名的 skill 會用哪一份
假設這個 instance 的 **CLAUDE_CONFIG_DIR path** 是 `~/.claude_personal`，而下面兩個位置都有一個叫 `release-notes` 的 skill：

- `~/.claude_personal/skills` 底下的那一份
- 專案的 `.claude/skills` 底下的那一份

在 composer 輸入 `$` 選到的 `release-notes`，會是設定目錄（第一個）的那一份。想用專案自己的版本，就要把設定目錄那一份改名或移走。
:::

## OpenRouter {#openrouter}

建立一個有自己設定目錄的 Claude instance，例如 `~/.claude_openrouter`，**Binary path** 維持 `claude`。在這個 instance 的 **Environment variables** 裡填入：

| 變數                   | 值                                        |
| ---------------------- | ----------------------------------------- |
| `ANTHROPIC_BASE_URL`   | `https://openrouter.ai/api`               |
| `ANTHROPIC_AUTH_TOKEN` | 你的 OpenRouter API key，標記為 Sensitive |
| `ANTHROPIC_API_KEY`    | 明確設成空值                              |

:::screenshot claude-openrouter-environment-variables
Claude instance 設定裡的 **Environment variables** 區塊，填好上表三個變數，其中 `ANTHROPIC_AUTH_TOKEN` 標記為 Sensitive、`ANTHROPIC_API_KEY` 為空值。
:::

如果那個 Claude 設定目錄裡有快取的 Anthropic 登入，請先在使用該目錄的 Claude Code session 裡執行 `/logout`，再開始設定 router。快取的登入憑證可能會和 router 的 token 衝突。

在 T3 Code 裡選擇你要的模型。如果要用的 OpenRouter 模型不在內建清單裡，請到 **Settings > Providers** 打開那個 Claude instance，用 **Add custom model** 加入它完整的模型 ID。之後就能在對話的模型選單裡選到它。`ANTHROPIC_DEFAULT_*_MODEL` 這類變數對應的是 `sonnet` 這種 Claude Code 別名；它們不會取代你在 T3 Code 裡明確選定的模型 ID。自訂模型可用的 effort、thinking 或 context 控制項，可能比內建模型少。

請到 OpenRouter 的 activity dashboard 確認實際使用的模型。目前的相容性要求，請看 [OpenRouter 的 Claude Code 指南](https://openrouter.ai/docs/cookbook/coding-agents/claude-code-integration)。

## 其他 router {#other-routers}

本機的 router 用的是一般的 Claude Provider instance。給它一個獨立的設定目錄，並把 router 的端點和憑證變數放進那個 instance 的 **Environment variables**。Router 必須執行在 environment 連得到的地方。它本身的安裝與路由設定，請依照 [Claude Code Router 的說明](https://github.com/musistudio/claude-code-router)。
