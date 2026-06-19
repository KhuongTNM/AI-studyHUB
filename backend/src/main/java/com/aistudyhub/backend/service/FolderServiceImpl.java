package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.FolderCreateRequest;
import com.aistudyhub.backend.dto.FolderNodeResponse;
import com.aistudyhub.backend.dto.FolderRenameRequest;
import com.aistudyhub.backend.dto.FolderUpdateRequest;
import com.aistudyhub.backend.entity.Folder;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.DocumentRepository;
import com.aistudyhub.backend.repository.FolderRepository;
import com.aistudyhub.backend.repository.UserRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * FR-23: Triển khai nghiệp vụ quản lý thư mục phân cấp.
 */
@Service
@RequiredArgsConstructor
public class FolderServiceImpl implements FolderService {

    private final FolderRepository folderRepository;
    private final UserRepository userRepository;
    private final DocumentRepository documentRepository;

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
    @Override
    @Transactional(readOnly = true)
    public List<FolderNodeResponse> getFolderTree(UUID userId) {
        List<Folder> all = folderRepository.findAllByUser_IdOrderByNameAsc(userId);
        if (all.isEmpty()) {
            return List.of();
        }

        // Pass 1: khởi tạo mỗi node với danh sách children mutable (ArrayList) để thêm sau
        Map<UUID, List<FolderNodeResponse>> childrenMap = new HashMap<>(all.size() * 2);
        Map<UUID, FolderNodeResponse>       nodeMap     = new HashMap<>(all.size() * 2);
        for (Folder f : all) {
            List<FolderNodeResponse> children = new ArrayList<>();
            nodeMap.put(f.getId(),
                    new FolderNodeResponse(f.getId(), f.getName(), f.getSubject(), children));
            childrenMap.put(f.getId(), children);
        }

        // Pass 2: liên kết cha-con trong RAM — f.getParent().getId() không trigger lazy-load
        List<FolderNodeResponse> roots = new ArrayList<>();
        for (Folder f : all) {
            FolderNodeResponse node = nodeMap.get(f.getId());
            if (f.getParent() == null) {
                roots.add(node);
            } else {
                List<FolderNodeResponse> parentChildren = childrenMap.get(f.getParent().getId());
                if (parentChildren != null) {
                    parentChildren.add(node);
                }
            }
        }

        // Sắp xếp đệ quy A-Z (case-insensitive) ở mọi cấp độ
        sortRecursive(roots, Comparator.comparing(FolderNodeResponse::getName,
                String.CASE_INSENSITIVE_ORDER));
        return roots;
    }

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

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void moveFolder(UUID userId, UUID folderId, UUID targetParentId) {

        // Fail-Fast 1: Thư mục tồn tại và thuộc về đúng người dùng
        Folder folder = requireOwnedFolder(userId, folderId);

        Folder newParent = null;

        if (targetParentId != null) {
            if (folderId.equals(targetParentId)) {
                throw new ApiException(HttpStatus.BAD_REQUEST,
                        "Không thể di chuyển thư mục vào chính nó.");
            }
            newParent = folderRepository.findById(targetParentId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                            "Thư mục đích không tồn tại."));

            if (!newParent.getUser().getId().equals(userId)) {
                throw new ApiException(HttpStatus.FORBIDDEN,
                        "Bạn không có quyền di chuyển thư mục vào đây.");
            }
            List<UUID> subtreeIds = new ArrayList<>();
            collectSubtreeIds(folder, subtreeIds);
            if (subtreeIds.contains(targetParentId)) {
                throw new ApiException(HttpStatus.BAD_REQUEST,
                        "Không thể di chuyển thư mục vào bên trong thư mục con của nó.");
            }
        }
        boolean trungTen = (newParent == null)
                ? folderRepository.existsByUser_IdAndParentIsNullAndNameIgnoreCaseAndIdNot(
                        userId, folder.getName(), folderId)
                : folderRepository.existsByUser_IdAndParent_IdAndNameIgnoreCaseAndIdNot(
                        userId, targetParentId, folder.getName(), folderId);

        if (trungTen) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Đã tồn tại thư mục có tên \"" + folder.getName() + "\" tại vị trí đích.");
        }
        folder.setParent(newParent);
        if (newParent != null
                && newParent.getSubject() != null
                && folder.getSubject() == null) {
            folder.setSubject(newParent.getSubject());
        }

        folder.setUpdatedAt(LocalDateTime.now());
        folderRepository.save(folder);
    }
    @Override
    @Transactional(rollbackFor = Exception.class)
    public FolderNodeResponse updateFolder(UUID userId, UUID folderId, FolderUpdateRequest request) {
        Folder folder = requireOwnedFolder(userId, folderId);
        String trimmedName = request.getName().trim();
        Folder newParent = null;
        boolean parentChanged = request.isChangeParent();
        if (parentChanged && request.getParentId() != null) {
            UUID targetParentId = request.getParentId();
            if (folderId.equals(targetParentId)) {
                throw new ApiException(HttpStatus.BAD_REQUEST,
                        "Không thể di chuyển thư mục vào chính nó.");
            }
            newParent = folderRepository.findById(targetParentId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                            "Thư mục cha không tồn tại."));
            if (!newParent.getUser().getId().equals(userId)) {
                throw new ApiException(HttpStatus.FORBIDDEN,
                        "Bạn không có quyền di chuyển thư mục vào đây.");
            }
            List<UUID> subtreeIds = new ArrayList<>();
            collectSubtreeIds(folder, subtreeIds);
            if (subtreeIds.contains(targetParentId)) {
                throw new ApiException(HttpStatus.BAD_REQUEST,
                        "Không thể di chuyển thư mục vào bên trong thư mục con của nó.");
            }
        } else if (!parentChanged) {
            newParent = folder.getParent();
        }
        boolean trungTen = (newParent == null)
                ? folderRepository.existsByUser_IdAndParentIsNullAndNameIgnoreCaseAndIdNot(
                        userId, trimmedName, folderId)
                : folderRepository.existsByUser_IdAndParent_IdAndNameIgnoreCaseAndIdNot(
                        userId, newParent.getId(), trimmedName, folderId);
        if (trungTen) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Tên thư mục đã tồn tại trong cùng cấp độ.");
        }
        folder.setName(trimmedName);
        if (request.getSubject() != null) {
            folder.setSubject(request.getSubject().isBlank() ? null : request.getSubject().trim());
        }
        if (parentChanged) {
            folder.setParent(newParent);
            if (newParent != null && newParent.getSubject() != null && folder.getSubject() == null) {
                folder.setSubject(newParent.getSubject());
            }
        }

        folder.setUpdatedAt(LocalDateTime.now());
        folderRepository.save(folder);

        return toNode(folder);
    }

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
    private void collectSubtreeIds(Folder folder, List<UUID> ids) {
        ids.add(folder.getId());
        for (Folder child : folder.getChildren()) {
            collectSubtreeIds(child, ids);
        }
    }

    private void sortRecursive(List<FolderNodeResponse> nodes,
                               Comparator<FolderNodeResponse> cmp) {
        if (nodes.isEmpty()) {
            return;
        }
        nodes.sort(cmp);
        for (FolderNodeResponse node : nodes) {
            sortRecursive(node.getChildren(), cmp);
        }
    }

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
