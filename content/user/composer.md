---
title: 訊息與上下文
source: docs/user/composer.md
source_hash: 8cb8d7805ac9b7758a2a693242b912dd65ebe883
---

在訊息輸入框（composer）裡把任務交給 agent。任務需要更多上下文時，可以加入檔案、引用先前的回覆，或是附上一個 skill。

一則訊息最多可以有 120,000 個字元。超過長度的草稿會留在 composer 裡，讓你把它縮短，或是拆成幾則訊息。

貼上 32 KiB 以上的文字時，那段內容會變成一個文字檔附件，這樣 agent 可以去查看它，而不會塞滿模型的 context。比較小的貼上內容，如果插入後會超過訊息長度上限，也會變成附件。使用實體鍵盤時，在 Apple 裝置上按 `Cmd+Shift+V`、其他裝置上按 `Ctrl+Shift+V`，就可以讓一大段貼上的內容留在 composer 裡繼續編輯。

:::note 32 KiB 大約是多少字
這個門檻是用位元組算的，不是字數。32 KiB 是 32,768 個位元組：純英文大約就是三萬多個字元，但一個中文字通常佔 3 個位元組，所以貼上大約一萬一千個中文字就會被轉成附件。貼一整份 log 或一大段程式碼時最容易遇到。
:::

## 附加檔案 {#attach-files}

每則訊息最多可以附加 100 個檔案。每張圖片最大 10 MiB，一則訊息裡的圖片總共最多 80 MiB。其他檔案（包括影片）每個最大 50 MiB，但還要看 environment 是否支援上傳以及它的上限。agent 會在 environment 所在的機器上收到這些檔案。Provider 和模型本身的限制仍然適用，對話裡先前已經有的圖片也會算進去。影片附件給 agent 的是一個檔案路徑；它不會讓模型能直接看影片。

:::plain 附件上限整理
| 項目                     | 上限                                   |
| ------------------------ | -------------------------------------- |
| 每則訊息的檔案數         | 100 個                                 |
| 單張圖片                 | 10 MiB                                 |
| 一則訊息裡的圖片總和     | 80 MiB                                 |
| 其他檔案（包括影片）     | 每個 50 MiB，另受 environment 的上限限制 |

這些是 T3 Code 這一層的上限。通過之後，Provider 和模型還有它們自己的限制。
:::

你一加入附件，上傳就會開始。所有上傳都完成之後，訊息才能送出。上傳失敗的檔案可以重試或移除。在網頁版和桌面版，如果在上傳完成之前重新載入頁面，那個檔案就要重新附加一次。

你可以把圖片拖曳或貼上到網頁版或桌面版的 composer。HEIC 和 HEIF 照片在這裡會被轉成 JPEG，從手機相簿選取時也一樣；超過圖片大小上限的照片還會被縮小到符合上限。在手機上，你也可以透過其他 app 的系統分享選單，把檔案送到 T3 Code。

