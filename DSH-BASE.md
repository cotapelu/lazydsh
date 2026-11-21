Gói @deepseek-ai/dsh-base định nghĩa tổng cộng 101 plugin/service rows (tương ứng với 100 gói con độc lập, vì gói @deepseek-ai/dsh-tool-subagent được mount 2 lần cho subagent và subagent_fork) trong tệp cấu hình lõi cordis.patch.yml của DeepSeek Harness.
Trong tổng số 101 rows này:
• 90 rows bật mặc định trên mọi nền tảng.
• 4 rows bật theo hệ điều hành (2 cho Linux/macOS và 2 cho Windows).
• 4 rows bật có điều kiện (khi chạy kèm profileContext).
• 3 rows tắt mặc định (disabled: true), đóng vai trò giữ chỗ cho các lớp profile phía trên ghi đè.
Dưới đây là danh sách toàn bộ 101 rows được phân nhóm theo chức năng:

1. Lõi hệ thống, Quản lý Plugin & API Gateway (13 rows)

• plugin-manager (@deepseek-ai/dsh-plugin-manager) — Quản lý cài đặt/gỡ plugin (bật khi có profileContext).
• tool-plugin-manager (@deepseek-ai/dsh-plugin-manager/tools) — Tool cho phép agent tự quản lý plugin (tắt mặc định).
• plugin-package-inventory-deepseek (@deepseek-ai/dsh-plugin-package-inventory-deepseek) — Danh mục kho gói plugin chính thức của DeepSeek.
• timer (@deepseek-ai/cordis-plugin-timer) — Bộ định thời gian cho hệ thống Cordis.
• hmr (@deepseek-ai/dsh-hmr) — Hot Module Replacement tự động nạp lại cấu hình (bật khi có profileContext).
• config-editor (@deepseek-ai/dsh-config-editor) — Trình chỉnh sửa cấu hình trực tiếp (bật khi có profileContext).
• settings (@deepseek-ai/dsh-settings) — Quản lý tệp cài đặt người dùng (bật khi có profileContext).
• typert (@deepseek-ai/dsh-typert-registry) — Registry định kiểu RPC/API nội bộ.
• typert-loader (@deepseek-ai/dsh-typert-loader) — Trình nạp các service Typert.
• typert-gateway (@deepseek-ai/dsh-api-gateway) — Cổng giao tiếp API giữa các tiến trình/client.
• remote-access (@deepseek-ai/dsh-api-remote-access) — Kiểm soát phân quyền truy cập từ xa cho các peer không phải chủ sở hữu.
• jobs (@deepseek-ai/dsh-jobs-local) — Quản lý các tác vụ chạy ngầm cục bộ.
• subprocess (@deepseek-ai/dsh-subprocess-local) — Quản lý tiến trình con (child processes).

2. Mô hình LLM, Xác thực & Thông tin đăng nhập (11 rows)

• llm (@deepseek-ai/dsh-llm) — Lớp trừu tượng điều phối các mô hình ngôn ngữ.
• llm-retry (@deepseek-ai/dsh-llm-retry) — Cơ chế tự động thử lại khi gọi API mô hình gặp lỗi mạng/rate-limit.
• agent-default-model (@deepseek-ai/dsh-agent-default-model) — Thiết lập mô hình mặc định (mặc định: deepseek-official / deepseek-flash).
• llm-deepseek (@deepseek-ai/dsh-llm-deepseek-api-key) — Adapter kết nối DeepSeek thông qua API Key.
• llm-deepseek-account (@deepseek-ai/dsh-llm-deepseek-account) — Adapter kết nối DeepSeek thông qua tài khoản đăng nhập.
• deepseek-llm-api-extensions (@deepseek-ai/dsh-deepseek-llm-api-extensions) — Các phần mở rộng giao thức riêng của API DeepSeek.
• llm-pi-ai (@deepseek-ai/dsh-llm-pi-ai) — Adapter đa nhà cung cấp (OpenAI, Anthropic, Bedrock, Vertex, Azure...) ở trạng thái chờ kích hoạt qua settings.
• authorization (@deepseek-ai/dsh-authorization) — Quản lý phiên ủy quyền.
• deepseek-account (@deepseek-ai/dsh-deepseek-account) — Quản lý trạng thái tài khoản DeepSeek.
• deepseek-auth (@deepseek-ai/dsh-deepseek-auth) — Dịch vụ cung cấp token/key xác thực cho mỗi request.
• credentials (@deepseek-ai/dsh-credentials-local) — Lưu trữ khóa bảo mật tại $DSH_HOME/.credentials.yaml và biến môi trường.

