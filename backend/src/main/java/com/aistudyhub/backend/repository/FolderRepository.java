package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.Folder;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FolderRepository extends JpaRepository<Folder, UUID> {
    boolean existsByUser_IdAndParent_IdAndNameIgnoreCase(UUID userId, UUID parentId, String name);
    boolean existsByUser_IdAndParentIsNullAndNameIgnoreCase(UUID userId, String name);
    List<Folder> findAllByUser_IdAndParentIsNullOrderByNameAsc(UUID userId);
    boolean existsByUser_IdAndParent_IdAndNameIgnoreCaseAndIdNot(
            UUID userId, UUID parentId, String name, UUID excludeId);
    boolean existsByUser_IdAndParentIsNullAndNameIgnoreCaseAndIdNot(
            UUID userId, String name, UUID excludeId);
    List<Folder> findAllByUser_IdOrderByNameAsc(UUID userId);
}