預覽和儲存媒體檔案的方式，請看[訊息中的圖片與影片](#images-and-videos-in-messages)。

## 在 agent 工作時送出訊息 {#send-while-the-agent-is-working}

在網頁版和桌面版，到 **Settings → General → Follow-up behavior** 選擇新訊息要排進佇列留給之後的 turn（Queue），還是立刻送進正在執行的 turn 來引導它（Steer）。這個設定只套用在目前這個 client；已經在佇列裡的訊息會維持原本的位置。佇列裡的訊息儲存在 server 上，可以在 composer 上方編輯、重新排序或移除。macOS 的 `Cmd+Enter`、Windows 和 Linux 的 `Ctrl+Enter` 會採用相反的動作：預設是 Queue 時它會 steer，預設是 Steer 時它會排進佇列。

:::plain Queue 和 Steer 差在哪
agent 正在做事的時候，你又想到一件事要交代，有兩種送法：

- **Queue**：排隊。訊息先放著，等 agent 把手上這個 turn 做完，再當成下一個 turn 送出去。適合「做完這個之後，再幫我做那個」。
- **Steer**：插話。訊息立刻送進正在執行的 turn，讓 agent 邊做邊調整。適合「等一下，方向不對，改成這樣做」。

還沒改過設定時，預設是 Queue。
:::

按 macOS 的 `Cmd+Shift+Enter`，或 Windows 和 Linux 的 `Ctrl+Shift+Enter`，可以把佇列裡最舊的那則訊息當成 steer 送出。這不會動到目前的草稿，但需要有一個正在執行、而且支援 steer 的 turn。想改用其他快捷鍵，請在 **Settings → Keybindings** 修改 `thread.steerQueuedMessage`。

游標在 composer 最開頭時，按 macOS 的 `Option+Up`，或 Windows 和 Linux 的 `Alt+Up`，可以編輯最近一則排進佇列的訊息。想改用其他快捷鍵，請修改 `thread.editQueuedMessage`。

手機版在 **Settings → Follow-ups** 有同樣的選項。turn 執行期間，送出按鈕會顯示它將採取哪一種動作。長按按鈕可以只對這一則訊息使用另一種動作，用實體鍵盤送出時按住 `Cmd` 也可以。只有在執行中的 agent 支援 steer 時，按鈕才會提供 Steer。

## 在手機上離線排入訊息 {#queue-messages-offline-on-mobile}

手機版會在本機保留草稿附件的副本，所以在斷線時你仍然可以預覽附件，並把訊息排進佇列。重新連線後，上傳會繼續進行。草稿和佇列裡的訊息在 app 重新啟動之後仍然會保留。登出 T3 Connect 之後，這些內容會留在你的裝置上，直到你重新登入同一個帳號。

## 自訂模型 {#custom-models}

在網頁版和桌面版，用 Settings → Providers → **Models** 可以新增一個清單上沒有的模型，並自訂它的名稱和選項。只有 Provider 整合有支援的選項才會影響 turn。Antigravity 使用它帳號的模型目錄，不支援自訂模型。

## 模型預設值 {#model-defaults}

T3 Code 會記住你為新 Thread 選的 Provider、模型和模型選項。專案自己設定的模型優先；把那個專案設定重設之後，就會回到記住的選擇。

推理等級（reasoning level）或服務層級（service tier）留空不設定時，會使用 Provider 自己的設定。

## 引用 assistant 的回覆 {#quote-an-assistant-response}

在網頁版和桌面版，在同一則 assistant 回覆裡選取文字，然後選擇 **Cite in composer**。你可以針對這段引文加上評論，並在它前後寫下指示。

:::example 針對回覆裡的某一段追問
agent 回了一長串計畫，你只對其中一句有意見。選取那一句，按 **Cite in composer**，再接著打字：

```text
這一步先不要做，資料表的欄位名稱我們還沒定案。其餘照你的計畫進行。
```

送出後，agent 會知道你引用的是哪幾個字，不必你自己把那段文字複製貼上再說明。
:::

在草稿或已送出的訊息裡選取引文，就會回到它的出處。如果出處已經無法取得或內容已經變更，儲存下來的引文仍然可以閱讀。

引文的小標籤（chip）在你有寫評論時顯示評論，沒有的話就顯示一小段引文預覽。用鉛筆按鈕可以新增或修改評論。要移除這則引用，把游標放在它的 chip 旁邊，像刪除其他行內 context 一樣刪掉它。複製、重新載入，以及還原[暫存的 prompt](#prompt-stash)，都會讓每則評論跟著它的引文；送出時會告訴 agent 哪些字是被引用的，以及你寫了什麼評論。引用的文字和評論都會計入訊息長度上限。

手機版會顯示已儲存的引文和評論，但不能建立引用，也不能跳到它們的出處。

## 叫回已送出的 prompt {#recall-a-sent-prompt}

在空的 composer 裡按 `ArrowUp`，可以把你在這個 Thread 送出的上一則 prompt 叫回來。再按一次 `ArrowUp` 會往更早的走，按 `ArrowDown` 則往較新的走。往較新的方向走過最新一則 prompt 之後，composer 會被清空。叫回功能只會走過這個 Thread 裡已經載入的 prompt。原訊息裡的附件、終端機 context 和其他額外內容不會還原，只會還原你輸入的文字。composer 裡如果有附件或選取的元素，就不算是空的。

composer 裡有文字時，方向鍵會照平常那樣移動游標。只有在文字是一則還沒被改過的叫回 prompt，而且游標在視覺上的第一行（按 `ArrowUp` 時）或最後一行（按 `ArrowDown` 時）的時候，叫回功能才會接手；自動換行產生的行也算在內。一旦編輯了叫回的 prompt，它就變成一般的草稿。

## 編輯先前的 prompt {#edit-an-earlier-prompt}

在網頁版和桌面版，選擇某一則已送出訊息下方的 **Edit from here**，可以把對話倒回那則訊息之前。選擇 **Revert and keep changes** 會讓 workspace 的檔案維持現狀，選擇 **Revert files too** 則會連檔案一起還原。只有在 worktree 裡執行的 Thread 才會提供檔案還原；如果另一個 Thread 或 agent session 也在使用那個目錄、它裡面的某個資料夾，或是包含它的某個資料夾，檔案還原會被拒絕，因為還原會抹掉它們的變更。在專案目錄裡工作的 Thread 只會倒回對話。被選取的 prompt 和它的附件會回到 composer，讓你編輯後重新送出。任何還沒送出的草稿會留在還原回來的 prompt 上方。

這會把選取的訊息以及之後的對話，從目前的 Thread 和 Provider 的歷史紀錄裡移除。它不會復原對外部造成的動作，也不會復原 Provider 另外保存的記憶。只有在 Provider 支援倒回時，這個動作才能使用。

:::example 兩種還原方式怎麼選
你請 agent 重構一個模組，它改了十幾個檔案之後，你發現一開始的指示就下錯了。在那則指示下方按 **Edit from here**：

- 想保留 agent 已經改好的檔案，只是把對話倒回去重新下指示：選 **Revert and keep changes**。
- 想讓檔案也回到那則訊息之前的樣子，整個重來：選 **Revert files too**。這個選項只有在 worktree 裡執行的 Thread 才會出現。

不論選哪一個，agent 已經做出去的外部動作（例如已經推上去的 commit、已經送出的請求）都不會被收回。
:::

## Prompt 暫存 {#prompt-stash}

在網頁版和桌面版，按 macOS 的 `Cmd+S`，或 Windows 和 Linux 的 `Ctrl+S`，可以把目前的 prompt 和它的附件存起來留待之後使用。請先等上傳完成。composer 是空的時候，同一個快捷鍵會還原唯一的那筆暫存；有好幾筆時，則會開啟暫存選單。

:::plain 什麼時候會用到暫存
你正在寫一則很長的 prompt，寫到一半臨時要先問 agent 另一件事。按 `Cmd+S` 或 `Ctrl+S` 把寫到一半的內容收起來，composer 就空出來了；問完之後在空的 composer 再按一次同樣的快捷鍵，剛才的內容連同附件就會回來。
:::

含有已上傳檔案的暫存，必須在它原本的 environment 裡還原。這些檔案會保留 24 小時。上傳的檔案過期之後，請先還原 prompt，再用 **Attach again** 重新附加，或是把遺失的檔案移除之後再送出。

## iPhone 上的語音輸入 {#voice-input-on-iphone}

在支援的 iPhone 上（iOS 26 或更新版本），用 composer 的麥克風錄音，然後按確認來轉成文字。文字會插入到開始錄音時你選取的位置，讓你在送出之前先檢查和修改。

第一次使用時可能會下載 Apple 的語音模型，需要網路連線。之後同一種語言的轉錄可以離線進行。錄音最長五分鐘。取消、離開這個畫面，或是音訊被中斷，都會捨棄這段錄音，並保留你原本的草稿。錄音期間螢幕會保持喚醒；錄音停止之後，螢幕就可以正常進入休眠。

轉錄是在你的裝置上進行的。轉錄完成或取消之後，T3 Code 會刪除暫存的音訊；你送出時只會送出訊息的文字。

## 佇列裡的訊息 {#queued-messages}

在網頁版和桌面版，agent 正在工作而且草稿是空的時候，composer 會顯示 **Interrupt**。加入文字或附件之後，它會換成一個 steer 箭頭。點一下它，就會把訊息送進正在進行的 turn；在桌面版也可以按 `Enter`。按住 macOS 的 `Cmd`，或 Windows 和 Linux 的 `Ctrl`，按鈕會切換成佇列圖示。按住那個鍵的同時點一下，或是在桌面版按 `Cmd+Enter` 或 `Ctrl+Enter`，訊息就會排進佇列，等目前的 turn 結束之後才送出。

佇列裡的訊息顯示在 composer 上方。每一列除了文字之外，還會顯示附加圖片的縮圖。你可以拖曳把手來調整某一列的順序、在把手上用方向鍵移動、把那則訊息升級成 steer，或是把它移除。

:::screenshot composer-queued-messages
agent 工作中的 composer：上方列出兩則佇列裡的訊息，每一列有拖曳把手、鉛筆與移除按鈕，送出按鈕顯示為 steer 箭頭。
:::

如果 server 重新啟動，已儲存的佇列訊息會維持原本的順序，並且暫停不送出。在網頁版或桌面版，於空的 composer 裡按 **Resume**；在手機版，於佇列面板裡按 **Resume queue**，就會繼續。你可以在不啟動它們的情況下，編輯、重新排序或移除這些暫停中的訊息。

佇列列上的鉛筆會把那則訊息開到 composer 裡編輯。在你儲存之前，原本的訊息會留在佇列裡，編輯期間它那一列會被標示出來。那則訊息的附件會顯示在文字上方，並附有移除按鈕；新圖片可以用平常的方式加入。打勾按鈕會把佇列裡的訊息原地儲存；它那一列上的 **Cancel** 則讓它保持不變。開始編輯之前你在 composer 裡打的內容，會在編輯結束後還原。如果你編輯到一半，佇列裡的那則訊息開始執行或被移除了，編輯就會結束：composer 是空的時候，改過的內容會移到 composer 裡；否則就會被捨棄。

## 指令與 skill {#commands-and-skills}

輸入 `/` 可以使用指令，輸入 `$` 可以加入所選 environment 和 Provider 的 skill。在手機版，開始 Thread 之前的 **New task** 畫面上也可以使用這兩者。

斜線選單裡也會列出 skill，除非你關掉 **Settings → General → Show skills in slash menu**。只有對該 Provider 啟用的 skill 才會列出來。

新增或修改了 skill、plugin 或 MCP server 之後，請在網頁版和桌面版的指令面板使用 **Restart agent session**。對話會接續下去，而你的下一則訊息會讓 agent 以新的設定重新啟動。

Provider 的指令必須放在訊息的最開頭才會執行。T3 Code 的指令（例如 `/model` 和 `/plan`）以及 skill mention，放在任何一行都有效。

在既有的對話裡送出 `/compact`，可以在 Provider 支援時降低 context 的用量。網頁版和桌面版也可以從 context 用量計執行壓縮。

:::plain 這一頁提到的四個觸發字元
| 輸入 | 會出現什麼                                     | 可用範圍       |
| ---- | ---------------------------------------------- | -------------- |
| `/`  | 指令（除非關掉設定，否則也包含 skill）         | 所有 client    |
| `$`  | 所選 environment 和 Provider 的 skill          | 所有 client    |
| `#`  | 目前專案 repository 的 pull request            | 網頁版、桌面版 |
| `@`  | 同一個 server 上的其他 Thread                  | 所有 client    |

`#` 和 `@` 的細節在下一節。
:::

## 訊息裡的 context {#context-in-your-message}

你附加的 context 會落在游標所在的位置，成為文字裡的一個 chip：可能是一段終端機摘錄、來自 diff 或檔案的一則 review 評論、一則預覽標註，或是一個檔案。你可以在 chip 的前後打字，用剪下再貼上的方式移動它，也可以像刪除一個字元那樣刪掉它。把滑鼠移到 chip 上會顯示它的簡要資訊。選取終端機摘錄會開啟它擷取到的輸出；選取 review 評論、選取的元素或預覽標註，則會開啟它的完整內容。螢幕閱讀器會把 chip 讀成「Terminal excerpt, Terminal 1 lines 3-4」這一類的文字。

:::screenshot composer-context-chips
一則草稿裡同時有文字和幾個 chip：一段終端機摘錄、一個檔案、一個帶編號的 pull request，上方是圖片的縮圖列。
:::

Pull request 會顯示成它的圖示加上編號。它的顏色反映的是附加當下的狀態：open、draft、merged 或 closed。選取它可以查看當時擷取的標題和分支，再選擇 **Open pull request** 前往那個 pull request。在網頁版和桌面版，輸入 `#` 可以瀏覽目前專案 repository 裡最新的 pull request。接著輸入數字，會用 pull request 編號的任何一部分來篩選這份最近清單。完整的編號也會被直接解析，即使那個 pull request 比最近清單裡的還要舊。在 `#` 後面輸入一個單字，會用文字搜尋 repository 裡的 pull request。選擇一個結果，就會把它插入成 chip。

另一個 Thread 也可以當成 context。輸入 `@` 再接上它標題的一部分，就可以從同一個 server 上挑選一個；在網頁版和桌面版，也可以把 Thread 從側邊欄拖出來，放到 composer 上；多選的 Thread 會一起放進來。chip 顯示的是那個 Thread 目前的標題，選取它就會開啟那個 Thread。你的 prompt 只帶著一個參照：agent 需要時才去讀那個 Thread 的歷史紀錄，所以附加一個很長的 Thread 不會有任何成本，直到 agent 真的去看為止。附加一個 Thread 不會改變它，而且除非你要求，agent 也不能傳訊息給它。

:::example 把另一個 Thread 的結論帶進來
你在一個 Thread 裡請 agent 調查過登入失敗的原因，現在想在另一個 Thread 動手修。在新的訊息裡輸入 `@`，接著打那個 Thread 標題的幾個字並選取它，然後寫：

```text
請依照這個 Thread 找到的原因修正，只改登入流程相關的檔案。
```

agent 會在需要的時候自己去讀那個 Thread 的內容，你不必把調查結果再貼一次。
:::

圖片會保留在文字上方的縮圖列，同時也會在游標位置得到一個 chip，這樣你可以明確指出你說的是哪一張圖。刪除圖片的 chip 之後，圖片仍然留在縮圖列上；如果你的文字裡還有提到那張圖片，移除縮圖時會先詢問，然後把兩者一起移除。檔案則只以 chip 的形式存在：刪掉某個檔案的最後一個 chip，就會把那個檔案從訊息裡移除。

複製含有 chip 的文字，再貼到另一則草稿裡（同一個 Thread 或另一個 Thread 都可以），chip 會連同它們指向的內容一起過去。圖片和檔案會從它們原本所在的 environment 重新取得；這段期間 chip 會顯示虛線外框，如果無法完成，T3 Code 會告訴你，並把 chip 留著讓你移除或替換。context 已經無法取得的 chip 也會顯示同樣的虛線外框；把滑鼠移上去可以看到該怎麼處理。

用複製按鈕複製一則訊息，或是從訊息裡複製文字，其他 app 會得到可讀的 Markdown，每個 chip 的位置換成一個連結。在有 chip 之前送出的舊訊息，仍然會顯示它們的 context。暫存一則 prompt 會保留它的 chip 以及它們指向的內容；還原時會把它們帶回來。

在手機版，點一下 chip 可以查看它的內容。檔案參照會開啟目前的檔案；附加的檔案則顯示當初附加到訊息上的那一份副本。

## 附加的檔案 {#attached-files}

在草稿或已送出的訊息裡選取檔案 chip，就可以預覽它。程式碼和 JSON 會有語法上色；Markdown、HTML、CSV 和 TSV 提供算繪後的檢視和原始內容檢視。音訊檔有播放控制項。很大的文字檔只會顯示有限的預覽；要讀完整內容，請把檔案存下來。

在網頁版和桌面版，檔案會在對話旁邊開啟，控制項和 workspace 的檔案相同：標題列上有檢視切換、**Copy contents** 和 **Save file**。在手機版，文件會在和 workspace 檔案相同的檔案畫面裡開啟；它的選單裡有 **Copy contents**、**Save or share** 和 **Open in file viewer**。圖片、影片和 PDF 仍然使用它們的原生檢視器；其他文件格式（例如 Word 或 Pages），在裝置有對應的檢視器時，會用裝置自己的檢視器開啟。如果裝置上沒有任何東西能顯示某種格式，請把它儲存或分享出去，在別的地方開啟。

## 訊息中的圖片與影片 {#images-and-videos-in-messages}

選取圖片或影片的附件或連結，就可以預覽。能不能播放要看你的瀏覽器或裝置；遇到不支援的影片，請存下來用其他 app 開啟。

在網頁版和桌面版，在媒體上按右鍵可以儲存它，或是複製它的路徑或 URL。在手機版，長按圖片或影片的縮圖，然後選擇 **Save or share**。在 iOS 上，看完全螢幕影片之後，要回到縮圖才能開啟這個選單。

檔案連結指向的是 environment 所在機器上的檔案，遠端連線時也一樣。預覽使用的是原始檔案，即使它在 workspace 之外。移動或刪除原始檔案可能會讓預覽失效，所以需要保留的話請另存一份。

## Workspace 之外的檔案 {#files-outside-the-workspace}

點 agent 給的檔案連結，可以閱讀 workspace 之外的報告或其他檔案。這些檔案會以唯讀方式開啟。Workspace 之外的 HTML 檔案無法載入旁邊檔案裡的 script、樣式或圖片。

## 檔案檢視器裡的 HTML 與 PDF 檔案 {#html-and-pdf-files-in-the-file-viewer}

在網頁版和桌面版，HTML 和 PDF 檔案會以算繪後的頁面開啟。把 HTML 檔案切換到原始碼檢視，可以閱讀它的標記；指向特定行的連結會自動開啟原始碼檢視。HTML 預覽無法存取你的 T3 Code session。

檔案檢視器是依檔名的副檔名來辨識圖片、HTML 和 PDF 檔案，檔名或資料夾名稱裡含有 `#` 或 `?` 的情況也包含在內。

在手機版，選取 PDF 附件或連結就可以開啟它。iOS 使用原生檢視器；Android 會開啟一個已安裝、相容的檔案檢視器。
