---
title: Composer 的 context reference
nav: Context reference
source: docs/internals/composer-context-references.md
source_hash: 3f71261aa7622cba5c3eb7698c84b8e4805237c4
---

> 這一頁是寫給維護者的。如果你是 T3 Code 的使用者，請看 [docs/user](../user/)。

行內的 context reference 讓使用者訊息可以從內文的某個確切位置，指向一份有型別的 payload：一張圖片、一個檔案、一段終端機摘錄、一個選取的頁面元素、一則預覽註記（preview annotation）、一則 review comment、一個檔案 mention，或是一個 skill。這份文件說明 wire 合約和純函式的 codec。編輯器、呈現和剪貼簿的行為會在後續的 PR 加入，到時候會在這裡各自有專屬的章節。

## 兩個互相連結的概念 {#two-linked-concepts}

- **context record** 是 payload 本身。它放在 `message.context.records` 裡，以 `contextId` 為鍵。Record 絕對不包含位元組資料：圖片和檔案的 record 是用 id 綁定到一個既有的 `ChatAttachment`。
- **context reference** 是文件中的一次出現（occurrence）。它是 `message.text` 裡的一個 Markdown 連結，只帶著 kind 和 `contextId`。兩個 reference 可以指向同一個 record。Reference 的 label 是顯示用的文字，絕對不是身分識別。

:::plain 用「註腳」來想
reference 像內文裡的註腳編號，record 像頁尾的註腳內容。內文裡只放一個小小的記號，說明「這裡指的是哪一筆」；真正的資料另外放在訊息的 `context.records` 裡。同一筆 record 可以在內文裡被引用很多次，就像同一個註腳可以被標好幾次。
:::

[`composerContext.ts`](../../packages/contracts/src/composerContext.ts) 定義了 record union 的第 1 版。每個 record 都有 `version`、`contextId`、`kind` 和 `label`，再加上各個 kind 專屬、長度有上限的欄位。這個 union 是開放的：這個 build 不認得的 kind，會解碼成 `UnknownContextRecord`，並保留它的 `payload`；已知的 kind 則被排除在這個成員之外，所以格式錯誤的圖片 record 會在它自己的 schema 上失敗，而不是未經檢查就溜過去。`OrchestrationMessageContext` 用 `ForwardCompatibleArray` 把這些 record 包起來，所以遇到一個無法解碼的 record 時，只會丟掉那一個，不會讓整則訊息失敗。在 V2 的對話訊息上，以及在「開始一個 turn」或「把 turn 排入佇列」的 command 上，這個欄位都是選填的；orchestrator 會原封不動地把它帶過去。

## 身分識別的命名空間 {#identity-namespaces}

- `ComposerContextId`：持久的 payload 身分。是 branded 型別。值符合 `[a-z0-9_-]+`，不要求要有 `ctx_` 前綴。
- `ComposerContextReferenceId`（`ref_…`）：文件中的一次出現。是 branded 型別。它存在於編輯器的狀態裡，不會出現在 wire 上，而且在重新解析正規的 Markdown 時會重新產生。
- `ChatAttachmentId`：既有的、由 server 擁有的附件資源。Record 的 `attachmentId` 是一個綁定關係，不是 chip 的身分，所以上傳正規化的過程可以替資源改名，而不必改寫 reference。

Context id 和 reference id 由 client 產生。共用程式碼不產生，因為 Effect 的 lint plugin 不允許在那裡直接呼叫 `crypto.randomUUID()`。

## 正規的 reference 語法 {#canonical-reference-syntax}

文法由 [`composerContextReferences.ts`](../../packages/shared/src/composerContextReferences.ts) 負責：

```text
[label](t3-context://v1/<kind>/<contextId>)
![label](t3-context://v1/image/<contextId>)
```

