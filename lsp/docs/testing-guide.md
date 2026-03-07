# Context-Engine LSP — Testing Guide

## Connection

Connect via WebSocket to:

```
ws://127.0.0.1:9257/lsp?lang=<languageId>
```

**Examples:**

- `ws://127.0.0.1:9257/lsp?lang=javascript`
- `ws://127.0.0.1:9257/lsp?lang=bash`
- `ws://127.0.0.1:9257/lsp?lang=python`
- `ws://127.0.0.1:9257/lsp?lang=typescript`

> The server will close the connection with code `4000` if `?lang=` is missing, or `4001` if the language is not found.

---

## Message Format

All messages are **JSON-RPC 2.0** sent as plain JSON text over WebSocket (no `Content-Length` framing).

- **Request** — has `id` (number or string) + `method` + optional `params`
- **Notification** — has `method` + optional `params`, **no `id`**
- **Response** — server replies with `id` + `result` (or `error`)

---

## Required Lifecycle

You **must** follow this sequence:

```
1. → initialize        (request)
2. → initialized       (notification)
3. → didOpen           (notification, opens a document)
4. → ... any requests ...
5. → didClose          (notification, closes the document)
6. → shutdown          (request)
7. → exit              (notification)
8.   close WebSocket
```

---

## 1. Initialize

**Send (request):**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "processId": null,
    "capabilities": {},
    "rootUri": null
  }
}
```

**Receive:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "capabilities": { "...server capabilities based on language data..." },
    "serverInfo": { "name": "context-engine-lsp", "version": "1.4.0" }
  }
}
```

---

## 2. Initialized (notification)

**Send:**

```json
{
  "jsonrpc": "2.0",
  "method": "initialized",
  "params": {}
}
```

No response (notification).

---

## 3. Open a Document

**Send:**

```json
{
  "jsonrpc": "2.0",
  "method": "textDocument/didOpen",
  "params": {
    "textDocument": {
      "uri": "file:///home/user/test.js",
      "languageId": "javascript",
      "version": 1,
      "text": "const x = 1;\nconsole.log(x);\n"
    }
  }
}
```

No direct response, but the server may push a `textDocument/publishDiagnostics` notification.

---

## 4. Requests (all require `id`)

### textDocument/completion

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "textDocument/completion",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js" },
    "position": { "line": 0, "character": 5 }
  }
}
```

**Response:** `{ "isIncomplete": false, "items": [...] }`

---

### textDocument/hover

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "textDocument/hover",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js" },
    "position": { "line": 0, "character": 6 },
    "context": { "word": "console" }
  }
}
```

> **Tip:** The server looks up `params.context.word` or `params.word` for lookup-based methods. If neither is provided, the result may be `null`.

**Response:** Hover object or `null`.

---

### textDocument/signatureHelp

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "textDocument/signatureHelp",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js" },
    "position": { "line": 1, "character": 13 },
    "context": {
      "triggerKind": 2,
      "triggerCharacter": "("
    }
  }
}
```

**Response:** `{ "signatures": [...], "activeSignature": 0, "activeParameter": 0 }`

---

### textDocument/definition

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "textDocument/definition",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js" },
    "position": { "line": 0, "character": 6 },
    "context": { "word": "console" }
  }
}
```

**Response:** Location / Location[] / `null`.

---

### textDocument/declaration

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "textDocument/declaration",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js" },
    "position": { "line": 0, "character": 6 },
    "context": { "word": "console" }
  }
}
```

---

### textDocument/typeDefinition

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "textDocument/typeDefinition",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js" },
    "position": { "line": 0, "character": 6 },
    "context": { "word": "console" }
  }
}
```

---

### textDocument/implementation

```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "method": "textDocument/implementation",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js" },
    "position": { "line": 0, "character": 0 }
  }
}
```

**Response:** Location[].

---

### textDocument/references

```json
{
  "jsonrpc": "2.0",
  "id": 9,
  "method": "textDocument/references",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js" },
    "position": { "line": 0, "character": 6 },
    "context": { "includeDeclaration": true }
  }
}
```

**Response:** Location[].

---

### textDocument/documentHighlight

```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "textDocument/documentHighlight",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js" },
    "position": { "line": 0, "character": 6 }
  }
}
```

