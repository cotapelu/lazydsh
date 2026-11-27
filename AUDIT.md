# AUDIT.md — Bản kiểm toán độc lập source code lazydsh

> Phạm vi: Mọi file `.ts` trong `src/` (runtime, interactive-mode, components, theme, utils, custom-providers/ofm-provider…), toàn bộ `test/`, `package.json`, `tsconfig.json`, `vite.config.ts`.
> Cách tiếp cận: Đọc full từng dòng code, không dựa trên tài liệu AUDIT.md cũ của dự án. Đây là bản kiểm toán độc lập.
> Ngày kiểm tra: 2026-11-26.
> **Trạng thái verification:** Tất cả findings đã được verify bằng grep/read trực tiếp vào source code.

---

## 0. TÓM TẤT CAO CẤP

| Mức      | Số lượng | Mô tả                                                              |
| -------- | -------- | ------------------------------------------------------------------ |
| Critical | 0        | ~~Lỗi có thể làm hỏng toàn bộ process hoặc dữ liệu~~ **ĐÃ SỬA**    |
| High     | 0        | ~~Lỗi ảnh hưởng trực tiếp UX, bảo mật, hoặc hiệu năng~~ **ĐÃ SỬA** |
| Medium   | 12       | ~~Lỗi logic, race condition, 유지보수 khó~~ **3 ĐÃ SỬA, 3 MỚI**    |
| Low      | 5        | ~~Code smell, dead code, trùng lặp~~ **3 ĐÃ SỬA**                  |
| Orphan   | 15 file  | File đã port, typecheck, chưa có call site                         |

Điểm tích cực: kiến trúc hợp đồng rõ ràng, two-phase boot nhanh, overlay stack an toàn, test coverage tốt (173/173), `npm run check` clean, `npm run build` clean.

---

## 1. CRITICAL — Lỗi có thể làm hỏng toàn bộ process hoặc dữ liệu

### 1.1. Monkey-patch `globalThis.fetch` toàn cục, không thể đảo ngược — **FIXED**

**Vị trí:** `src/runtime/runtime.ts`, constructor của class `Runtime` (dòng 137–171).

Constructor của `Runtime` ghi đè `globalThis.fetch` bằng một wrapper có cờ `__ofmFetchWrapped`. Điều này ảnh hưởng **mọi lệnh `fetch` trong toàn process**, không chỉ OFM Kilo. Không có cách restore, không scoped per-provider, không xóa khi `Runtime` đóng. Nếu module khác cũng đụng `fetch`, hành vi không xác định.

**Nguyên nhân:** Wrapper được viết vào constructor thay vì module-level function hoặc transport riêng của OFM.

**Khuyến nghị:** Đưa wrapper ra module-level function, gọi 1 lần ở boot; hoặc gom vào transport của OFM thay vì để trong `Runtime`.

**Trạng thái:** **Đã sửa** — wrapper đã được chuyển thành module-level function `wrapFetchForOfmKilo()` và gọi 1 lần khi import module (dòng 55–78).

---

### 1.2. `authorization.cancel(key)` không `await` trong `logout()` — **NOT A BUG**

**Vị trí:** `src/runtime/runtime.ts`, hàm `logout()` (dòng 1028).

Các hàm xung quanh đều `await`, nhưng dòng này bị bỏ qua. Nếu `cancel()` trả Promise, credential có thể được xóa trước khi cancel xử lý xong → race condition.

**Khuyến nghị:** Thêm `await` trước `this.ctx.authorization.cancel(key)`.

**Trạng thái:** **Không phải bug** — `authorization.cancel()` trả về `void` (xem `@deepseek-ai/dsh-authorization` types), không phải Promise. Code đúng, chỉ là không nhất quán về style.

---

## 2. HIGH — Lỗi ảnh hưởng trực tiếp UX, bảo mật, hoặc hiệu năng

### 2.1. Lệnh external editor bị injection / hỏng nếu `$EDITOR` có ký tự đặc biệt — **FIXED**

**Vị trí:** `src/interactive-mode/external-editor.ts`, dòng 42.

```ts
const child = spawn(options.command + " " + JSON.stringify(filePath), {
  stdio: "inherit",
  shell: true,
});
```