3. Vòng lặp Agent, Ngữ cảnh & Tối ưu bộ nhớ (12 rows)

• agent (@deepseek-ai/dsh-agent) — Thực thể cốt lõi của một Agent.
• agent-loop (@deepseek-ai/dsh-agent-loop) — Vòng lặp thực thi suy luận và gọi công cụ của Agent.
• system-prompt (@deepseek-ai/dsh-system-prompt) — Trình lắp ráp System Prompt động từ các plugin.
• agent-instructions (@deepseek-ai/dsh-agent-instructions) — Đọc các tệp hướng dẫn trong workspace (tối đa 64KB).
• user-questions (@deepseek-ai/dsh-user-questions) — Xử lý tương tác hỏi đáp ngược lại người dùng (ask_user_question).
• plan-mode (@deepseek-ai/dsh-plan-mode) — Chế độ lập kế hoạch chỉ đọc trước khi thực thi thay đổi.
• token-meter (@deepseek-ai/dsh-token-meter) — Đo lường và theo dõi lượng token tiêu thụ.
• compaction-basic (@deepseek-ai/dsh-compaction-basic) — Tự động nén lịch sử hội thoại khi chạm ngưỡng ngữ cảnh.
• tool-result-pruner (@deepseek-ai/dsh-compaction-tool-result-pruner) — Cắt gọn kết quả trả về từ tool nếu vượt quá 8.192 ký tự.
• image-offload (@deepseek-ai/dsh-compaction-image-offload) — Thay thế ảnh cũ bằng placeholder khi vượt quá giới hạn ảnh của mô hình.
• spill-local (@deepseek-ai/dsh-spill-local) — Lưu tạm dữ liệu đầu ra quá lớn ra đĩa cục bộ.
• spill-policy (@deepseek-ai/dsh-spill-policy) — Chính sách giới hạn kích thước dữ liệu inline (mặc định 12.500 token).

4. Phiên làm việc (Session), Lưu trữ & Telemetry (14 rows)

• session (@deepseek-ai/dsh-session) — Quản lý vòng đời phiên làm việc.
• session-log-deepseek (@deepseek-ai/dsh-session-log-deepseek) — Ghi nhật ký sự kiện phiên theo chuẩn DeepSeek.
• session-persistence-jsonl (@deepseek-ai/dsh-session-persistence-jsonl) — Lưu trữ lịch sử phiên bền vững dạng tệp JSONL.
• session-checkpoint-policy (@deepseek-ai/dsh-session-checkpoint-policy) — Tạo điểm khôi phục (checkpoint) trước mỗi lần gọi mô hình.
• session-title (@deepseek-ai/dsh-session-title) — Quản lý tiêu đề phiên làm việc.
• session-title-llm (@deepseek-ai/dsh-session-title-first-prompt-llm) — Tự động dùng LLM đặt tên phiên dựa trên prompt đầu tiên.
• session-query-sqlite (@deepseek-ai/dsh-session-query-sqlite) — Truy vấn cấu trúc và phả hệ phiên (tìm kiếm toàn văn tắt mặc định qua openAt: never).
• session-projection (@deepseek-ai/dsh-session-projection) — Chiếu dữ liệu trạng thái phiên phục vụ hiển thị.
• session-projection-cache (@deepseek-ai/dsh-session-projection-cache) — Bộ nhớ đệm ghi trễ cho danh sách phiên.
• attachment-local (@deepseek-ai/dsh-attachment-local) — Lưu trữ tệp đính kèm/hình ảnh tách biệt khỏi log hội thoại.
• storage (@deepseek-ai/dsh-storage) — Hub lưu trữ Key-Value trung tâm.
• storage-json (@deepseek-ai/dsh-storage-json) — Backend lưu trữ KV xuống tệp JSON.
• storage-domain (@deepseek-ai/dsh-storage-domain) — Lớp phân vùng dữ liệu có kiểm tra schema trên nền storage.
• otel (@deepseek-ai/dsh-otel) — Hạ tầng thu thập dữ liệu OpenTelemetry.
• session-telemetry-otel (@deepseek-ai/dsh-session-telemetry-otel) — Xuất log phiên qua OTel (mặc định chế độ FEEDBACK_ONLY).
(Lưu ý: Nhóm 4 thực tế có 15 rows nếu tính cả 2 service OTel ở cuối).

