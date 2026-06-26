package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class UpdateSubscriptionPlanRequest {

    @NotBlank(message = "Tên gói không được để trống.")
    @Size(max = 50, message = "Tên gói không được vượt quá 50 ký tự.")
    private String displayName;

    @Min(value = 1, message = "Số lượng thành viên tối đa không hợp lệ.")
    private short maxRoomMembers;

    @Min(value = 1, message = "Dung lượng mặc định không hợp lệ.")
    private long defaultStorageBytes;

    @Min(value = 0, message = "Giới hạn tạo nhóm không hợp lệ.")
    private int createGroupLimit;

    @Min(value = 1, message = "Giới hạn tham gia nhóm không hợp lệ.")
    private int joinGroupLimit;

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public short getMaxRoomMembers() {
        return maxRoomMembers;
    }

    public void setMaxRoomMembers(short maxRoomMembers) {
        this.maxRoomMembers = maxRoomMembers;
    }

    public long getDefaultStorageBytes() {
        return defaultStorageBytes;
    }

    public void setDefaultStorageBytes(long defaultStorageBytes) {
        this.defaultStorageBytes = defaultStorageBytes;
    }

    public int getCreateGroupLimit() {
        return createGroupLimit;
    }

    public void setCreateGroupLimit(int createGroupLimit) {
        this.createGroupLimit = createGroupLimit;
    }

    public int getJoinGroupLimit() {
        return joinGroupLimit;
    }

    public void setJoinGroupLimit(int joinGroupLimit) {
        this.joinGroupLimit = joinGroupLimit;
    }
}