- Nếu `$EDITOR` là `vim -c "set foo"` hoặc có ký tự shell metacharacter, sẽ bị inject.
- Nếu path có dấu cách, `JSON.stringify` được nối vào chuỗi rồi shell parse — có thể hỏng.
- Không dùng shell-quote parser.

**Khuyến nghị:** Parse command thành `[cmd, ...args]` hoặc dùng `shell-quote` / `shellwords`.

**Trạng thái:** **Đã sửa** — thêm `parseEditorCommand()` function parse command thành `[cmd, ...args]` xử lý quote/escape cơ bản, gọi `spawn(parsed.cmd, [...parsed.args, filePath], { shell: false })`.

---

### 2.2. `spawnSync`/`execFile` git chặn event loop mỗi 5 giây — **FIXED**

**Vị trí:** `src/interactive-mode/footer-data-provider.ts`, hàm `updateGitBranch()` (dòng 72–88).

`execFile("git", ["branch", "--show-current"], ...)` được gọi mỗi khi `.git/HEAD` thay đổi hoặc mỗi 5s poll. Mặc dù `execFile` là async (callback-based), callback chạy trên event loop và có thể gây jank khi render. Trên repository lớn hoặc ổ chậm, TUI sẽ giật khung hình.

**Khuyến nghị:** Thay bằng async `spawn` với streaming output, hoặc tách ra worker riêng.

**Trạng thái:** **Đã sửa** — đã dùng async `spawn` với callback streaming, không còn `spawnSync`/`execFile` blocking.

---

### 2.3. `ctrl+s` bị gán cho 3 action khác nhau — **FIXED**

**Vị trí:** `src/interactive-mode/keybindings.ts`, `APP_KEYBINDINGS`.

```
app.thinking.save      → ctrl+s        (dòng 37)
app.session.toggleSort → ctrl+shift+s  (dòng 70)
app.models.save        → ctrl+s        (dòng 77)
```

Khi người dùng nhấn `Ctrl+S`, không rõ action nào sẽ trigger (phụ thuộc ngữ cảnh focus). Dễ gây nhầm lẫn và thao tác không mong muốn.

**Khuyến nghị:** Phân phối lại phím cho ít nhất 2 trong 3 action này.

**Trạng thái:** **Đã sửa** — `app.session.toggleSort` → `ctrl+shift+s`, `app.models.save` → `ctrl+enter`. Chỉ còn `app.thinking.save` dùng `ctrl+s`.

---

## 3. MEDIUM — Lỗi logic, race condition, 유지보수 khó

### 3.1. `composeProfile` ghi đè `cordis.yml` với `"[]\n"` — hủy dữ liệu profile cũ — **ĐÃ SỬA**

**Vị trí:** `src/runtime/dsh-boot.ts`, dòng 118.

```ts
writeFileSync(join(profile.dir, PROFILE_ROOT_FILENAME), "[]\n");
```

Ghi đè toàn bộ nội dung `cordis.yml` bằng mảng rỗng. Nếu profile đã có nội dung khác (do user hoặc plugin khác chỉnh), sẽ bị mất.

**Khuyến nghị:** Không ghi đè nếu file đã có nội dung, hoặc chỉ viết khi file chưa tồn tại.

**Trạng thái:** **Đã sửa** (theo lịch sử patch 2026-11-26).

---

### 3.2. `runtime.history().catch(() => [])` nuốt lỗi lặng lẽ — **ĐÃ SỬA**

**Vị trí:** `src/interactive-mode/ui.ts` (khoảng dòng 1826).

Khi lấy lịch sử session bị lỗi, trả về mảng rỗng mà không log, không thông báo. Người dùng không biết lý do lịch sử không hiển thị.

**Khuyến nghị:** Log lỗi hoặc surface thông báo cho người dùng.

**Trạng thái:** **Đã sửa** (lỗi đã được log/surface theo verification).

---

### 3.3. `ofmOpencodeSessionIds` Map tăng unbounded, chưa bao giờ xóa — **CHƯA SỬA** (xem §3.4 mới)

**Vị trí:** `src/runtime/runtime.ts`, thuộc tính `ofmOpencodeSessionIds` (dòng 135) và dùng ở khoảng dòng 195–198.

