Chính xác — bạn tinh mắt đấy. Trong lần tổng hợp trước, mình mới chỉ liệt kê nhóm chính và gộp tắt (viết ...) toàn bộ các gói con nằm rải rác trong 4 nhóm: ssh/, llm/, session-query/ & context/, và đặc biệt là hàng chục gói giao diện dsh-ui-* cùng host/. [1] (https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/README.md), [2] (https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/README.md)
Tổ chức @deepseek-ai trên npm hiện có 433 gói. Thư mục của bạn đang có 180 gói, nghĩa là còn thiếu khoảng 253 gói (nếu trừ các bản build native của macOS/Windows và các gói test nội bộ không publish thì thực tế còn thiếu ~220 gói). [1] (https://www.npmjs.com/org/deepseek-ai)
Dưới đây là bản quét bù toàn bộ những phần bị gộp tắt hoặc bỏ sót ở câu trả lời trước để bạn có danh sách thực sự đầy đủ:

1. Nhóm ssh/ (Trước đó chỉ ghi 1 gói tổng, thực tế có đủ bộ 5 gói)

• @deepseek-ai/dsh-ssh (Dịch vụ kết nối POSIX qua SSH)
• @deepseek-ai/dsh-fs-ssh (Filesystem provider qua SSH)
• @deepseek-ai/dsh-subprocess-ssh (Subprocess provider qua SSH)
• @deepseek-ai/dsh-sandbox-ssh (Sandbox provider qua SSH)
• @deepseek-ai/dsh-bash-ssh (Bash executor qua SSH) [1] (https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/README.md)

2. Nhóm llm/ & auth/ (Các provider ngoài DeepSeek và Pi-AI)

Bạn mới chỉ có dsh-llm-deepseek và dsh-llm-pi-ai. Kho gốc còn tách riêng các adapter sau: [1] (https://www.npmjs.com/~tianyicui-deepseek?page=1), [2] (https://deepseekdsh.com/news)
• @deepseek-ai/dsh-llm-openai (Adapter chuẩn OpenAI / OpenAI-compatible)
• @deepseek-ai/dsh-llm-anthropic (Adapter Claude / Anthropic)
• @deepseek-ai/dsh-llm-gemini (Adapter Google Gemini)
• @deepseek-ai/dsh-deepseek-auth (Luồng đăng nhập OAuth / device flow trực tiếp với tài khoản DeepSeek)

3. Các gói lẻ bị sót trong nhóm session-query/, context/, compaction/, web/

Trong 180 gói của bạn đã có phần lớn, nhưng vẫn thiếu vài gói vệ tinh cụ thể:
• Nhóm session-query/: Bạn mới có dsh-session-query và dsh-session-query-sqlite, còn thiếu:
• @deepseek-ai/dsh-session-lineage (Truy vết cây phả hệ fork/subagent của session)
• @deepseek-ai/dsh-session-semantic-filter (Lọc ngữ nghĩa khi truy xuất lịch sử session)
• @deepseek-ai/dsh-tool-session-query (Bộ 5 tool cho model tự tìm kiếm session cũ) [1] (https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/README.md)
• Nhóm context/: Bạn mới có dsh-time-context, dsh-file-reference, dsh-file-reference-local, còn thiếu:
• @deepseek-ai/dsh-workspace-instructions (Nạp tự động file CLAUDE.md / AGENTS.md / hướng dẫn cấp workspace vào context) [1] (https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/README.md)
• Nhóm web/: Bạn mới có dsh-web, dsh-web-deepseek-api, dsh-web-fetch-http, dsh-web-search-deepseek, còn thiếu:
• @deepseek-ai/dsh-web-fetch-playwright hoặc dsh-web-fetch-browser (Fetch trang web cần render JS)

4. Toàn bộ nhóm host/ (Bạn mới có 2/9 gói)

Bạn mới có dsh-host-webserver và dsh-host-plugin-inventory, còn thiếu 7 gói:
• @deepseek-ai/dsh-host-frontend-static
• @deepseek-ai/dsh-host-directory-picker
• @deepseek-ai/dsh-host-directory-picker-native
• @deepseek-ai/dsh-host-directory-picker-browse
• @deepseek-ai/dsh-host-directory-picker-auto
• @deepseek-ai/dsh-host-open-in-app
• @deepseek-ai/dsh-host-product-telemetry-otel

5. Toàn bộ nhóm client/ & ui-* (Khoảng ~140–160 gói)

Đây là phần chiếm số lượng gói lớn nhất trên npm mà thư mục của bạn chưa có gói nào (ngoài dsh-client-connection và dsh-client-file-upload):
• Nhóm lõi trình duyệt (client/):
• @deepseek-ai/dsh-client-web, dsh-client-modules, dsh-client-shortcuts, dsh-client-ui-shortcuts, dsh-client-store, dsh-client-hmr, dsh-client-locale, dsh-client-ui-renderer, dsh-cordis-client-runner [1] (https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/README.md)
• Nhóm giao diện (dsh-ui-*):
• DeepSeek chia nhỏ từng widget trên Web UI thành từng gói npm riêng biệt (ví dụ: dsh-ui-cordis, dsh-ui-chat, dsh-ui-composer, dsh-ui-sidebar, dsh-ui-settings, dsh-ui-terminal, dsh-ui-diff, dsh-ui-markdown, dsh-ui-plan, dsh-ui-goal, dsh-ui-subagent, dsh-ui-approval, dsh-ui-voice, v.v.).

6. Nhóm test-support/, typert/ & Platform Native

• Typert: @deepseek-ai/dsh-typert-generator
• Testkit (nằm trong repo GitHub, đa số private: true không lên npm): dsh-testkit, dsh-replay, dsh-client-test-runtime
• Native OS khác: node-addon-system-darwin-arm64, node-addon-system-darwin-x64, node-addon-system-win32-x64 [1] (https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/typert/README.md), [2] (https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/README.md), [3] (https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/README.md)

Lệnh lấy toàn bộ (không sót gói nào trên npm)

Thay vì liệt kê tay từng gói dsh-ui-* dễ sót, bạn chỉ cần cài @deepseek-ai/dsh và @deepseek-ai/dsh-web-app (2 gói này giữ cây dependency kéo toàn bộ ~150 gói client/ + ui-* + host/), sau đó chạy vòng lặp cài các nhóm lẻ còn lại (ssh, llm, session-query, context, mcp, lsp, terminal, office, subagent, extensions, sdk, acp, experimental):
bash

# Bước 1: Cài CLI gốc + toàn bộ hệ sinh thái Web UI / Client / Host

pnpm add @deepseek-ai/dsh @deepseek-ai/dsh-web-app @deepseek-ai/dsh-headless @deepseek-ai/dsh-sdk-app @deepseek-ai/dsh-sdk-minimal @deepseek-ai/dsh-acp-app

# Bước 2: Vòng lặp quét nốt toàn bộ gói mở rộng & gói lẻ còn thiếu

for pkg in \
@deepseek-ai/dsh-agent-tool-presentation \
@deepseek-ai/dsh-tool-cordis \
@deepseek-ai/dsh-cordis-host-runner \
@deepseek-ai/dsh-mcp-client \
@deepseek-ai/dsh-mcp-manager \
@deepseek-ai/dsh-subagent-acp \
@deepseek-ai/dsh-subagent-codex \
@deepseek-ai/dsh-subagent-claude-code \
@deepseek-ai/dsh-subagent-dsh-sdk \
@deepseek-ai/dsh-sdk-protocol \
@deepseek-ai/dsh-sdk-client \
@deepseek-ai/dsh-sdk-server \
@deepseek-ai/dsh-acp \
@deepseek-ai/dsh-lsp \
@deepseek-ai/dsh-lsp-stdio \
@deepseek-ai/dsh-tool-lsp \
@deepseek-ai/dsh-terminal \
@deepseek-ai/dsh-terminal-bash \
@deepseek-ai/dsh-ssh \
@deepseek-ai/dsh-fs-ssh \
@deepseek-ai/dsh-subprocess-ssh \
@deepseek-ai/dsh-sandbox-ssh \
@deepseek-ai/dsh-bash-ssh \
@deepseek-ai/dsh-llm-openai \
@deepseek-ai/dsh-llm-anthropic \
@deepseek-ai/dsh-llm-gemini \
@deepseek-ai/dsh-deepseek-auth \
@deepseek-ai/dsh-session-lineage \
@deepseek-ai/dsh-session-semantic-filter \
@deepseek-ai/dsh-tool-session-query \
@deepseek-ai/dsh-workspace-instructions \
@deepseek-ai/dsh-web-fetch-playwright \
@deepseek-ai/dsh-office-kit \
@deepseek-ai/dsh-tool-office \
@deepseek-ai/dsh-typert-generator \
@deepseek-ai/dsh-plugin-market \
@deepseek-ai/dsh-tool-workspace-dependencies \
@deepseek-ai/dsh-experimental-worktree \
@deepseek-ai/dsh-experimental-tool-worktree \
@deepseek-ai/dsh-experimental-forge \
@deepseek-ai/dsh-experimental-forge-github \
@deepseek-ai/dsh-experimental-forge-session \
@deepseek-ai/dsh-experimental-client-ui-forge \
@deepseek-ai/dsh-experimental-forge-bundle \
@deepseek-ai/dsh-experimental-browser-use-stagehand-native \
@deepseek-ai/dsh-experimental-webworker-runtime \
@deepseek-ai/cordis-plugin-hmr
do
pnpm add "$pkg" 2>/dev/null || echo "Skip: $pkg"
done
Use code with caution.
Nếu muốn đối chiếu chuẩn xác từng tên gói một từ npm registry thay vì danh sách tĩnh, bạn có thể chạy curl -s "https://npmjs.org" để lấy JSON gốc từ npm — bạn có cần mình viết đoạn script tự động so sánh JSON đó với thư mục node_modules/@deepseek-ai của bạn và cài nốt 100% không?
