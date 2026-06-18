package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.FolderCreateRequest;
import com.aistudyhub.backend.dto.FolderNodeResponse;
import com.aistudyhub.backend.dto.FolderRenameRequest;
import com.aistudyhub.backend.entity.Folder;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.DocumentRepository;
import com.aistudyhub.backend.repository.FolderRepository;
import com.aistudyhub.backend.repository.UserRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * FR-23: Triển khai nghiệp vụ quản lý thư mục phân cấp.
 * Toàn bộ validate theo chiến lược Fail-Fast — ném ngoại lệ ngắt luồng sớm
 * trước khi thực hiện bất kỳ thao tác ghi nào xuống DB.
 */
@Service
@RequiredArgsConstructor
public class FolderServiceImpl implements FolderService {

    private final FolderRepository folderRepository;
    private final UserRepository userRepository;
    private final DocumentRepository documentRepository;

    /**
     * Tạo thư mục mới (gốc hoặc con) cho người dùng.
     * Thứ tự Fail-Fast:
     *   1. Người dùng tồn tại?
     *   2. Thư mục cha tồn tại? (chỉ khi parentId != null)
     *   3. Thư mục cha thuộc về đúng người dùng?
     *   4. Tên có trùng trong cùng cấp độ không? (BR-086)
     * Sau khi qua hết, mới tiến hành ghi DB.
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public FolderNodeResponse createFolder(UUID userId, FolderCreateRequest request) {

        // Fail-Fast 1: Xác minh người dùng tồn tại trong hệ thống
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "Người dùng không tồn tại."));

        Folder parent = null;
        // Khởi tạo subject từ request; có thể được ghi đè bởi kế thừa BR-083 bên dưới
        String resolvedSubject = request.getSubject();

        if (request.getParentId() != null) {

            // Fail-Fast 2: Xác minh thư mục cha tồn tại
            parent = folderRepository.findById(request.getParentId())
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                            "Thư mục cha không tồn tại."));

            // Fail-Fast 3: Thư mục cha phải thuộc về chính người dùng này (BR-080)
            if (!parent.getUser().getId().equals(userId)) {
                throw new ApiException(HttpStatus.FORBIDDEN,
                        "Bạn không có quyền tạo thư mục con trong thư mục này.");
            }

            // BR-083: Kế thừa môn học từ thư mục cha nếu request không truyền subject
            if (resolvedSubject == null) {
                resolvedSubject = parent.getSubject();
            }
        }

        // Tên đã trim sớm để đảm bảo check trùng và lưu DB dùng cùng một giá trị
        String trimmedName = request.getName().trim();

        // Fail-Fast 4 (BR-086): Kiểm tra trùng tên trong cùng cấp độ (không phân biệt hoa/thường)
        boolean trungTen = (parent == null)
                ? folderRepository.existsByUser_IdAndParentIsNullAndNameIgnoreCase(userId, trimmedName)
                : folderRepository.existsByUser_IdAndParent_IdAndNameIgnoreCase(userId, parent.getId(), trimmedName);

        if (trungTen) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Tên thư mục đã tồn tại trong cùng cấp độ.");
        }

        // Tất cả điều kiện đã thỏa mãn — tiến hành tạo entity và lưu DB
        LocalDateTime now = LocalDateTime.now();
        Folder folder = Folder.builder()
                .id(UUID.randomUUID())
                .name(trimmedName)
                .subject(resolvedSubject)
                .user(user)
                .parent(parent)
                .createdAt(now)
                .updatedAt(now)
                .build();

        folderRepository.save(folder);

        // Thư mục mới tạo luôn có children rỗng
        return new FolderNodeResponse(folder.getId(), folder.getName(), folder.getSubject(), List.of());
    }

    /**
     * Trả về toàn bộ cây thư mục phân cấp lồng nhau của người dùng.
     * readOnly = true cho phép Hibernate tắt dirty-checking, tối ưu hiệu năng đọc.
     * Truy cập lazy collection (children) an toàn trong phạm vi transaction này.
     */
    @Override
    @Transactional(readOnly = true)
    public List<FolderNodeResponse> getFolderTree(UUID userId) {
        List<Folder> rootFolders =
                folderRepository.findAllByUser_IdAndParentIsNullOrderByNameAsc(userId);

        return rootFolders.stream()
                .map(this::toNode)
                .collect(Collectors.toList());
    }