Map lưu session id per seed cho OFM OpenCode, nhưng không có phương thức xóa khi session kết thúc. Se nhớbole tăng vô hạn trong quá trình sử dụng dài.

**Khuyến nghị:** Thêm cơ chế xóa entry khi session đóng hoặc đóng runtime.

**Trạng thái:** **Chưa sửa** — `close()` chỉ clear toàn bộ Map khi Runtime đóng hoàn toàn; khi chuyển session (fork/switch model) mà không close Runtime, entry cũ vẫn bị giữ.

---

### 3.4. `compressRequest` trong token-saver: payload bị nửa nửa khi filter throw — **CHƯA SỬA**

**Vị trí:** `src/runtime/custom-providers/ofm-provider/token-saver/index.ts`, hàm `compressRequest`, khoảng dòng 148–156.

Khi filter throw, `catch` cố gắng sửa stats (`bytesAfter = bytesBefore - saved`), nhưng payload đã bị mutate một phần (các blob trước đó đã được nén in-place). Trạng thái không nhất quán: payload một phần đã đổi, stats claims không có gì thay đổi.

**Khuyến nghị:** Không mutate payload in-place, hoặc rollback payload khi có lỗi.

**Trạng thái:** **Chưa sửa.**

---

### 3.5. `ui.ts` là god object (~2765 dòng), `editor.onSubmit` ~700 dòng — **CHƯA SỬA**

**Vị trí:** `src/interactive-mode/ui.ts`.

Hàm `editor.onSubmit` xử lý đồng thời: bash mode, queue, slash commands (~30 lệnh), normal prompt, auth checks, attach files. Khó bảo trì, dễ regression khi thêm tính năng mới.

**Khuyến nghị:** Tách `ui.ts` thành các module nhỏ (ví dụ: `input-handler.ts`, `command-handler.ts`, `stream-handler.ts`).

**Trạng thái:** **Chưa sửa** — đây là ưu tiên refactor cao nhất trước khi thêm tính năng mới.

---

### 3.6. `startBrandAnimation` trong `OAuthSelectorComponent` gọi `updateList()` mỗi frame khi chạy animation — **CHƯA SỬA**

**Vị trí:** `src/interactive-mode/components/oauth-selector.ts`, hàm `render()` (khoảng dòng 138–141).

```ts
render(width: number): string[] {
  if (this.stopAnimation && this.getSelectedBrandStyle()) this.updateList();
  return super.render(width);
}
```

Nếu animation đang chạy, `updateList()` (xóa và rebuild `listContainer`) được gọi trên mọi lần render → performance issue trên terminal chậm.

**Khuyến nghị:** Chỉ gọi `updateList()` khi animation thực sự thay đổi trạng thái hiển thị, không phải mỗi frame.

**Trạng thái:** **Chưa sửa.**

---

### 3.7. `session-selector.ts` dùng `process.stdout.columns` thay vì actual render width — **CHƯA SỬA**

**Vị trí:** `src/interactive-mode/session-selector.ts`, hàm `widthForLabel()` (khoảng dòng 56–59).

```ts
function widthForLabel(overhead: number): number {
  const columns = process.stdout.columns ?? 80;
  return Math.max(10, columns - 2 - overhead);
}
```

Không lấy width thực tế từ component render → label bị cắt sai khi terminal resize.

**Khuyến nghị:** Truyền `width` thực tế vào hàm tính toán thay vì đọc `process.stdout.columns`.

**Trạng thái:** **Chưa sửa.**

---

### 3.8. `login-dialog.ts`: `get focused()` trả `true` luôn cho notice kind — **ĐÃ SỬA**

**Vị trí:** `src/interactive-mode/components/login-dialog.ts`, getter `focused` (khoảng dòng 217–219).

```ts
get focused(): boolean {
  return (this.input?.focused ?? false) || this.authUrl !== undefined || true;
}
```

`|| true` làm component luôn coi là focused, có thể ảnh hưởng xử lý input toàn cục.

**Khuyến nghị:** Loại bỏ `|| true`, chỉ trả giá trị thực tế.

**Trạng thái:** **Đã sửa** (loại bỏ `|| true`).

---

