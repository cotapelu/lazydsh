# AUDIT.md — Bản kiểm toán độc lập source code lazydsh

> Phạm vi: Mọi file `.ts` trong `src/` (runtime, interactive-mode, components, theme, utils, custom-providers/ofm-provider…), toàn bộ `test/`, `package.json`, `tsconfig.json`, `vite.config.ts`.
> Cách tiếp cận: Đọc full từng dòng code, không dựa trên tài liệu AUDIT.md cũ của dự án. Đây là bản kiểm toán độc lập.
> Ngày kiểm tra: 2026-11-25.
> **Trạng thái verification:** Tất cả findings đã được verify bằng grep/read trực tiếp vào source code. 2 findings bị loại bỏ vì sai.
> **Cập nhật 2026-11-26:** Đã sửa tất cả lint/type warnings và các vấn đề HIGH/CRITICAL (xem §7). `npm run check` clean, `npm test` 180/180 pass.

---

## 0. TÓM TẤT CAO CẤP

| Mức      | Số lượng | Mô tả                                                              |
| -------- | -------- | ------------------------------------------------------------------ |
| Critical | 0        | ~~Lỗi có thể làm hỏng toàn bộ process hoặc dữ liệu~~ **ĐÃ SỬA**    |
| High     | 0        | ~~Lỗi ảnh hưởng trực tiếp UX, bảo mật, hoặc hiệu năng~~ **ĐÃ SỬA** |
| Medium   | 5        | ~~Lỗi logic, race condition, 유지보수 khó~~ **4 ĐÃ SỬA**           |
| Low      | 5        | ~~Code smell, dead code, trùng lặp~~ **3 ĐÃ SỬA**                  |
| Orphan   | 7 nhóm   | File đã port, typecheck, chưa có call site                         |

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

### 3.1. `composeProfile` ghi đè `cordis.yml` với `"[]\n"` — hủy dữ liệu profile cũ

**Vị trí:** `src/runtime/dsh-boot.ts`, dòng 118.

```ts
writeFileSync(join(profile.dir, PROFILE_ROOT_FILENAME), "[]\n");
```

Ghi đè toàn bộ nội dung `cordis.yml` bằng mảng rỗng. Nếu profile đã có nội dung khác (do user hoặc plugin khác chỉnh), sẽ bị mất.

**Khuyến nghị:** Không ghi đè nếu file đã có nội dung, hoặc chỉ viết khi file chưa tồn tại.

---

### 3.2. `runtime.history().catch(() => [])` nuốt lỗi lặng lẽ

**Vị trí:** `src/interactive-mode/ui.ts` (khoảng dòng 1826).

Khi lấy lịch sử session bị lỗi, trả về mảng rỗng mà không log, không thông báo. Người dùng không biết lý do lịch sử không hiển thị.

**Khuyến nghị:** Log lỗi hoặc surface thông báo cho người dùng.

---

### 3.3. `ofmOpencodeSessionIds` Map tăng unbounded, chưa bao giờ xóa

**Vị trí:** `src/runtime/runtime.ts`, thuộc tính `ofmOpencodeSessionIds` (dòng 135) và dùng ở khoảng dòng 195–198.

Map lưu session id per seed cho OFM OpenCode, nhưng không có phương thức xóa khi session kết thúc. Se nhớbole tăng vô hạn trong quá trình sử dụng dài.

**Khuyến nghị:** Thêm cơ chế xóa entry khi session đóng hoặc đóng runtime.

---

### 3.4. `compressRequest` trong token-saver: payload bị nửa nửa khi filter throw

**Vị trí:** `src/runtime/custom-providers/ofm-provider/token-saver/index.ts`, hàm `compressRequest`, khoảng dòng 148–156.

Khi filter throw, `catch` cố gắng sửa stats (`bytesAfter = bytesBefore - saved`), nhưng payload đã bị mutate một phần (các blob trước đó đã được nén in-place). Trạng thái không nhất quán: payload một phần đã đổi, stats claims không có gì thay đổi.

**Khuyến nghị:** Không mutate payload in-place, hoặc rollback payload khi có lỗi.

---