Parser 只接受剛好是 `t3-context:` 的 scheme、`v1` 這個 host、一個符合 `[a-z][a-z0-9-]{0,39}` 的 kind 區段，以及一個符合 `[a-z0-9_-]{1,128}`（不分大小寫）的 id 區段。Query string、fragment、帳密資訊和多出來的區段都會被拒絕。Label 會經過清理，確保能安然放在 Markdown 連結裡（不含方括號或換行、最多 200 個字元、絕不為空）。解析失敗的連結就是一般文字。`collectComposerInlineTokens` 本來就會拒絕帶有 URI scheme 的檔案連結，所以 context 連結絕對不會被誤認成 mention。

## 給 Provider 的投影 {#provider-projection}

`projectComposerContextForProvider({ text, records })` 會建立 Provider 讀到的內容：

1. 每個 reference 都在原位變成一個標記：`[Image: shot.png; ref=ctx_1]`。
2. 結尾附上一個 `<t3_context version="1">` 封套（envelope），裡面針對每個「被引用到的不重複 id」各放一筆 `<context kind id>`，順序依照第一次被引用的先後。從未被引用的 record 不會輸出。被引用到、卻沒有對應 record 的 id，會變成 `<context … unavailable="true"/>`。Mention 和 skill 的 record 會產生標記，但沒有對應的條目。未知的 kind 會把它的 payload 以 JSON 輸出。
3. 擷取到的文字是資料：任何會開啟或關閉 `t3_context` 或 `context` 的 `<` 都會被跳脫，所以終端機裡的一行輸出或一則 PR 留言沒辦法偽造出一筆 record。

附件的位元組資料走既有的附件通道；封套只帶 metadata。沒有 reference 的文字會原樣傳回。

:::plain Provider 實際看到的樣子
存下來的訊息裡是 `t3-context://` 連結，Provider 讀到的則是另一份整理過的文字：內文裡的連結換成方括號標記，詳細內容集中放在訊息最後的 `<t3_context>` 區塊，每一筆只出現一次。被擷取進來的文字（例如終端機輸出）如果剛好含有長得像這些標籤的字串，會先被跳脫，避免它被當成真正的 record。
:::

## 舊版訊息 {#legacy-messages}

這個功能上線之前送出的訊息，帶有結尾的 `<terminal_context>`、`<element_context>` 和 `<preview_annotation>` 區塊、`<review_comment>` 區塊，以及 U+FFFC 的終端機佔位符。[`composerContextLegacy.ts`](../../packages/shared/src/composerContextLegacy.ts) 會在記憶體裡把它們升級：

- Review 區塊會在原位變成 reference。原本跟在文字後面的區塊會附加在最後，和舊的送出順序一致。
- 結尾的區塊會依照送出順序的反向，從尾端一個個剝下來（preview、element、terminal）。
- 佔位符會依序綁定到終端機條目；沒有佔位符的條目會附加在後面。
- Id 是確定性的（`legacy_<kind>_<n>`），所以重複執行升級是冪等（idempotent）的。

Event 歷史絕對不會被改寫。`apps/web/src/lib/` 裡既有的 web parser 會留著，直到對話紀錄（transcript）的 renderer 改用 record 為止。

## 編輯器模型（web 與 desktop） {#editor-model-web-and-desktop}

`ComposerContextReferenceNode`（`apps/web/src/components/ComposerContextReferenceNode.tsx`）是所有 context kind 共用的唯一一種行內 Lexical node。它儲存 `kind`、`contextId`、`label`，以及每次出現各自的 `referenceId`，而它的文字內容就是正規連結。Prompt 字串帶有 payload 的身分和位置，所以重建編輯器時會還原出等效的 chip；但不會保留編輯器本地的 occurrence id。使用 U+FFFC 序數佔位符的舊草稿會在 hydration 時遷移：佔位符依陣列順序綁定到終端機 context，接著，prompt 沒有提到的 context 會以連結的形式加在最前面。

Record 目前仍然留在草稿 store 的型別化陣列裡。編輯器會從這些陣列建立一個以 `contextId` 為鍵的 `Map`（`composerContextRecordsFromDraft`），並透過 `ComposerContextRecordsContext` 提供出去。`ComposerContextReferenceChip` 會查出 record，並呈現該 kind 的 chip；遇到未知的 kind 或找不到 record 時，會呈現「未解析（unresolved）」的 chip，而不是直接消失。移除一個 chip 只會移除那一次出現；訊息輸入框（composer）的 change handler 會把被引用到的 id 和草稿陣列做比對，把沒有任何 chip 指向的 record 丟掉。

