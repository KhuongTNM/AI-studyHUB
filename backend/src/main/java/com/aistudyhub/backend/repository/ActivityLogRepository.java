package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.ActivityLog;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ActivityLogRepository extends JpaRepository<ActivityLog, UUID> {
}
