package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.Folder;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FolderRepository extends JpaRepository<Folder, UUID> {
    boolean existsByUser_IdAndParent_IdAndNameIgnoreCase(UUID userId, UUID parentId, String name);
    boolean existsByUser_IdAndParentIsNullAndNameIgnoreCase(UUID userId, String name);
    List<Folder> findAllByUser_IdAndParentIsNullOrderByNameAsc(UUID userId);
    boolean existsByUser_IdAndParent_IdAndNameIgnoreCaseAndIdNot(
            UUID userId, UUID parentId, String name, UUID excludeId);
    boolean existsByUser_IdAndParentIsNullAndNameIgnoreCaseAndIdNot(
            UUID userId, String name, UUID excludeId);
    List<Folder> findAllByUser_IdOrderByNameAsc(UUID userId);

    @Query("SELECT COUNT(f) > 0 FROM Folder f WHERE f.user.id = :userId AND f.parent IS NULL " +
           "AND ((:subject IS NULL AND f.subject IS NULL) OR (f.subject IS NOT NULL AND LOWER(f.subject) = LOWER(:subject))) " +
           "AND LOWER(f.name) = LOWER(:name)")
    boolean existsByUser_IdAndParentIsNullAndSubjectAndNameIgnoreCase(
            @Param("userId") UUID userId, 
            @Param("subject") String subject, 
            @Param("name") String name);

    @Query("SELECT COUNT(f) > 0 FROM Folder f WHERE f.user.id = :userId AND f.parent IS NULL " +
           "AND ((:subject IS NULL AND f.subject IS NULL) OR (f.subject IS NOT NULL AND LOWER(f.subject) = LOWER(:subject))) " +
           "AND LOWER(f.name) = LOWER(:name) AND f.id <> :excludeId")
    boolean existsByUser_IdAndParentIsNullAndSubjectAndNameIgnoreCaseAndIdNot(
            @Param("userId") UUID userId, 
            @Param("subject") String subject, 
            @Param("name") String name, 
            @Param("excludeId") UUID excludeId);
}