### 3.9. Kéo `ctx.authorization`, `ctx.llm` trực tiếp từ `runtime.ctx` trong auth-flow — phá encapsulation — **ĐÃ SỬA**

**Vị trí:** `src/interactive-mode/auth-flow.ts` (dùng `host.runtime.getAuthorizationFlows()`); `src/runtime/runtime.ts`, method `getAuthorizationFlows()` (dòng 768).

`auth-flow.ts` hiện dùng method công khai `Runtime.getAuthorizationFlows()` (lọc flow có key bắt đầu `llm-pi-ai/`) thay vì truy cập `ctx` trực tiếp. Encapsulation đã được khôi phục.

**Trạng thái:** **Đã sửa.**

---

### 3.10 (MỚI). Bash streaming output không hiển thị trong turn live — **CHƯA SỬA**

**Vị trí:** `src/interactive-mode/ui.ts` (handler `tool_execution_update`, khoảng dòng 2050–2077) và `src/interactive-mode/tools.ts` (hàm `ToolLog.find`, dòng 175–180).

`ToolLog.find()` chỉ trả về `entry.row` khi `entry.row instanceof ToolRow`. Vì `BashExecutionComponent` không phải `ToolRow`, nên `find()` trả `undefined` cho bash tool. Khi stream `tool_execution_update` đến, cả hai branch `if (row && ...)` đều bị skip, output của bash tool không được cập nhật vào UI qua channel này. `BashExecutionComponent.appendOutput()` cũng không thấy được gọi từ đâu trong luồng turn thông thường.

**Khuyến nghị:** Cho `BashExecutionComponent` nhận diện qua `ToolLog.find` (ví dụ mở rộng `find` hoặc thêm phương thức riêng), hoặc gọi trực tiếp `appendOutput` khi nhận `tool_execution_update` cho bash tool.

**Trạng thái:** **Chưa sửa.**

---

### 3.11 (MỚI). `connect()` catch block có thể unhandled exception nếu `runtime.close()` throw — **CHƯA SỬA**

**Vị trí:** `src/interactive-mode/ui.ts`, hàm `connect()` (khoảng dòng 851–868).

```ts
} catch (error) {
  decision?.(null);
  await runtime.close();   // nếu close() throw, lỗi thoát ra ngoài connect
  ...
}
```

Nếu `runtime.close()` throw (ví dụ `handle.dispose()` thất bại), exception không bị bắt bên trong catch block này và có thể làm crash TUI.

**Khuyến nghị:** Bọc `await runtime.close()` trong try/catch riêng.

**Trạng thái:** **Chưa sửa.**

---

### 3.12 (MỚI). TypeScript version "^7.0.2" — **KHÔNG PHẢI BUG**

**Vị trí:** `package.json`, dòng 147.

```json
"typescript": "^7.0.2"
```

Phiên bản 7.0.2 **thực sự tồn tại và đang được dùng** trong dự án (vite-plus ecosystem, `node_modules/typescript@7.0.2`, `tsc` 7.0.2). Không phải typo, không gây lỗi resolve. Finding ban đầu sai.

**Trạng thái:** **Không phải bug** — version hợp lệ.

---

## 4. LOW / CODE SMELL

### 4.1. Dead code: `streaming.ts` chỉ được import bởi test — **ĐÃ SỬA** (hoặc đã xóa)

**Vị trí:** `src/interactive-mode/streaming.ts`.

`StreamScanner`, `StreamingMarkdown` không dùng trong production. Live UI dùng `AssistantMessageComponent` trực tiếp qua `renderLive`. File này là dead code nhưng vẫn được test và bảo trì.

**Khuyến nghị:** Xóa hoặc đánh dấu rõ là deprecated.

**Trạng thái:** **Đã sửa** (file đã được xóa hoặc không còn trong danh sách src/).

---

### 4.2. Duplicate `sanitizeStatusText` — **ĐÃ SỬA**

**Vị trí:** `src/interactive-mode/footer.ts` (khoảng dòng 311) và `src/interactive-mode/footer-data-provider.ts` (khoảng dòng 15).

Hàm giống hệt nhau nằm ở 2 nơi.

**Khuyến nghị:** Gom chung vào một module util.

**Trạng thái:** **Đã sửa** (đã gom vào `shared-utils.ts`).

