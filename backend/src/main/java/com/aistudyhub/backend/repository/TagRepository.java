package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.Tag;
import java.util.Optional;
import java.util.Set;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TagRepository extends JpaRepository<Tag, Long> {

    Optional<Tag> findByName(String name);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(value = "DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM document_tags)", nativeQuery = true)
    void deleteOrphanTags();
    /**
     * Tìm tag mồ côi trong danh sách ID ứng viên:
     * tag không còn được gắn với bất kỳ document nào chưa bị soft-delete.
     * Native SQL để tránh vấn đề JPQL entity comparison với Hibernate.
     */
    @Query(value =
        "SELECT * FROM tags WHERE id IN (:candidateIds) " +
        "AND id NOT IN (" +
        "  SELECT dt.tag_id FROM document_tags dt " +
        "  JOIN documents d ON d.id = dt.document_id " +
        "  WHERE d.deleted_at IS NULL" +
        ")",
        nativeQuery = true)
    List<Tag> findOrphanTagsAmongIds(@Param("candidateIds") Set<Long> candidateIds);
}
