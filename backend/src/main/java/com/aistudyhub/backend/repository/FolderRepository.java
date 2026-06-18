package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.Folder;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * FR-23: Repository thao tác dữ liệu cho thực thể Folder.
 * Các derived query được đặt tên theo chuẩn Fail-Fast:
 * kiểm tra trùng lặp tên TRƯỚC khi tạo/đổi tên để ngắt luồng sớm,
 * tránh thực thi INSERT/UPDATE thừa vào Database.
 */
public interface FolderRepository extends JpaRepository<Folder, UUID> {

    /**
     * BR-086: Kiểm tra thư mục con trong cùng một cấp độ (cùng cha) của một User
     * đã có tên trùng (không phân biệt hoa/thường) hay chưa.
     *
     * <p>Dùng trước khi TẠO MỚI hoặc ĐỔI TÊN thư mục con để phát hiện trùng lặp sớm.
     *
     * @param userId   ID của người dùng sở hữu thư mục.
     * @param parentId ID của thư mục cha trực tiếp.
     * @param name     Tên thư mục cần kiểm tra.
     * @return {@code true} nếu đã tồn tại thư mục trùng tên trong cùng cấp độ.
     */
    boolean existsByUser_IdAndParent_IdAndNameIgnoreCase(UUID userId, UUID parentId, String name);

    /**
     * BR-086 (cấp gốc): Kiểm tra thư mục gốc (parent IS NULL) của một User
     * đã có tên trùng (không phân biệt hoa/thường) hay chưa.
     *
     * <p>Dùng trước khi TẠO MỚI hoặc ĐỔI TÊN thư mục ở cấp cao nhất.
     *
     * @param userId ID của người dùng sở hữu thư mục.
     * @param name   Tên thư mục cần kiểm tra.
     * @return {@code true} nếu đã tồn tại thư mục gốc trùng tên.
     */
    boolean existsByUser_IdAndParentIsNullAndNameIgnoreCase(UUID userId, String name);

    /**
     * Lấy toàn bộ thư mục gốc (parent IS NULL) thuộc quyền sở hữu của một User,
     * sắp xếp theo tên để hiển thị nhất quán trên giao diện.
     *
     * <p>Đây là điểm khởi đầu để dựng cây thư mục phân cấp từ trên xuống.
     *
     * @param userId ID của người dùng cần lấy danh sách thư mục gốc.
     * @return Danh sách các thư mục gốc, có thể rỗng nếu User chưa tạo thư mục nào.
     */
    List<Folder> findAllByUser_IdAndParentIsNullOrderByNameAsc(UUID userId);

    /**
     * BR-086 (đổi tên – thư mục con): Kiểm tra trùng tên trong cùng cấp độ,
     * loại trừ chính thư mục đang được đổi tên (tránh false-positive khi giữ nguyên tên).
     *
     * @param userId   ID người dùng sở hữu.
     * @param parentId ID thư mục cha trực tiếp.
     * @param name     Tên mới cần kiểm tra.
     * @param excludeId UUID của thư mục đang đổi tên (bị loại trừ khỏi kiểm tra).
     * @return {@code true} nếu đã tồn tại thư mục khác trùng tên.
     */
    boolean existsByUser_IdAndParent_IdAndNameIgnoreCaseAndIdNot(
            UUID userId, UUID parentId, String name, UUID excludeId);

    /**
     * BR-086 (đổi tên – thư mục gốc): Kiểm tra trùng tên ở cấp gốc,
     * loại trừ chính thư mục đang được đổi tên.
     *
     * @param userId    ID người dùng sở hữu.
     * @param name      Tên mới cần kiểm tra.
     * @param excludeId UUID của thư mục đang đổi tên (bị loại trừ khỏi kiểm tra).
     * @return {@code true} nếu đã tồn tại thư mục gốc khác trùng tên.
     */
    boolean existsByUser_IdAndParentIsNullAndNameIgnoreCaseAndIdNot(
            UUID userId, String name, UUID excludeId);
}