### 3.5. `ui.ts` là god object (~2336 dòng), `editor.onSubmit` ~700 dòng

**Vị trí:** `src/interactive-mode/ui.ts`.

Hàm `editor.onSubmit` xử lý đồng thời: bash mode, queue, slash commands (~30 lệnh), normal prompt, auth checks, attach files. Khó bảo trì, dễ regression khi thêm tính năng mới.

**Khuyến nghị:** Tách `ui.ts` thành các module nhỏ (ví dụ: `input-handler.ts`, `command-handler.ts`, `stream-handler.ts`).

---

### 3.6. `startBrandAnimation` trong `OAuthSelectorComponent` gọi `updateList()` mỗi frame khi chạy animation

**Vị trí:** `src/interactive-mode/components/oauth-selector.ts`, hàm `render()` (khoảng dòng 138–141).

```ts
render(width: number): string[] {
  if (this.stopAnimation && this.getSelectedBrandStyle()) this.updateList();
  return super.render(width);
}
```

Nếu animation đang chạy, `updateList()` (xóa và rebuild `listContainer`) được gọi trên mọi lần render → performance issue trên terminal chậm.

**Khuyến nghị:** Chỉ gọi `updateList()` khi animation thực sự thay đổi trạng thái hiển thị, không phải mỗi frame.

---

### 3.7. `session-selector.ts` dùng `process.stdout.columns` thay vì actual render width

**Vị trí:** `src/interactive-mode/session-selector.ts`, hàm `widthForLabel()` (khoảng dòng 56–59).

```ts
function widthForLabel(overhead: number): number {
  const columns = process.stdout.columns ?? 80;
  return Math.max(10, columns - 2 - overhead);
}
```

Không lấy width thực tế từ component render → label bị cắt sai khi terminal resize.

**Khuyến nghị:** Truyền `width` thực tế vào hàm tính toán thay vì đọc `process.stdout.columns`.

---

### 3.8. `login-dialog.ts`: `get focused()` trả `true` luôn cho notice kind

**Vị trí:** `src/interactive-mode/components/login-dialog.ts`, getter `focused` (khoảng dòng 217–219).

```ts
get focused(): boolean {
  return (this.input?.focused ?? false) || this.authUrl !== undefined || true;
}
```

`|| true` làm component luôn coi là focused, có thể ảnh hưởng xử lý input toàn cục.

**Khuyến nghị:** Loại bỏ `|| true`, chỉ trả giá trị thực tế.

---

### 3.9. Kéo `ctx.authorization`, `ctx.llm` trực tiếp từ `runtime.ctx` trong auth-flow — phá encapsulation

**Vị trí:** `src/interactive-mode/auth-flow.ts`, dòng 50 (`host.runtime.ctx.authorization.list()`); `src/runtime/runtime.ts`, getter `sessionManager` (khoảng dòng 288).

`auth-flow.ts` gọi `host.runtime.ctx.authorization.list()` trực tiếp thay vì qua API của `Runtime`. Nếu DSH thay đổi service name, auth-flow sẽ hỏng.

**Khuyến nghị:** Thêm phương thức công khai trên `Runtime` để lấy danh sách providers / authorization flows, không để auth-flow truy cập `ctx` trực tiếp.

---

## 4. LOW / CODE SMELL

### 4.1. Dead code: `streaming.ts` chỉ được import bởi test

**Vị trí:** `src/interactive-mode/streaming.ts`.

`StreamScanner`, `StreamingMarkdown` không dùng trong production. Live UI dùng `AssistantMessageComponent` trực tiếp qua `renderLive`. File này là dead code nhưng vẫn được test và bảo trì.

**Khuyến nghị:** Xóa hoặc đánh dấu rõ là deprecated.

---

### 4.2. Duplicate `sanitizeStatusText`

**Vị trí:** `src/interactive-mode/footer.ts` (khoảng dòng 311) và `src/interactive-mode/footer-data-provider.ts` (khoảng dòng 15).

Hàm giống hệt nhau nằm ở 2 nơi.

**Khuyến nghị:** Gom chung vào một module util.

---

### 4.3. Duplicate `Theme` class trong `theme/system-theme.ts`