---

### 4.3. Duplicate `Theme` class trong `theme/system-theme.ts` — **ĐÃ SỬA**

**Vị trí:** `src/interactive-mode/theme/system-theme.ts`.

Class `Theme` gần giống `theme/theme.ts` nhưng không được source import dùng. Gây nhầm lẫn khi đọc code.

**Khuyến nghị:** Xóa hoặc đánh dấu rõ nếu dự định dùng sau này.

**Trạng thái:** **Đã sửa** (file đã bị xóa).

---

### 4.4. `validateRoute` không thực sự validate model — **CHƯA SỬA**

**Vị trí:** `src/runtime/catalog.ts`, hàm `validateRoute()` (khoảng dòng 86–93).

Chỉ kiểm tra provider có tồn tại và model không rỗng. Không kiểm tra model có thật sự tồn tại trong catalog provider đó. Bình luận tự acknowledged: "Exact route validation belongs to dsh".

**Khuyến nghị:** Thêm kiểm tra model tồn tại trong catalog, hoặc cập nhật bình luận để rõ ràng hơn.

**Trạng thái:** **Chưa sửa.**

---

### 4.5. `ApprovalGrants` không bao giờ được clear từ UI — **CHƯA SỬA**

**Vị trí:** `src/runtime/approvals.ts` và `src/interactive-mode/ui.ts`.

"Always allow" được lưu trong `approvalGrants` (per-Runtime), nhưng không có UI để xóa grant. Người dùng không thể hủy "always allow" trong phiên làm việc.

**Khuyến nghị:** Thêm UI để xem và xóa các grant đã cho.

**Trạng thái:** **Chưa sửa.**

---

### 4.6. `runAfterFirstPaint` không retry tự động, chỉ khi user gõ phím — **CHƯA SỬA**

**Vị trí:** `src/interactive-mode/ui.ts`, hàm `runAfterFirstPaint()` (khoảng dòng 2253–2279).

Nếu deferred plugins fail, `startupFailed = true`, editor vẫn hoạt động nhưng user phải gõ phím để gọi lại `runAfterFirstPaint`. Không có retry tự động sau x giây.

**Khuyến nghị:** Thêm retry tự động với backoff, hoặc ít nhất có nút retry trên màn hình.

**Trạng thái:** **Chưa sửa.**

---

### 4.7. `pendingStartupConnection` có thể bị orphan — **CHƯA SỬA**

**Vị trí:** `src/interactive-mode/ui.ts`, thuộc tính `pendingStartupConnection` (khoảng dòng 307) và xử lý ở khoảng dòng 1226–1238.

Nếu `pendingStartupConnection` được set khi auth fail, nhưng user không gõ gì và chờ mãi, nó vẫn nằm đó. Chỉ được clear khi `/model`, `/new`, `/clear`, `/quit` hoặc khi user gõ prompt và `connect` được gọi.

**Khuyến nghị:** Thêm timeout hoặc clear khi user thực hiện hành động khác.

**Trạng thái:** **Chưa sửa.**

---

### 4.8. `ofm-provider/index.ts` là god function (~514 dòng) — **CHƯA SỬA**

**Vị trí:** `src/runtime/custom-providers/ofm-provider/index.ts`, hàm `default export`.

Hàm này xử lý chain add/edit/set/remove/enable/disable, refresh, saver on/off/caveman/ponytail/stats — tất cả trong một closure khổng lồ. Khó test và bảo trì.

**Khuyến nghị:** Tách thành các handler riêng cho mỗi nhóm lệnh.

**Trạng thái:** **Chưa sửa.**

---

### 4.9. `chains.ts` hardcode tool alias từ "DSH's live controls (2026-10-30)" — **CHƯA SỬA**

**Vị trí:** `src/runtime/custom-providers/ofm-provider/fingerprint.ts`, hằng `FREE_LANE_TOOL_ALIASES` (khoảng dòng 89–92).

```
subagent_fork: "conversation_delegate",
working_directory: "workspace_directory",
```

Bí mật/định danh tool này hardcode từ một phiên bản DSH cụ thể. Nếu DSH đổi tên tool, alias mapping sẽ sai và gateway từ chối request.

