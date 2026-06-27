package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.SubscriptionPlan;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SubscriptionPlanRepository extends JpaRepository<SubscriptionPlan, Integer> {

    Optional<SubscriptionPlan> findByName(String name);

    boolean existsByDisplayName(String displayName);

    boolean existsByName(String name);
}
