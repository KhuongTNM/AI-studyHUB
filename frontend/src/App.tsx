import {
  Activity,
  BarChart3,
  Bot,
  Brain,
  CheckCircle2,
  Cloud,
  FileText,
  GraduationCap,
  HardDrive,
  LayoutDashboard,
  Lock,
  MessageSquare,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
} from "lucide-react";

type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { label: "Tổng quan", icon: LayoutDashboard },
  { label: "Tài liệu", icon: FileText },
  { label: "Cloud Storage", icon: Cloud },
  { label: "AI Chatbot", icon: Bot },
  { label: "Flashcard", icon: Brain },
  { label: "Study Room", icon: Users },
  { label: "Admin", icon: ShieldCheck },
  { label: "Profile", icon: Settings },
];

const documents = [
  {
    title: "Giải tích 1 - Chương đạo hàm.pdf",
    subject: "Toán học",
    type: "PDF",
    status: "ready",
    visibility: "Public",
    size: "2.4 MB",
    downloads: 15,
  },
  {
    title: "OOP Java - Slides.pptx",
    subject: "Lập trình",
    type: "PPTX",
    status: "scanning",
    visibility: "Private",
    size: "5.1 MB",
    downloads: 4,
  },
  {
    title: "Business Rules AI Study Hub.docx",
    subject: "SWP391",
    type: "DOCX",
    status: "pending",
    visibility: "Review",
    size: "830 KB",
    downloads: 9,
  },
];

const adminRows = [
  ["student@aistudyhub.com", "Demo Student", "Free", "512 MB", "Hoạt động"],
  ["subadmin@aistudyhub.com", "Sub Admin", "5+ người", "1 GB", "Hoạt động"],
  ["locpd@fpt.edu.vn", "LocPD", "Free", "512 MB", "Đã khóa"],
];

function StatCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <section className="stat-card">
      <Icon className="stat-icon" />
      <div>
        <p className="muted">{label}</p>
        <strong>{value}</strong>
        <span>{helper}</span>
      </div>
    </section>
  );
}

function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <GraduationCap />
          <div>
            <strong>AI Study Hub</strong>
            <span>SU26SWP10</span>
          </div>
        </div>
        <nav>
          {navItems.map((item) => (
            <button type="button" key={item.label} className="nav-button">
              <item.icon className="nav-icon" />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Group 07 | AI Study Hub</p>
            <h1>Quản lý tài liệu học tập với AI</h1>
          </div>
          <div className="top-actions">
            <button type="button" className="ghost-button">
              Tiếng Việt
            </button>
            <button type="button" className="primary-button">
              Đăng nhập
            </button>
          </div>
        </header>

        <section className="stats-grid">
          <StatCard icon={FileText} label="Tài liệu" value="128" helper="PDF, DOCX, PPTX" />
          <StatCard icon={HardDrive} label="Dung lượng" value="384 / 512 MB" helper="Cảnh báo khi vượt 80%" />
          <StatCard icon={MessageSquare} label="AI Chat" value="42 phiên" helper="Hỏi đáp theo tài liệu" />
          <StatCard icon={Users} label="Study Room" value="6 phòng" helper="Theo gói subscription" />
        </section>

        <section className="content-grid">
          <article className="panel large-panel">
            <div className="panel-heading">
              <div>
                <h2>Document Management</h2>
                <p>View-only layout cho upload, lọc, preview, trash và duyệt chia sẻ.</p>
              </div>
              <div className="button-row">
                <button type="button" className="ghost-button icon-button">
                  <Search />
                  Tìm kiếm
                </button>
                <button type="button" className="primary-button icon-button">
                  <Upload />
                  Upload
                </button>
              </div>
            </div>

            <div className="table">
              <div className="table-row table-head">
                <span>Tên tài liệu</span>
                <span>Môn học</span>
                <span>Loại</span>
                <span>Trạng thái</span>
                <span>Lượt tải</span>
              </div>
              {documents.map((doc) => (
                <div className="table-row" key={doc.title}>
                  <span className="file-name">{doc.title}</span>
                  <span>{doc.subject}</span>
                  <span>{doc.type}</span>
                  <span>
                    <mark className={`status ${doc.status}`}>{doc.status}</mark>
                  </span>
                  <span>{doc.downloads}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading compact">
              <h2>Cloud Storage</h2>
              <Cloud />
            </div>
            <div className="meter">
              <span style={{ width: "75%" }} />
            </div>
            <p className="meter-label">384 MB đã dùng trên 512 MB</p>
            <ul className="check-list">
              <li><CheckCircle2 /> Preview file trạng thái ready</li>
              <li><CheckCircle2 /> Soft delete vào Trash</li>
              <li><CheckCircle2 /> Cập nhật storageUsed</li>
            </ul>
          </article>

          <article className="panel">
            <div className="panel-heading compact">
              <h2>AI Chatbot</h2>
              <Bot />
            </div>
            <div className="chat-box">
              <p className="assistant">Chọn một tài liệu ready để hỏi theo ngữ cảnh.</p>
              <p className="user">Tóm tắt nội dung chính của tài liệu này.</p>
              <p className="assistant">AI sẽ render phản hồi Markdown ở phía client.</p>
            </div>
            <div className="input-preview">Nhập câu hỏi...</div>
          </article>

          <article className="panel">
            <div className="panel-heading compact">
              <h2>Authentication</h2>
              <Lock />
            </div>
            <div className="form-preview">
              <label>Email</label>
              <div className="fake-input">student@aistudyhub.com</div>
              <label>Mật khẩu</label>
              <div className="fake-input">Tối thiểu 8 ký tự, có chữ và số</div>
              <button type="button" className="primary-button full">Đăng nhập</button>
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading compact">
              <h2>Flashcard</h2>
              <Brain />
            </div>
            <div className="flashcard">
              <p>Câu hỏi</p>
              <strong>BR-013 cho phép upload những định dạng nào?</strong>
              <span>PDF, DOCX và PPTX.</span>
            </div>
            <div className="tag-row">
              <mark>new</mark>
              <mark>learning</mark>
              <mark>mastered</mark>
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading compact">
              <h2>Study Room</h2>
              <Users />
            </div>
            <div className="room-card">
              <strong>ROOM-391</strong>
              <span>Host: AnhNV | Gói 2-4 người | 3/4 thành viên</span>
            </div>
            <p className="muted">User Free có thể tham gia phòng, nhưng không được tạo phòng.</p>
          </article>

          <article className="panel large-panel">
            <div className="panel-heading">
              <div>
                <h2>Admin Dashboard</h2>
                <p>Quản lý user, subscription, khóa tài khoản và activity log.</p>
              </div>
              <Activity />
            </div>
            <div className="table admin-table">
              <div className="table-row table-head">
                <span>Email</span>
                <span>Tên</span>
                <span>Gói</span>
                <span>Dung lượng</span>
                <span>Trạng thái</span>
              </div>
              {adminRows.map((row) => (
                <div className="table-row" key={row[0]}>
                  {row.map((cell) => <span key={cell}>{cell}</span>)}
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading compact">
              <h2>Trash & Logs</h2>
              <Trash2 />
            </div>
            <ul className="activity-list">
              <li><BarChart3 /> Soft-delete tài liệu khi xóa.</li>
              <li><ShieldCheck /> Sub-admin không thao tác trên Admin.</li>
              <li><Activity /> Ghi log các sự kiện quan trọng.</li>
            </ul>
          </article>
        </section>
      </main>
    </div>
  );
}

export default App;
