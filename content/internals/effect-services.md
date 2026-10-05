---
title: Effect service
source: docs/internals/effect-services.md
source_hash: 7ae4671d2e6ab94d2b308c3a64f964e300ec638b
---

Server 的功能都是 Effect service。呼叫它們的是各種傳輸層（transport）：[`ws.ts`](../../apps/server/src/ws.ts) 裡的 WebSocket RPC handler、HTTP route、MCP 工具、排程工作，以及 CLI。這一頁收錄撰寫 service 的規則。[Effect Service Conventions](../../.macroscope/check-run-agents/effect-service-conventions.md) 這個 review 檢查執行的是同一套規則；兩邊要保持一致。

## 功能該放在哪裡 {#where-a-feature-lives}

Server 的一項能力，就是它所屬領域資料夾（`project/`、`workspace/`、`git/`、`provider/`……）裡某個 service 上的一個方法。請擴充已經擁有該領域的 service；只有在沒有任何 service 擁有它時，才新增一個。

傳輸層的 handler 只做三件事：解碼請求、呼叫一個 service 方法、把 service 的具型別錯誤對應成該傳輸層的錯誤。除此之外什麼都不做。檔案系統、Git 或行程相關的工作、資料夾命名、多步驟的 dispatch、重試和 rollback，都屬於 service。

理由是「觸及範圍」。使用者從 WebSocket 觸發一項能力，agent 透過 MCP 工具使用它，排程工作和 CLI 也會執行它。寫在某一個 handler 裡的邏輯，其他入口就沒有，而且要測試它還需要一條 socket。純運算的工作（一個 slug、一張 SVG、一則訊息）用一般函式寫在 service 旁邊沒有問題；但能力本身就是那個方法。

:::plain 為什麼 handler 要這麼薄
同一個功能有很多個入口：使用者的畫面、agent 的 MCP 工具、排程、CLI。如果把真正的邏輯寫在 WebSocket 的 handler 裡，其他入口就用不到，只能再抄一份。所以 handler 只當「翻譯」：把請求轉成 service 呼叫，再把錯誤轉回去，真正做事的是 service。
:::

```ts
// ws.ts: a thin handler
[WS_METHODS.projectsCreateNew]: (input) =>
  observeRpcEffect(
    WS_METHODS.projectsCreateNew,
    projectFolders.createNamedProject(input).pipe(
      Effect.mapError((cause) => new ProjectCreateNewError({ cause })),
    ),
    { "rpc.aggregate": "orchestration" },
  ),
```

## Service 模組的樣子 {#shape-of-a-service-module}

一個 service 一個模組，內容依照這個順序：import、錯誤與 schema、把介面直接寫在裡面的 `Context.Service` tag、`make`，最後是 `layer`。[`WorkspacePaths.ts`](../../apps/server/src/workspace/WorkspacePaths.ts) 和 [`T3ProjectFileLoader.ts`](../../apps/server/src/project/T3ProjectFileLoader.ts) 是很好的參考。

```ts
export class FooWriteError extends Schema.TaggedError<FooWriteError>()("FooWriteError", {
  path: Schema.String,
  cause: Schema.Defect(),
}) {
  override get message(): string {
    return "Failed to write the foo file.";
  }
}

export class Foo extends Context.Service<
  Foo,
  { readonly write: (input: { readonly path: string }) => Effect.Effect<void, FooWriteError> }
>()("t3/area/Foo") {}

const make = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  // ...
  return Foo.of({ write });
});

export const layer = Layer.effect(Foo, make);
```

- **Import。** 使用端把模組當成一個 namespace 來用：`import * as Foo from "./Foo.ts"`，然後寫 `yield* Foo.Foo` 和 `Foo.layer`。絕對不要寫 `import { layer as fooLayer }`。
- **相依項目**從 environment 取得（`yield* FileSystem.FileSystem`），絕對不要當成 `make` 的參數傳進來。
- **`make`** 保持私有，除非有其他模組 import 它。Knip 遇到沒有被使用的 export 會讓 CI 失敗。
- **錯誤**是 `Schema.TaggedError` 類別，帶有結構化的屬性；包裝另一個失敗時要帶上 `cause`。訊息是固定的，或是由屬性組出來的，絕對不要從 `cause` 產生。在失敗發生的地方建立錯誤；只有在傳輸層才把它對應成傳輸層的錯誤。用 `Effect.catchTags` 捕捉已知的 tag。
- **測試**要透過 service 來驗證行為，只有外部相依項目才使用測試用的 layer。不要去 mock 正在被測試的邏輯。

:::note 這裡的 environment 不是產品概念的 environment
「相依項目從 environment 取得」指的是 Effect 的相依環境，也就是範例裡用 `yield* FileSystem.FileSystem` 向它要一個 service 的那個機制。它和 T3 Code 文件其他地方說的 environment（一個執行中的 server 加上它的機器）是兩回事。
:::

## Push 之前 {#before-you-push}

- 你動過的 handler，有沒有哪一個做了解碼、呼叫、對應錯誤以外的事？
- agent（MCP）或排程工作用得到這項能力嗎？如果用不到，那是刻意的嗎？
- 新增 service 之前，你有沒有先擴充該領域既有的 service？
- 你跑過 knip 了嗎？新的 export 沒有人 import 的話，它會失敗。