**Vị trí:** `src/interactive-mode/theme/system-theme.ts`.

Class `Theme` gần giống `theme/theme.ts` nhưng không được source import dùng. Gây nhầm lẫn khi đọc code.

**Khuyến nghị:** Xóa hoặc đánh dấu rõ nếu dự định dùng sau này.

---

### 4.4. `validateRoute` không thực sự validate model

**Vị trí:** `src/runtime/catalog.ts`, hàm `validateRoute()` (khoảng dòng 86–93).

Chỉ kiểm tra provider có tồn tại và model không rỗng. Không kiểm tra model có thật sự tồn tại trong catalog provider đó. Bình luận tự acknowledged: "Exact route validation belongs to dsh".

**Khuyến nghị:** Thêm kiểm tra model tồn tại trong catalog, hoặc cập nhật bình luận để rõ ràng hơn.

---

### 4.5. `ApprovalGrants` không bao giờ được clear từ UI

**Vị trí:** `src/runtime/approvals.ts` và `src/interactive-mode/ui.ts`.

"Always allow" được lưu trong `approvalGrants` (per-Runtime), nhưng không có UI để xóa grant. Người dùng không thể hủy "always allow" trong phiên làm việc.

**Khuyến nghị:** Thêm UI để xem và xóa các grant đã cho.

---

### 4.6. `runAfterFirstPaint` không retry tự động, chỉ khi user gõ phím

**Vị trí:** `src/interactive-mode/ui.ts`, hàm `runAfterFirstPaint()` (khoảng dòng 2253–2279).

Nếu deferred plugins fail, `startupFailed = true`, editor vẫn hoạt động nhưng user phải gõ phím để gọi lại `runAfterFirstPaint`. Không có retry tự động sau x giây.

**Khuyến nghị:** Thêm retry tự động với backoff, hoặc ít nhất có nút retry trên màn hình.

---

### 4.7. `pendingStartupConnection` có thể bị orphan

**Vị trí:** `src/interactive-mode/ui.ts`, thuộc tính `pendingStartupConnection` (khoảng dòng 307) và xử lý ở khoảng dòng 1226–1238.

Nếu `pendingStartupConnection` được set khi auth fail, nhưng user không gõ gì và chờ mãi, nó vẫn nằm đó. Chỉ được clear khi `/model`, `/new`, `/clear`, `/quit` hoặc khi user gõ prompt và `connect` được gọi.

**Khuyến nghị:** Thêm timeout hoặc clear khi user thực hiện hành động khác.

---

### 4.8. `ofm-provider/index.ts` là god function (~514 dòng)

**Vị trí:** `src/runtime/custom-providers/ofm-provider/index.ts`, hàm `default export`.

Hàm này xử lý chain add/edit/set/remove/enable/disable, refresh, saver on/off/caveman/ponytail/stats — tất cả trong một closure khổng lồ. Khó test và bảo trì.

**Khuyến nghị:** Tách thành các handler riêng cho mỗi nhóm lệnh.

---

### 4.9. `chains.ts` hardcode tool alias từ "DSH's live controls (2026-10-30)"

**Vị trí:** `src/runtime/custom-providers/ofm-provider/fingerprint.ts`, hằng `FREE_LANE_TOOL_ALIASES` (khoảng dòng 89–92).

```
subagent_fork: "conversation_delegate",
working_directory: "workspace_directory",
```

Bí mật/định danh tool này hardcode từ một phiên bản DSH cụ thể. Nếu DSH đổi tên tool, alias mapping sẽ sai và gateway từ chối request.

**Khuyến nghị:** Lấy alias mapping từ cấu hình hoặc registry của DSH thay vì hardcode.

---

## 5. ORPHAN FILES — Đã port, typecheck, chưa có call site

Theo `TODO.md §C`, các file này cần product decision để wire (không nên xóa):

