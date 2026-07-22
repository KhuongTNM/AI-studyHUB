package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.Group;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface GroupRepository extends JpaRepository<Group, UUID> {

    boolean existsByGroupCode(String groupCode);

    Optional<Group> findByGroupCode(String groupCode);

    long countByOwnerId(UUID ownerId);

    // BR-109/BR-111: dùng để so khớp trùng tên trong phạm vi các nhóm của CÙNG
    // một chủ sở hữu. Số lượng nhóm mỗi owner bị giới hạn bởi SubscriptionPlan
    // nên lấy toàn bộ tên rồi so khớp đã chuẩn hoá (BR-110) ở tầng Service.
    @Query("SELECT g.name FROM Group g WHERE g.ownerId = :ownerId")
    List<String> findNamesByOwnerId(@Param("ownerId") UUID ownerId);
}