第 1 版刻意讓每個 client 明確地各自處理 kind 的呈現方式，而不是公開一個執行期的 handler registry。合約和 codec 是共用的；web 和 desktop 呈現豐富的 chip，手機則呈現可讀的 label。只有在第三方或執行期才定義的 kind 必須提供「無法隨 client 一起出貨」的行為時，才加入 registry。同樣地，只有在未來某個功能需要跨越序列化邊界去指定某一次出現時，持久的 occurrence id 才應該放進正規的 reference 語法裡。

終端機 context 現在和其他所有 context record 走同一條送出路徑：持久化的訊息保留它的正規連結和結構化的 record，而給 Provider 的投影會把連結換成可讀的標記，並在 context 封套裡把摘錄放進去一次。舊的結尾 `<terminal_context>` 形式，只有在讀取舊版 client 送出的訊息時才會被解析。

## 送出與讀取訊息 {#sending-and-reading-messages}

Composer 送出的 `message.text` 是帶有 reference 連結的正規內文，`message.context.records` 則是從草稿建立出來的（`apps/web/src/lib/composerContextRecords.ts` 裡的 `buildMessageContext`）。已過期的終端機摘錄會從兩邊都被丟掉。Server 在 turn 開始時才投影出給 Provider 的文字（`projectComposerContextForProvider`），所以持久化的訊息保持可讀，而 Provider 收到的是標記加上一個封套。

Review comment 和預覽註記是透過 store 的 mutator 進入草稿的。已掛載的 composer 會註冊一個 context 插入 handler，讓來自面板的 reference 落在它目前的、或最後已知的游標（caret）位置；沒有 composer 掛載時，store 會把它們附加在後面。終端機摘錄和附件也採用同樣的「游標優先」行為。在編輯器裡移除 chip 會移除 record；移除預覽截圖的縮圖則會移除它的註記和 chip。

對話紀錄用 `resolveUserMessageContext` 來解析一則訊息：結構化的 context 直接使用，較舊的訊息則在記憶體裡升級。`ChatMarkdown` 透過 `renderContextReference` 來呈現 `t3-context://` 連結，時間軸再透過 web 的 context-presentation registry 把它對應到 chip。這個 registry 為每個已知的 kind 宣告 compact、details 和 expanded 三種能力，拒絕重複的 surface handler，並提供未解析時的 fallback。終端機摘錄、元素、review comment 和預覽註記會開啟結構化的 details popover；圖片和影片則使用共用的 media modal。手機把 context 連結呈現為它們的 label。

Pull request 摘要目前是以 review-comment record 的形式傳遞，並帶有選填的、有型別的 `pullRequest` metadata。這份 metadata 是附加當下的 snapshot，內容包含編號、標題、URL、分支、狀態和 draft 旗標。Web 和 desktop 會呈現精簡的 `#number` label，並從那份 snapshot 推導出它的狀態色調。滑鼠停留時會顯示 snapshot 的詳細內容；點按啟動時，會依照目前的 environment 解析 URL，並在 Thread 的右側面板開啟那個 pull request。在這份 metadata 加入之前寫下的 record，會保留它們舊有的 details 和中性的 pull request 色調。

## 附件 {#attachments}

圖片和檔案的 record 使用草稿附件的本地 id 作為 `contextId`，並帶有一個 `attachmentId` 綁定。Composer 送出的是上傳的 pending id（走 data-URL 路徑時則是本地 id，透過 `UploadChatImageAttachment` 上選填的 `id`）；server 的 `Normalizer` 會把每一個圖片和檔案 record 改寫成它所指派的持久化 id，所以儲存下來的訊息會把 record 綁定到真正的資源。Optimistic 的列綁定的是本地 id，之後會被 server 的版本取代。

