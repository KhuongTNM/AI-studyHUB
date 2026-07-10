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

    // 2. Tham gia nhóm
    @PostMapping("/join")
    public ResponseEntity<Void> joinGroup(
            @Valid @RequestBody JoinGroupRequest req,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        UUID userId = principal.getId();
        groupService.joinGroup(req, userId);
        return ResponseEntity.ok().build();
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

    // 10. Xóa nhóm (owner)
    @DeleteMapping("/{groupId}")
    public ResponseEntity<Void> deleteGroup(
            @PathVariable UUID groupId,
            @Valid @RequestBody DeleteGroupRequest req,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        UUID userId = principal.getId();
        groupService.deleteGroup(groupId, req, userId);
        return ResponseEntity.noContent().build();
    }

    // 11. Xem mật khẩu nhóm (chỉ Owner mới có quyền)
    @GetMapping("/{groupId}/password")
    public ResponseEntity<String> getGroupPassword(
            @PathVariable UUID groupId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        UUID userId = principal.getId();
        return ResponseEntity.ok(groupService.getGroupPassword(groupId, userId));
    }
}