package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.UploadSettings;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UploadSettingsRepository extends JpaRepository<UploadSettings, Short> {
}