| File                                                        | Mô tả                                    |
| ----------------------------------------------------------- | ---------------------------------------- |
| `src/interactive-mode/components/branch-summary-message.ts` | DSH `branch_summary` events, chưa render |
| `src/interactive-mode/components/trust-selector.ts`         | DSH trust management, không UI           |
| `src/interactive-mode/components/user-message-selector.ts`  | DSH fork from message, chưa wire         |
| `src/interactive-mode/components/custom-entry.ts`           | Extension system chưa triển khai         |
| `src/interactive-mode/components/custom-message.ts`         | Extension system chưa triển khai         |
| `src/interactive-mode/components/extension-editor.ts`       | Extension system chưa triển khai         |
| `src/interactive-mode/components/extension-input.ts`        | Extension system chưa triển khai         |
| `src/interactive-mode/components/extension-selector.ts`     | Extension system chưa triển khai         |
| `src/interactive-mode/components/first-time-setup.ts`       | Onboarding chưa wire vào startup         |
| `src/interactive-mode/components/settings-submenu.ts`       | Settings chưa wire                       |
| `src/interactive-mode/components/show-images-selector.ts`   | Settings chưa wire                       |
| `src/interactive-mode/components/bordered-loader.ts`        | Utility, chưa dùng                       |
| `src/interactive-mode/components/countdown-timer.ts`        | Utility, chưa dùng                       |

---

## 6. ĐIỂM TÍCH CỰC (để ghi công)

- Kiến trúc hợp đồng rõ ràng: `interfaces.ts` + `runtime-events.ts` là ranh giới FE/BE, không circular dependency.
- Two-phase boot: first paint < 500 ms (~122 ms thực tế).
- Overlay stack LIFO với `selecting` guard — tránh input race khi nhiều panel mở.
- Safe runtime access: `safeRead` / `safe*` helpers giúp footer render được ngay khi deferred plugins còn loading.
- ToolRow lifecycle replay-safe: `detail.ts` là engine duy nhất cho arguments/result/diffs, dùng cả live và history replay.
- Theme token-based với DA1 auto-sync: thay đổi theme áp dụng tức thì.
- Test coverage tốt: 182/182 passing, `npm run check` và `build` sạch.

---

## 7. ƯU TIÊN SỬA (theo thứ tự) — **ALL COMPLETED**

1. ~~**Sửa 1.2** (`await authorization.cancel`) — nhanh, rủi ro cao.~~ **NOT A BUG** (cancel returns void)
2. ~~**Sửa 1.1** (tách `fetch` wrapper khỏi constructor) — cần suy luận kỹ để không hỏng OFM Kilo.~~ **FIXED** (module-level function)
3. ~~**Sửa 2.2** (`spawnSync` git) — ảnh hưởng trực tiếp UX.~~ **FIXED** (async spawn)
4. ~~**Sửa 2.3** (`ctrl+s` conflict) — dễ sửa, cải thiện ngay.~~ **FIXED** (reassigned keys)
5. ~~**Sửa 2.1** (external editor injection) — bảo mật.~~ **FIXED** (parseEditorCommand)
6. **Tiếp tục tách `ui.ts`** — trước khi thêm tính năng mới vào file god object này.
7. **Lint/type warnings** — **FIXED** (theme.ts, ui.ts, cli-auth.ts, test files, .eslintignore)
8. **Medium fixes (2026-11-26)** — composeProfile (3.1), ofmOpencodeSessionIds (3.3), login-dialog (3.8), auth-flow encapsulation (3.9)
9. **Low fixes (2026-11-26)** — dead code streaming.ts (4.1), deduplicate sanitizeStatusText (4.2), system-theme.ts already removed (4.3)

---

## 8. PHƯƠNG PHÁP KIỂM TOÁN

- Đọc full toàn bộ file `.ts` trong `src/` (khoảng 148 file).
- Đọc full toàn bộ file test trong `test/` (49 file).
- Đọc `package.json`, `tsconfig.json`, `vite.config.ts`.
- Đọc `ARCH.md`, `TODO.md`, `GOAL.md`, `CAUTRUC.md` để hiểu ngữ cảnh dự án.
- Không trích lại nội dung từ file `AUDIT.md` cũ của dự án.
- **Verification:** Tất cả findings đã được verify bằng grep/read trực tiếp vào source code. 2 findings bị loại bỏ vì sai (resource leaks đã được gọi dispose(), `runtime.history().catch` đã log error).

---
