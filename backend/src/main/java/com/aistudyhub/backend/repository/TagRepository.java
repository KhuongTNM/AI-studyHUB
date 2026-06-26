package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.Tag;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TagRepository extends JpaRepository<Tag, Long> {

    Optional<Tag> findByName(String name);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(value = "DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM document_tags)", nativeQuery = true)
    void deleteOrphanTags();
}
