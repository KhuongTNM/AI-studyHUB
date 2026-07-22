package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.SubscriptionPlan;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SubscriptionPlanRepository extends JpaRepository<SubscriptionPlan, Integer> {

    Optional<SubscriptionPlan> findByNameIgnoreCase(String name);

    boolean existsByName(String name);
    
    boolean existsByNameIgnoreCaseAndIsDeletedFalse(String name);
    
    java.util.List<SubscriptionPlan> findAllByIsDeletedFalse();
}