5. Sandbox, Bảo mật & Phân quyền thực thi (10 rows)

• sandbox (@deepseek-ai/dsh-sandbox-local) — Môi trường cách ly thực thi cục bộ.
• sandbox-policy (@deepseek-ai/dsh-sandbox-policy) — Chính sách giới hạn phạm vi ghi tệp (mặc định workspace-write).
• fs-sandbox (@deepseek-ai/dsh-fs-sandbox) — Lớp ảo hóa hệ thống tệp trong phạm vi thư mục làm việc.
• working-directory (@deepseek-ai/dsh-working-directory) — Quản lý thư mục làm việc hiện hành của phiên.
• bash-sandbox (@deepseek-ai/dsh-bash-sandbox) — Cách ly lệnh Bash (chỉ bật trên Linux/macOS).
• pwsh-sandbox (@deepseek-ai/dsh-pwsh-sandbox) — Cách ly lệnh PowerShell (chỉ bật trên Windows).
• approval (@deepseek-ai/dsh-user-approval) — Cơ chế hỏi phê duyệt người dùng trước các thao tác rủi ro.
• permission (@deepseek-ai/dsh-permission-presets) — Các cấu hình quyền mẫu (read-only, workspace-write, danger-full-access).
• shell-env (@deepseek-ai/dsh-shell-env) — Quản lý biến môi trường truyền vào shell.
• cli-account (@deepseek-ai/dsh-cli-account) — Đăng ký tài khoản của các công cụ CLI bên ngoài.

6. Bộ công cụ (Tools) & Thực thi (18 rows)

• tools (@deepseek-ai/dsh-tools) — Registry đăng ký danh sách công cụ cho mô hình.
• tool-executor-native (@deepseek-ai/dsh-tool-executor-native) — Trình thực thi tool gọi hàm trực tiếp (native).
• tool-executor-ptc (@deepseek-ai/dsh-tool-executor-ptc) — Trình thực thi tool dạng Programmatic Tool Calling (tắt mặc định).
• timeout-policy (@deepseek-ai/dsh-tool-call-timeout-policy) — Chính sách giới hạn thời gian chạy của từng lần gọi tool.
• repeat-tool-reminder (@deepseek-ai/dsh-repeat-tool-reminder) — Nhắc nhở mô hình nếu lặp lại cùng một lệnh gọi tool liên tiếp (ở ngưỡng 3, 5, 8 lần).
• tool-bash (@deepseek-ai/dsh-tool-bash) — Công cụ chạy lệnh shell Bash (chỉ bật trên Linux/macOS).
• tool-pwsh (@deepseek-ai/dsh-tool-pwsh) — Công cụ chạy lệnh PowerShell (chỉ bật trên Windows).
• tool-jobs (@deepseek-ai/dsh-tool-jobs) — Công cụ quản lý tiến trình chạy nền.
• tool-fs (@deepseek-ai/dsh-tool-fs) — Công cụ đọc, ghi và chỉnh sửa tệp tin.
• tool-fs-search (@deepseek-ai/dsh-tool-fs-search) — Công cụ tìm kiếm tệp (glob/grep) trong workspace.
• fs-observation-policy (@deepseek-ai/dsh-fs-observation-policy) — Chính sách theo dõi thay đổi tệp (tắt mặc định).
• tool-todo (@deepseek-ai/dsh-tool-todo) — Công cụ quản lý danh sách việc cần làm (todo_write).
• tool-goal (@deepseek-ai/dsh-tool-goal) — Công cụ theo dõi mục tiêu dài hạn trong phiên.
• web (@deepseek-ai/dsh-web) — Dịch vụ điều phối truy cập mạng cho agent.
• web-search-deepseek (@deepseek-ai/dsh-web-search-deepseek) — Provider tìm kiếm web qua DeepSeek.
• web-deepseek-api (@deepseek-ai/dsh-web-deepseek-api) — Kết nối API tìm kiếm/fetch của DeepSeek.
• web-fetch-http (@deepseek-ai/dsh-web-fetch-http) — Trình tải nội dung trang web HTTP(S) cục bộ.
• tool-web (@deepseek-ai/dsh-tool-web) — Cung cấp 2 công cụ web_search và web_fetch cho mô hình.

