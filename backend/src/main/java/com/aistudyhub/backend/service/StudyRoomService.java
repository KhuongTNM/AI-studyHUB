package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.CreateStudyRoomRequest;
import com.aistudyhub.backend.dto.StudyRoomResponse;
import com.aistudyhub.backend.entity.StudyRoom;
import com.aistudyhub.backend.entity.SubscriptionPlan;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.StudyRoomRepository;
import com.aistudyhub.backend.repository.SubscriptionPlanRepository;
import com.aistudyhub.backend.repository.UserRepository;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StudyRoomService {

    private final StudyRoomRepository studyRoomRepository;
    private final UserRepository userRepository;
    private final SubscriptionPlanRepository subscriptionPlanRepository;

    public StudyRoomService(StudyRoomRepository studyRoomRepository,
                            UserRepository userRepository,
                            SubscriptionPlanRepository subscriptionPlanRepository) {
        this.studyRoomRepository = studyRoomRepository;
        this.userRepository = userRepository;
        this.subscriptionPlanRepository = subscriptionPlanRepository;
    }

    @Transactional
    public StudyRoomResponse createRoom(CreateStudyRoomRequest request) {
        UUID userId = getCurrentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Người dùng không tồn tại."));

        checkCreateRoomPermission(user);

        if (studyRoomRepository.existsByCode(request.getCode())) {
            throw new ApiException(HttpStatus.CONFLICT, "Mã phòng đã tồn tại.");
        }

        String code = request.getCode().toUpperCase();
        String passwordHash = request.getPassword() != null && !request.getPassword().isBlank()
                ? request.getPassword() : null;

        short maxMembers = resolveMaxMembers(user);

        LocalDateTime now = LocalDateTime.now();
        StudyRoom room = new StudyRoom();
        room.setId(UUID.randomUUID());
        room.setCode(code);
        room.setHostId(userId);
        room.setPasswordHash(passwordHash);
        room.setMaxMembers(maxMembers);
        room.setCurrentMemberCount((short) 1);
        room.setActive(true);
        room.setCreatedAt(now);

        return StudyRoomResponse.from(studyRoomRepository.save(room));
    }

    private void checkCreateRoomPermission(User user) {
        if (user.getRole() == User.Role.admin || user.getRole() == User.Role.sub_admin) {
            return;
        }

        Integer planId = user.getSubscriptionPlanId();
        if (planId == null) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn cần gói trả phí để tạo phòng học.");
        }

        LocalDateTime expiresAt = user.getSubscriptionExpiresAt();
        if (expiresAt == null || expiresAt.isBefore(LocalDateTime.now())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Gói subscription của bạn đã hết hạn.");
        }

        SubscriptionPlan plan = subscriptionPlanRepository.findById(planId)
                .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "Bạn cần gói trả phí để tạo phòng học."));

        if (SubscriptionPlan.FREE_PLAN_NAME.equals(plan.getName())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn cần gói trả phí để tạo phòng học.");
        }
    }

    private short resolveMaxMembers(User user) {
        Integer planId = user.getSubscriptionPlanId();
        if (planId == null) return 4;

        return subscriptionPlanRepository.findById(planId)
                .map(SubscriptionPlan::getMaxRoomMembers)
                .orElse((short) 4);
    }

    private UUID getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUserPrincipal principal)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập.");
        }
        return principal.getId();
    }
}