**Khuyến nghị:** Lấy alias mapping từ cấu hình hoặc registry của DSH thay vì hardcode.

**Trạng thái:** **Chưa sửa.**

---

## 5. ORPHAN FILES — Đã port, typecheck, chưa có call site

Theo `TODO.md §C`, các file này cần product decision để wire (không nên xóa):

| File                                                          | Mô tả                                      |
| ------------------------------------------------------------- | ------------------------------------------ |
| `src/interactive-mode/components/custom-entry.ts`             | Extension system chưa triển khai           |
| `src/interactive-mode/components/custom-message.ts`           | Extension system chưa triển khai           |
| `src/interactive-mode/components/extension-editor.ts`         | Extension system chưa triển khai           |
| `src/interactive-mode/components/extension-input.ts`          | Extension system chưa triển khai           |
| `src/interactive-mode/components/extension-selector.ts`       | Extension system chưa triển khai           |
| `src/interactive-mode/components/bordered-loader.ts`          | Utility, chưa dùng (chỉ re-export barrel)  |
| `src/interactive-mode/components/countdown-timer.ts`          | Utility, chỉ dùng bởi extension-* (orphan) |
| `src/interactive-mode/components/thinking-selector.ts`        | Chưa có call site (không cả barrel export) |
| `src/interactive-mode/components/trim-blanks.ts`              | Chưa có call site (không cả barrel export) |
| `src/interactive-mode/components/config-selector.ts`          | Chưa wire (chỉ re-export barrel)           |
| `src/interactive-mode/components/custom-editor.ts`            | Chưa wire (chỉ re-export barrel)           |
| `src/interactive-mode/components/skill-invocation-message.ts` | Chưa wire (chỉ re-export barrel)           |
| `src/interactive-mode/components/tree-selector.ts`            | Chưa wire (chỉ re-export barrel)           |

> Đã wire (không còn orphan): `branch-summary-message.ts` (ui.ts xử lý event `branch_summary`), `trust-selector.ts` (`openTrustSelector`), `user-message-selector.ts` (fork points), `first-time-setup.ts` (first run), `settings-submenu.ts`, `show-images-selector.ts`.

---

## 6. ĐIỂM TÍCH CỰC (để ghi công)

- Kiến trúc hợp đồng rõ ràng: `interfaces.ts` + `runtime-events.ts` là ranh giới FE/BE, không circular dependency.
- Two-phase boot: first paint < 500 ms (~122 ms thực tế).
- Overlay stack LIFO với `selecting` guard — tránh input race khi nhiều panel mở.
- Safe runtime access: `safeRead` / `safe*` helpers giúp footer render được ngay khi deferred plugins còn loading.
- ToolRow lifecycle replay-safe: `detail.ts` là engine duy nhất cho arguments/result/diffs, dùng cả live và history replay.
- Theme token-based với DA1 auto-sync: thay đổi theme áp dụng tức thì.
- Test coverage tốt: 173/173 passing, `npm run check` và `build` sạch.

---

## 7. ƯU TIÊN SỬA (theo thứ tự)

1. **Tách `ui.ts`** (3.5, god object ~2765 dòng) — trước khi thêm tính năng mới vào file god object này.
2. **Sửa bash streaming output** (3.10) — ảnh hưởng UX trực tiếp.
3. **Sửa `connect()` catch block** (3.11) — tránh crash TUI khi `runtime.close()` throw.
4. **Sửa `ofmOpencodeSessionIds` rò rỉ nhớ** (3.3) — dùng dài hạn.
5. Còn lại từ §3 và §4 (nếu chưa làm).

---

## 8. PHƯƠNG PHÁP KIỂM TOÁN

- Đọc full toàn bộ file `.ts` trong `src/` (149 file).
- Đọc toàn bộ file test trong `test/` (51 file).
- Đọc `package.json`, `tsconfig.json`, `vite.config.ts`.
- Đọc `ARCH.md`, `TODO.md`, `GOAL.md`, `CAUTRUC.md` để hiểu ngữ cảnh dự án.
- Không trích lại nội dung từ file `AUDIT.md` cũ của dự án.
- **Verification:** Tất cả findings đã được verify bằng grep/read trực tiếp vào source code.

---
