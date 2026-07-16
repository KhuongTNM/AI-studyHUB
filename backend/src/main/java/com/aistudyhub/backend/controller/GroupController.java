package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.GroupMemberResponse;
import com.aistudyhub.backend.dto.GroupResponse;
import com.aistudyhub.backend.dto.GroupSettingsResponse;
import com.aistudyhub.backend.dto.request.*;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import com.aistudyhub.backend.service.GroupService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groupService;

    // 1. Tạo nhóm
    @PostMapping
    public ResponseEntity<GroupResponse> createGroup(
            @Valid @RequestBody CreateGroupRequest req,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        UUID userId = principal.getId();
        return new ResponseEntity<>(groupService.createGroup(req, userId), HttpStatus.CREATED);
    }

    // 3. Danh sách nhóm đang tham gia
    @GetMapping
    public ResponseEntity<List<GroupResponse>> listMyGroups(
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        UUID userId = principal.getId();
        return ResponseEntity.ok(groupService.listMyGroups(userId));
    }

    // 4. Chi tiết nhóm
    @GetMapping("/{groupId}")
    public ResponseEntity<GroupResponse> getGroupDetail(
            @PathVariable UUID groupId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        UUID userId = principal.getId();
        return ResponseEntity.ok(groupService.getGroupDetail(groupId, userId));
    }

    // 5. Danh sách thành viên
    @GetMapping("/{groupId}/members")
    public ResponseEntity<List<GroupMemberResponse>> getMembers(
            @PathVariable UUID groupId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        UUID userId = principal.getId();
        // Lưu ý: Service định nghĩa getMembers(userId, groupId) - trước đây bị
        // truyền ngược (groupId, userId) khiến 2 giá trị bị hoán đổi khi xuống Service.
        return ResponseEntity.ok(groupService.getMembers(userId, groupId));
    }

    // 6. Cài đặt cá nhân
    @GetMapping("/{groupId}/settings")
    public ResponseEntity<GroupSettingsResponse> getSettings(
            @PathVariable UUID groupId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        UUID userId = principal.getId();
        return ResponseEntity.ok(groupService.getSettings(userId, groupId));
    }

    // 7. Mute / Unmute
    @PatchMapping("/{groupId}/settings/mute")
    public ResponseEntity<GroupSettingsResponse> updateMute(
            @PathVariable UUID groupId,
            @Valid @RequestBody MuteGroupRequest req,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        UUID userId = principal.getId();
        return ResponseEntity.ok(groupService.updateMute(userId, groupId, req));
    }

    // 8. Pin / Unpin
    @PatchMapping("/{groupId}/settings/pin")
    public ResponseEntity<GroupSettingsResponse> updatePin(
            @PathVariable UUID groupId,
            @Valid @RequestBody PinGroupRequest req,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        UUID userId = principal.getId();
        return ResponseEntity.ok(groupService.updatePin(userId, groupId, req));
    }

    // 9. Rời nhóm
    @DeleteMapping("/{groupId}/members/me")
    public ResponseEntity<Void> leaveGroup(
            @PathVariable UUID groupId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        UUID userId = principal.getId();
        groupService.leaveGroup(groupId, userId);
        return ResponseEntity.noContent().build();
    }

    // 10. Xóa nhóm (owner) - chỉ cần JWT hợp lệ + đúng quyền Owner, không còn yêu cầu mật khẩu.
    // Lưu ý: bước xác nhận "Bạn có chắc muốn xóa nhóm?" nên được xử lý ở Frontend (dialog confirm).
    @DeleteMapping("/{groupId}")
    public ResponseEntity<Void> deleteGroup(
            @PathVariable UUID groupId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        UUID userId = principal.getId();
        groupService.deleteGroup(groupId, userId);
        return ResponseEntity.noContent().build();
    }

    // 11. Kick thành viên (chỉ Owner mới có quyền) - không còn yêu cầu mật khẩu nhóm.
    // Lưu ý: bước xác nhận "Bạn có chắc muốn xóa thành viên này?" nên được xử lý ở Frontend (dialog confirm).
    @DeleteMapping("/{groupId}/members/{targetUserId}")
    public ResponseEntity<Void> kickMember(
            @PathVariable UUID groupId,
            @PathVariable UUID targetUserId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        UUID operatorId = principal.getId();
        groupService.kickMember(groupId, targetUserId, operatorId);
        return ResponseEntity.noContent().build();
    }

    // ==========================================
    // 13-16. MỜI THÀNH VIÊN THAM GIA NHÓM QUA EMAIL
    // ==========================================

    // 13. Tìm kiếm User theo Email trước khi mời (để xác nhận đúng người)
    @GetMapping("/{groupId}/invitations/search")
    public ResponseEntity<GroupMemberResponse> searchUserForInvitation(
            @PathVariable UUID groupId,
            @RequestParam String email,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        UUID userId = principal.getId();
        return ResponseEntity.ok(groupService.searchUserForInvitation(groupId, email, userId));
    }

    // 14. Gửi lời mời tham gia nhóm qua Email (chỉ Chủ nhóm)
    @PostMapping("/{groupId}/invitations")
    public ResponseEntity<Void> inviteMemberByEmail(
            @PathVariable UUID groupId,
            @RequestParam String email,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        UUID operatorId = principal.getId();
        groupService.inviteMemberByEmail(groupId, email, operatorId);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    // 15. Danh sách lời mời đang chờ xử lý của chính User hiện tại
    @GetMapping("/invitations/pending")
    public ResponseEntity<List<GroupResponse>> getMyPendingInvitations(
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        UUID userId = principal.getId();
        return ResponseEntity.ok(groupService.getMyPendingInvitations(userId));
    }

    // 16. Phản hồi lời mời (Chấp nhận / Từ chối)
    @PostMapping("/{groupId}/invitations/respond")
    public ResponseEntity<Void> handleInvitation(
            @PathVariable UUID groupId,
            @RequestParam boolean accept,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        UUID userId = principal.getId();
        groupService.handleInvitation(groupId, userId, accept);
        return ResponseEntity.ok().build();
    }
}