在 composer 裡，附加檔案或圖片會在游標位置插入一個 chip（編輯器無法接受輸入時則附加在後面）。檔案只以 chip 的形式存在：一個檔案的最後一個 chip 被刪除時，這個檔案就會被移除，它的上傳也會被釋放；而早於 reference 功能的草稿，會在 hydration 時補上一個 chip。圖片則仍以縮圖列（thumbnail shelf）作為清單；刪除 chip 會留下圖片，而移除一張仍被引用的縮圖時，會先要求確認，再把兩者一起移除。舊草稿不會多出圖片 chip。

在對話紀錄裡，圖片 chip 會開啟圖庫預覽，影片 chip 會開啟媒體預覽，其他檔案的 chip 則會開啟或下載該檔案。圖庫仍然會顯示每一張圖片；檔案列只保留給沒有任何 chip 引用的檔案。

:::plain 檔案和圖片的差別
檔案只存在於 chip：把某個檔案的最後一個 chip 刪掉，這個檔案就從草稿裡移除了。圖片另外有一排縮圖當作清單：刪掉 chip 後圖片還在縮圖列上；反過來，要移除一張內文還在引用的縮圖時，會先問你，確認後才把縮圖和 chip 一起拿掉。
:::

## 剪貼簿 {#clipboard}

每一條複製路徑都會把正規的 Markdown 寫成 `text/plain`，而且在選取範圍包含 chip 時，還會在 `web application/x-t3-context-fragment+json` 底下寫入一個結構化的 fragment（`ComposerContextClipboardFragment`：版本、來源的 environment / thread / message、records；沒有位元組資料，也沒有 URL）。Composer 的複製和剪下是透過 Lexical 的 command listener 加入它；對話紀錄的選取複製，是從使用者訊息本體上的 `onCopyCapture` 加入它，同時 chip 會透過 `data-markdown-copy` 重新輸出它們的連結；整則訊息的複製按鈕則透過 `ClipboardItem` 兩者都寫，並退回成純文字。

貼上時，composer 會先解碼 fragment，再處理純文字。草稿裡還沒有的 record 會被匯入：終端機摘錄和 review comment 原樣匯入，預覽註記從它們的 record 重建，而圖片或檔案則透過來源 environment 的 asset URL 重新抓取，並以一個新的本地 id 附加，貼上的連結也會改寫成那個 id。貼上的二進位內容在它的位元組到達之前，會顯示為未解析的 chip；來自另一個 environment 的 fragment 則會讓二進位內容維持未解析。已呈現的 chip 和已送出的訊息絕對不會因為貼上而被改動。

跨 Thread、跨專案或跨 environment 的貼上使用同一條路徑：client 從來源 environment 產生一個 asset URL，下載位元組，再附加到這裡。沒有 server 端的複製（clone）；如果來源連不上，或附件已經不在了，會有一則 toast 說明，而 chip 會維持未解析。

## Id、持久化與 stash {#ids-persistence-and-the-stash}

產生 context 的各方保有它們自己的 id 文法；`toComposerContextId` 會在 reference 和 record 的邊界上，以確定性的方式，把任何超出 `[a-z0-9_-]` 的內容摺疊成一個 slug 加上一個 hash。預覽註記的 context id 是從 `annotation-<id>` 推導出來的，這樣它才能和它的截圖圖片有所區別，因為截圖的 attachment id 就是那個註記的 id；record 透過 `screenshotContextId` 把兩者連結起來。

`projection_thread_messages.context_json` 會把 record 持久化，所以重新啟動或重新載入 projection 之後，chip 仍然可以解析。Prompt stash 的條目會為終端機摘錄、review comment 和預覽註記帶著 `records`；stash 的時候會把它們移出草稿，還原時則透過貼上路徑所用的同一個 importer 把它們匯入回來。

其他面板產生的 context 是透過 `setContextInsertionHandler` 抵達游標位置的：已掛載的 composer 會為它的草稿註冊一個 inserter，而 store 則退回成附加在後面。
