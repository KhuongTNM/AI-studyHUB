package com.aistudyhub.backend.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * FR-23: Đại diện cho một thư mục trong cấu trúc cây phân cấp vô hạn.
 * Mỗi thư mục thuộc sở hữu độc quyền của một User (BR-080) và có thể
 * chứa các thư mục con (BR-081) lẫn các tài liệu học tập.
 */
@Entity
@Table(name = "folders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Folder {

    /** Giới hạn độ dài tên thư mục theo BR-003. */
    private static final int TEN_TOI_DA = 50;

    /** Giới hạn độ dài nhãn môn học, đồng bộ với cột subject của bảng documents. */
    private static final int MON_HOC_TOI_DA = 100;

    @Id
    private UUID id;

    /**
     * BR-003: Tên thư mục tối đa 50 ký tự, bắt buộc có giá trị.
     * Dùng NVARCHAR để hỗ trợ đầy đủ Unicode (tiếng Việt, ký tự đặc biệt).
     */
    @Column(name = "name", nullable = false, length = TEN_TOI_DA,
            columnDefinition = "NVARCHAR(" + TEN_TOI_DA + ")")
    private String name;

    /**
     * BR-082: Gắn kết môn học cho thư mục.
     * Cho phép NULL — thư mục con có thể kế thừa môn học từ thư mục cha
     * thông qua logic nghiệp vụ tại tầng Service.
     */
    @Column(name = "subject", length = MON_HOC_TOI_DA,
            columnDefinition = "NVARCHAR(" + MON_HOC_TOI_DA + ")")
    private String subject;

    /**
     * BR-080: Sở hữu cá nhân độc quyền — mỗi thư mục thuộc về đúng một User.
     * LAZY để tránh tải dữ liệu User thừa khi chỉ cần thao tác với Folder.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /**
     * BR-081: Thư mục cha trong cấu trúc cây đệ quy.
     * NULL khi đây là thư mục gốc (root) của người dùng.
     * LAZY để không tải toàn bộ cây tổ tiên khi truy cập một node bất kỳ.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private Folder parent;

    /**
     * BR-084: Danh sách thư mục con trực tiếp.
     * CascadeType.ALL + orphanRemoval = true đảm bảo khi xóa thư mục cha,
     * toàn bộ cây con phía dưới cũng bị xóa theo (xóa dắt dây).
     */
    @OneToMany(mappedBy = "parent", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Folder> children = new ArrayList<>();

    /*
     * BR-085 — KHÔNG khai báo @OneToMany tới Document tại đây.
     * Document.folderId là plain UUID column (không phải JPA relationship),
     * nên khi xóa Folder, các Document bên trong tự nhiên trở thành "mồ côi"
     * (folderId trỏ đến folder không còn tồn tại) mà không bị xóa theo.
     * Tầng Service chịu trách nhiệm set document.folderId = NULL trước khi xóa Folder
     * nếu cần dọn dẹp tham chiếu.
     */

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