7. Subagents, Agent Teams & Workflow PTC (11 rows)

• subagent (@deepseek-ai/dsh-subagent) — Hạ tầng điều phối các agent con.
• subagent-spawn-in-process (@deepseek-ai/dsh-subagent-spawn-in-process) — Tạo subagent độc lập trong cùng tiến trình (spawn).
• subagent-fork-in-process (@deepseek-ai/dsh-subagent-fork-in-process) — Nhân bản subagent kế thừa ngữ cảnh hiện tại (fork).
• tool-subagent (@deepseek-ai/dsh-tool-subagent) — Cung cấp công cụ subagent để giao việc cho agent con mới.
• tool-subagent-fork (@deepseek-ai/dsh-tool-subagent) — Cung cấp công cụ subagent_fork để rẽ nhánh hội thoại.
• tool-subagent-control (@deepseek-ai/dsh-tool-subagent-control) — Cung cấp công cụ send_message để điều hướng agent con đang chạy.
• agent-team (@deepseek-ai/dsh-agent-team) — Hạ tầng phối hợp nhóm nhiều agent (tối đa 256 task).
• tool-agent-team (@deepseek-ai/dsh-tool-agent-team) — Bộ công cụ giao tiếp và chia việc trong Agent Team.
• ptc-runtime (@deepseek-ai/dsh-ptc-runtime-node) — Môi trường Node.js thực thi mã điều phối luồng (PTC).
• workflow-ptc (@deepseek-ai/dsh-workflow-ptc) — Dịch vụ chạy quy trình tự động hóa bằng mã.
• tool-workflow (@deepseek-ai/dsh-tool-workflow) — Công cụ cho phép mô hình kích hoạt workflow.

8. Skills, Slash Commands & MCP (11 rows)

• skill (@deepseek-ai/dsh-skill) — Hệ thống quản lý kỹ năng mở rộng (Skills).
• skill-filesystem (@deepseek-ai/dsh-skill-filesystem) — Nạp các tệp định nghĩa skill từ ổ đĩa.
• tool-skill (@deepseek-ai/dsh-tool-skill) — Công cụ cho phép mô hình kích hoạt và đọc skill.
• upstream-skills (@deepseek-ai/dsh-upstream-skills) — Quản lý các skill đồng bộ từ nguồn upstream.
• commands (@deepseek-ai/dsh-commands) — Bộ xử lý lệnh gạch chéo (/command) từ người dùng.
• command-feedback (@deepseek-ai/dsh-command-feedback) — Lệnh gửi phản hồi chất lượng phiên.
• command-compact (@deepseek-ai/dsh-command-compact) — Lệnh /compact ép nén ngữ cảnh thủ công.
• command-goal (@deepseek-ai/dsh-command-goal) — Lệnh /goal quản lý mục tiêu phiên.
• goal (@deepseek-ai/dsh-goal) — Dịch vụ lưu trữ trạng thái mục tiêu.
• goal-round-driver (@deepseek-ai/dsh-goal-round-driver) — Bộ điều khiển tự động thúc đẩy vòng lặp cho đến khi đạt mục tiêu.
• mcp-resources (@deepseek-ai/dsh-mcp-resources) — Hỗ trợ đọc tài nguyên từ chuẩn Model Context Protocol (MCP).
Show Code
