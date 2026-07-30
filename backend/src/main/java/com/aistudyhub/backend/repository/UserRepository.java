package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.User;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    List<User> findAllByOrderByCreatedAtDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> findByIdForUpdate(@Param("id") UUID id);

    /**
     * BR-101: khoá bản ghi User theo email (nếu tồn tại) để 2 request đăng ký cùng email
     * không thể đồng thời cùng đọc rồi ghi đè chồng chéo lên nhau (race condition ở TH2).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where lower(u.email) = lower(:email)")
    Optional<User> findByEmailIgnoreCaseForUpdate(@Param("email") String email);

    boolean existsBySubscriptionPlanId(Integer subscriptionPlanId);

    /**
     * Đếm số User đang thực sự gán gói này qua cột legacy core.users.subscription_plan_id.
     * Dùng riêng cho gói Free trong getActiveUserCount() — Free không bao giờ có bản ghi trong
     * payment.subscriptions (GAP-T1), nên đếm theo bảng subscriptions sẽ luôn ra 0 cho Free dù
     * thực tế có bao nhiêu User đang dùng.
     */
    long countBySubscriptionPlanId(Integer subscriptionPlanId);
}
