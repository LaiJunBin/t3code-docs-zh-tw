---
title: Pull request 的檔案版本
nav: PR 檔案版本
source: docs/internals/pull-request-file-revisions.md
source_hash: 3a84b8de665d03cd4ab2bdaf447719cb6290c5d5
---

有些託管平台（host）自己不保存「哪些檔案已經看過」的紀錄。遇到這種平台，就由這個 environment 保存標記，並向平台詢問每個被標記的檔案目前是哪個版本；這樣一來，有新的 push 時，就能把一個已勾選為看過的檔案回報成「有變更」。這個版本資訊會經過四層，而「缺少一筆」在每一層代表的意思都不一樣。沒有任何型別能區分這些意思，也沒有哪一個檔案把整條路徑講完整，這一頁就是為此而寫的。

:::note 這一頁的 provider 不是 agent 的 Provider
這裡說的 provider 是指 pull request provider，也就是 server 裡負責和 GitLab、Bitbucket、Azure DevOps 這類程式碼託管平台溝通的那一層（程式碼在 `apps/server/src/pullRequest/`）。它和文件其他地方指 Codex、Claude 的那個 Provider 無關。為了區分，這一頁一律寫成小寫的 provider。
:::

這種出錯方式是有紀錄的，不是假設。[GitLab 的 `getFileRevisions`](../../apps/server/src/pullRequest/GitLabPullRequestCli.ts) 上方的介面說明，曾經寫得和它底下的程式碼相反，因為它是用「下面那一層」的意思去描述缺少的路徑。任何照著那種讀法寫出來的東西，都會把「平台不肯給的版本」當成「這個 change request 刪掉的檔案」；結果是在一個 token 看不到的專案裡，審閱者勾選過的每一個檔案都會被回報成有變更。

## 「缺少」在 provider 邊界上會換意思 {#an-absence-changes-meaning-at-the-provider-boundary}

在邊界以下，也就是在 patch parser 或 response decoder 裡，缺少一個路徑代表「這個版本不包含那個檔案」。在邊界以上，也就是在 [`ProviderFileRevisions`](../../apps/server/src/pullRequest/PullRequestProvider.ts) 裡，缺少一個路徑代表「這次讀取答不出來」。provider 的 `getFileRevisions` 會在往上傳的途中做轉換：平台看過、但沒有版本可給的路徑，會以空字串送上來；而「缺少」則保留給 provider 根本沒機會看到的東西。邊界以下的「缺少」不會原樣跨過邊界。

所謂「根本沒機會看到」是什麼情況，取決於平台，而合約不可能知道其中任何一種：

- [Azure DevOps](../../apps/server/src/pullRequest/AzureDevOpsPullRequestProvider.ts) 是從一份 iteration 清單裡讀出所有版本的，所以當一個變更長到無法追到結尾時，那個位置之後的路徑就會被漏掉。
- [Bitbucket](../../apps/server/src/pullRequest/BitbucketPullRequestApi.ts) 是從 pull request 自己的 patch 裡讀出版本的，那是它唯一會標明檔案版本的地方，所以當 patch 在位元組上限處被截斷時，截斷點之後的路徑就會被漏掉。
- [GitLab](../../apps/server/src/pullRequest/GitLabPullRequestCli.ts) 是分批詢問的，所以某一批讀不到時，那一批的路徑就會被漏掉。

這三件事留在各自的 provider 裡。合約只規定「缺少代表這次讀取答不出來」，而這正是 provider 必須負責轉換出來的那一半。

## 三種 null，而空字串不是其中之一 {#three-nulls-and-the-empty-string-is-not-one-of-them}

空字串是一個答案：平台看過了，而 head 上沒有版本，被刪除的檔案就是這種情況。它和一個蓋上了空字串的標記相比會相等，所以針對一次刪除所做的標記，勾選一次之後就會一直維持已勾選。以下的每一種都是「沒有答案」，而這三種形式不能互相替換。

第一種是 null 的 map，來自 service 對整個範圍的讀取；它會讓那些標記失去判斷是否過時的能力。它們仍然會回報為已勾選，只是不再察覺到 push。這會發生在 provider 完全沒有提供 `getFileRevisions` 的時候，以及（不論在哪一條路徑上）呼叫失敗並已記錄到 log 的時候。一次沒有得到答案的勾選，並不會拒絕審閱者打的勾：它會儲存一個沒有基準（baseline）的標記，也就是下面的第三種形式。

第二種是「map 有回答，但某個路徑不在裡面」，這是以單一路徑為單位的情況，也是絕對不可以被讀成「檔案被刪除」的那一種。[`HeldFileRevisions`](../../apps/server/src/pullRequest/pullRequestViewedFiles.ts) 除了記錄它聽到的答案，也記錄它問過什麼，所以一個缺少的路徑會保留上一次給它的版本，而不是把版本弄丟。

第三種是儲存下來的標記上的 null，也是唯一由這個 environment 自己發明的一種。[`PullRequestFileViewedMark`](../../apps/server/src/persistence/PullRequestFilesViewed.ts) 把 `revision` 存成 nullable，這樣一次「某個路徑沒得到答案」的勾選，就可以完全不儲存基準。如果改存空字串，一旦後來發現平台其實有版本，這個檔案就會立刻被回報成有變更。沒有基準的標記會一直讀成已勾選，直到審閱者再勾一次為止。

在寫入路徑上，讀取端的兩種 null 都會收斂成第三種：不論是整個 map 為 null，還是只有那個路徑不在裡面，勾選時儲存的都是一個沒有基準的標記。

:::plain 四種值的對照
| 看到的值 | 意思 | 結果 |
| --- | --- | --- |
| 空字串 `""` | 平台看過了，head 上沒有這個檔案的版本（檔案被刪除） | 這是一個正常的答案，可以拿來和標記比較 |
| 整個 map 是 null | 這次完全問不到（provider 沒有 `getFileRevisions`，或呼叫失敗） | 標記照樣顯示已勾選，但不會察覺新的 push |
| map 有回來，但少了某個路徑 | 只有這個路徑答不出來 | 沿用上一次拿到的版本，不可以當成檔案被刪除 |
| 標記上的 `revision` 是 null | 勾選當下沒拿到版本，所以沒有基準 | 一直顯示已勾選，直到審閱者再勾一次 |

要記住的重點：空字串是「有答案」，其餘三種都是「沒答案」，處理方式各不相同。
:::