**Response:** DocumentHighlight[].

---

### textDocument/documentSymbol

```json
{
  "jsonrpc": "2.0",
  "id": 11,
  "method": "textDocument/documentSymbol",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js" }
  }
}
```

**Response:** SymbolInformation[] or DocumentSymbol[].

---

### textDocument/codeAction

```json
{
  "jsonrpc": "2.0",
  "id": 12,
  "method": "textDocument/codeAction",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js" },
    "range": {
      "start": { "line": 0, "character": 0 },
      "end": { "line": 0, "character": 10 }
    },
    "context": { "diagnostics": [] }
  }
}
```

**Response:** CodeAction[].

---

### textDocument/codeLens

```json
{
  "jsonrpc": "2.0",
  "id": 13,
  "method": "textDocument/codeLens",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js" }
  }
}
```

**Response:** CodeLens[].

---

### textDocument/documentLink

```json
{
  "jsonrpc": "2.0",
  "id": 14,
  "method": "textDocument/documentLink",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js" }
  }
}
```

**Response:** DocumentLink[].

---

### textDocument/documentColor

```json
{
  "jsonrpc": "2.0",
  "id": 15,
  "method": "textDocument/documentColor",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js" }
  }
}
```

**Response:** ColorInformation[].

---

### textDocument/formatting

```json
{
  "jsonrpc": "2.0",
  "id": 16,
  "method": "textDocument/formatting",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js" },
    "options": { "tabSize": 2, "insertSpaces": true }
  }
}
```

**Response:** TextEdit[].

---

### textDocument/rangeFormatting

```json
{
  "jsonrpc": "2.0",
  "id": 17,
  "method": "textDocument/rangeFormatting",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js" },
    "range": {
      "start": { "line": 0, "character": 0 },
      "end": { "line": 1, "character": 0 }
    },
    "options": { "tabSize": 2, "insertSpaces": true }
  }
}
```

---

### textDocument/onTypeFormatting

```json
{
  "jsonrpc": "2.0",
  "id": 18,
  "method": "textDocument/onTypeFormatting",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js" },
    "position": { "line": 1, "character": 0 },
    "ch": "\n",
    "options": { "tabSize": 2, "insertSpaces": true }
  }
}
```

---

### textDocument/rename

```json
{
  "jsonrpc": "2.0",
  "id": 19,
  "method": "textDocument/rename",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js" },
    "position": { "line": 0, "character": 6 },
    "newName": "myVar"
  }
}
```

**Response:** WorkspaceEdit or `null`.

---

### textDocument/foldingRange

```json
{
  "jsonrpc": "2.0",
  "id": 20,
  "method": "textDocument/foldingRange",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js" }
  }
}
```

**Response:** FoldingRange[].

---

### textDocument/selectionRange

```json
{
  "jsonrpc": "2.0",
  "id": 21,
  "method": "textDocument/selectionRange",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js" },
    "positions": [{ "line": 0, "character": 6 }]
  }
}
```

**Response:** SelectionRange[].

---

### textDocument/linkedEditingRange

```json
{
  "jsonrpc": "2.0",
  "id": 22,
  "method": "textDocument/linkedEditingRange",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js" },
    "position": { "line": 0, "character": 0 }
  }
}
```

**Response:** `{ "ranges": [...], "wordPattern": "..." }` or `null`.

---

### textDocument/inlayHint

```json
{
  "jsonrpc": "2.0",
  "id": 23,
  "method": "textDocument/inlayHint",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js" },
    "range": {
      "start": { "line": 0, "character": 0 },
      "end": { "line": 10, "character": 0 }
    }
  }
}
```

**Response:** InlayHint[].

---

### textDocument/inlineCompletion

```json
{
  "jsonrpc": "2.0",
  "id": 24,
  "method": "textDocument/inlineCompletion",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js" },
    "position": { "line": 0, "character": 12 },
    "context": { "triggerKind": 1 }
  }
}
```

**Response:** `{ "items": [...] }`

---

### textDocument/semanticTokens/full

```json
{
  "jsonrpc": "2.0",
  "id": 25,
  "method": "textDocument/semanticTokens/full",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js" }
  }
}
```

**Response:** `{ "data": [...] }`

