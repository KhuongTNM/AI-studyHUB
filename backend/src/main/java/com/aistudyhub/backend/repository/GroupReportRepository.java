package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.GroupReport;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GroupReportRepository extends JpaRepository<GroupReport, UUID> {

    List<GroupReport> findByGroupId(UUID groupId);

    boolean existsByGroupIdAndReporterId(UUID groupId, UUID reporterId);
}