    /**
     * Đổi tên (và tùy chọn cập nhật môn học) của một thư mục.
     * Thứ tự Fail-Fast:
     *   1. Thư mục tồn tại?
     *   2. Thư mục thuộc về người dùng?
     *   3. Tên mới có trùng trong cùng cấp độ không? (BR-086, loại trừ chính nó)
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public FolderNodeResponse renameFolder(UUID userId, UUID folderId, FolderRenameRequest request) {

        // Fail-Fast 1 + 2: Thư mục tồn tại và thuộc về người dùng
        Folder folder = requireOwnedFolder(userId, folderId);

        String trimmedName = request.getName().trim();

        // Fail-Fast 3 (BR-086): Kiểm tra trùng tên, loại trừ chính thư mục này
        boolean trungTen = (folder.getParent() == null)
                ? folderRepository.existsByUser_IdAndParentIsNullAndNameIgnoreCaseAndIdNot(
                        userId, trimmedName, folderId)
                : folderRepository.existsByUser_IdAndParent_IdAndNameIgnoreCaseAndIdNot(
                        userId, folder.getParent().getId(), trimmedName, folderId);

        if (trungTen) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Tên thư mục đã tồn tại trong cùng cấp độ.");
        }

        folder.setName(trimmedName);
        // subject: null trong request = giữ nguyên giá trị cũ; chuỗi rỗng = xóa nhãn
        if (request.getSubject() != null) {
            folder.setSubject(request.getSubject().isBlank() ? null : request.getSubject().trim());
        }
        folder.setUpdatedAt(LocalDateTime.now());

        folderRepository.save(folder);

        return toNode(folder);
    }

    /**
     * Xóa một thư mục cùng toàn bộ cây con bên dưới.
     * Thứ tự Fail-Fast:
     *   1. Thư mục tồn tại?
     *   2. Thư mục thuộc về người dùng?
     * Sau đó:
     *   3. Thu thập tất cả UUID trong cây con (BR-085).
     *   4. Gán folderId = NULL cho các Document liên quan.
     *   5. Xóa Folder — JPA cascade xóa toàn bộ cây con.
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteFolder(UUID userId, UUID folderId) {

        // Fail-Fast 1 + 2
        Folder folder = requireOwnedFolder(userId, folderId);

        // Thu thập toàn bộ ID trong cây con (bao gồm chính folder này)
        List<UUID> subtreeIds = new ArrayList<>();
        collectSubtreeIds(folder, subtreeIds);

        // BR-085: Ngắt liên kết Document trước khi xóa Folder
        documentRepository.clearFolderIdByFolderIds(subtreeIds);

        folderRepository.delete(folder);
    }

    /**
     * Di chuyển một thư mục sang vị trí mới trong cây phân cấp (BR-087).
     * Thứ tự Fail-Fast:
     *   1. Thư mục cần di chuyển tồn tại và thuộc về người dùng?
     *   2. (Nếu targetParentId != null) Di chuyển vào chính mình? → từ chối ngay, không cần DB.
     *   3. (Nếu targetParentId != null) Thư mục đích tồn tại và thuộc về người dùng?
     *   4. (Nếu targetParentId != null) targetParentId nằm trong cây con của folder? → từ chối.
     *   5. Tên có trùng tại vị trí đích không? (BR-086)
     * Sau khi qua hết mới ghi DB; bao gồm cả kế thừa môn học từ thư mục đích.
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public void moveFolder(UUID userId, UUID folderId, UUID targetParentId) {

        // Fail-Fast 1: Thư mục tồn tại và thuộc về đúng người dùng
        Folder folder = requireOwnedFolder(userId, folderId);

        Folder newParent = null;

        if (targetParentId != null) {

            // Fail-Fast 2 (BR-087): Chặn di chuyển vào chính mình — không cần truy vấn DB thêm
            if (folderId.equals(targetParentId)) {
                throw new ApiException(HttpStatus.BAD_REQUEST,
                        "Không thể di chuyển thư mục vào chính nó.");
            }

            // Fail-Fast 3: Thư mục đích tồn tại và thuộc về đúng người dùng
            newParent = folderRepository.findById(targetParentId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                            "Thư mục đích không tồn tại."));

            if (!newParent.getUser().getId().equals(userId)) {
                throw new ApiException(HttpStatus.FORBIDDEN,
                        "Bạn không có quyền di chuyển thư mục vào đây.");
            }

            // Fail-Fast 4 (BR-087): Phát hiện chu trình — duyệt toàn bộ cây con của folder,
            // nếu targetParentId nằm trong đó thì đây là di chuyển vào thư mục con cháu của chính nó
            List<UUID> subtreeIds = new ArrayList<>();
            collectSubtreeIds(folder, subtreeIds);
            if (subtreeIds.contains(targetParentId)) {
                throw new ApiException(HttpStatus.BAD_REQUEST,
                        "Không thể di chuyển thư mục vào bên trong thư mục con của nó.");
            }
        }

        // Fail-Fast 5 (BR-086): Kiểm tra trùng tên tại vị trí đích, loại trừ chính folder này
        boolean trungTen = (newParent == null)
                ? folderRepository.existsByUser_IdAndParentIsNullAndNameIgnoreCaseAndIdNot(
                        userId, folder.getName(), folderId)
                : folderRepository.existsByUser_IdAndParent_IdAndNameIgnoreCaseAndIdNot(
                        userId, targetParentId, folder.getName(), folderId);

        if (trungTen) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Đã tồn tại thư mục có tên \"" + folder.getName() + "\" tại vị trí đích.");
        }

        // Cập nhật thư mục cha
        folder.setParent(newParent);

        // Kế thừa môn học từ thư mục đích nếu folder chưa có môn học cố định (BR-083)
        if (newParent != null
                && newParent.getSubject() != null
                && folder.getSubject() == null) {
            folder.setSubject(newParent.getSubject());
        }

        folder.setUpdatedAt(LocalDateTime.now());
        folderRepository.save(folder);
    }

    /**
     * Kiểm tra quyền sở hữu và trả về Folder entity.
     * Ném 404 nếu không tìm thấy, 403 nếu không thuộc về userId.
     */
    private Folder requireOwnedFolder(UUID userId, UUID folderId) {
        Folder folder = folderRepository.findById(folderId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "Thư mục không tồn tại."));
        if (!folder.getUser().getId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN,
                    "Bạn không có quyền thao tác với thư mục này.");
        }
        return folder;
    }

    /**
     * Thu thập đệ quy tất cả UUID trong cây con bắt đầu từ {@code folder}
     * (bao gồm chính folder đó).
     * Truy cập lazy collection children an toàn trong phạm vi @Transactional.
     */
    private void collectSubtreeIds(Folder folder, List<UUID> ids) {
        ids.add(folder.getId());
        for (Folder child : folder.getChildren()) {
            collectSubtreeIds(child, ids);
        }
    }

    /**
     * Ánh xạ đệ quy một entity Folder sang DTO FolderNodeResponse.
     *
     * <p>Truy cập {@code folder.getChildren()} kích hoạt lazy-load của Hibernate,
     * nhưng an toàn vì hàm này luôn được gọi trong ngữ cảnh @Transactional(readOnly = true).
     * Các thư mục con được sắp xếp A-Z để đồng bộ với thứ tự ở cấp gốc.
     */
    private FolderNodeResponse toNode(Folder folder) {
        List<FolderNodeResponse> childNodes = folder.getChildren().stream()
                .sorted(Comparator.comparing(Folder::getName, String.CASE_INSENSITIVE_ORDER))
                .map(this::toNode)
                .collect(Collectors.toList());

        return new FolderNodeResponse(
                folder.getId(),
                folder.getName(),
                folder.getSubject(),
                childNodes
        );
    }
}