---

### textDocument/semanticTokens/range

```json
{
  "jsonrpc": "2.0",
  "id": 26,
  "method": "textDocument/semanticTokens/range",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js" },
    "range": {
      "start": { "line": 0, "character": 0 },
      "end": { "line": 5, "character": 0 }
    }
  }
}
```

---

## 5. Custom Methods

### context/listLanguages

List all available language IDs.

```json
{
  "jsonrpc": "2.0",
  "id": 100,
  "method": "context/listLanguages"
}
```

**Response:** `["abap", "angular", "bash", "c", "cpp", "css", "dart", ...]`

---

### context/languageData

Get the full raw data loaded for the current connection's language.

```json
{
  "jsonrpc": "2.0",
  "id": 101,
  "method": "context/languageData"
}
```

**Response:** `{ "language": "javascript", "providers": { "completion": {...}, "hover": {...}, ... } }`

---

## 6. Document Change (notification)

```json
{
  "jsonrpc": "2.0",
  "method": "textDocument/didChange",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js", "version": 2 },
    "contentChanges": [
      { "text": "const x = 1;\nconsole.log(x);\nvar y = 2;\n" }
    ]
  }
}
```

May trigger a `textDocument/publishDiagnostics` push from the server.

---

## 7. Close Document (notification)

```json
{
  "jsonrpc": "2.0",
  "method": "textDocument/didClose",
  "params": {
    "textDocument": { "uri": "file:///home/user/test.js" }
  }
}
```

Server clears diagnostics for that URI.

---

## 8. Shutdown & Exit

**Shutdown (request):**

```json
{
  "jsonrpc": "2.0",
  "id": 999,
  "method": "shutdown"
}
```

**Exit (notification):**

```json
{
  "jsonrpc": "2.0",
  "method": "exit"
}
```

Then close the WebSocket.

---

## Quick Test with websocat

```bash
# Install
cargo install websocat
# or: brew install websocat

# Connect
websocat ws://127.0.0.1:9257/lsp?lang=javascript

# Then paste JSON messages one per line:
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"processId":null,"capabilities":{},"rootUri":null}}
{"jsonrpc":"2.0","method":"initialized","params":{}}
{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{"textDocument":{"uri":"file:///test.js","languageId":"javascript","version":1,"text":"console.log('hello');"}}}
{"jsonrpc":"2.0","id":2,"method":"textDocument/completion","params":{"textDocument":{"uri":"file:///test.js"},"position":{"line":0,"character":8}}}
{"jsonrpc":"2.0","id":3,"method":"textDocument/hover","params":{"textDocument":{"uri":"file:///test.js"},"position":{"line":0,"character":8},"context":{"word":"log"}}}
{"jsonrpc":"2.0","id":100,"method":"context/listLanguages"}
{"jsonrpc":"2.0","id":999,"method":"shutdown"}
{"jsonrpc":"2.0","method":"exit"}
```

---

## Quick Test with Node.js / Bun

```js
import WebSocket from "ws";

const ws = new WebSocket("ws://127.0.0.1:9257/lsp?lang=javascript");

function send(obj) {
  ws.send(JSON.stringify(obj));
}

ws.on("open", () => {
  send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { processId: null, capabilities: {}, rootUri: null } });
  send({ jsonrpc: "2.0", method: "initialized", params: {} });
  send({ jsonrpc: "2.0", method: "textDocument/didOpen", params: { textDocument: { uri: "file:///test.js", languageId: "javascript", version: 1, text: "const x = 1;" } } });
  send({ jsonrpc: "2.0", id: 2, method: "textDocument/completion", params: { textDocument: { uri: "file:///test.js" }, position: { line: 0, character: 5 } } });
  send({ jsonrpc: "2.0", id: 3, method: "textDocument/hover", params: { textDocument: { uri: "file:///test.js" }, position: { line: 0, character: 6 }, context: { word: "const" } } });
});

ws.on("message", (data) => {
  console.log("←", JSON.parse(data.toString()));
});
```

---

## Error Codes

| Code | Meaning |
|------|---------|
| `4000` | Missing `?lang=` query parameter (WebSocket close) |
| `4001` | Unknown language ID (WebSocket close) |
| `-32601` | Method not found |
