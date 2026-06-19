package com.aistudyhub.backend.dto;

import com.aistudyhub.backend.entity.User;

public class StorageUsageResponse {

    private long limit;
    private long used;
    private int percent;
    private boolean nearFull;
    private String warningMessage;

    public static StorageUsageResponse from(User user) {
        StorageUsageResponse res = new StorageUsageResponse();
        res.limit = user.getStorageLimitBytes();
        res.used = user.getStorageUsedBytes();
        res.percent = user.getStorageLimitBytes() > 0
                ? (int) (user.getStorageUsedBytes() * 100 / user.getStorageLimitBytes())
                : 0;
        res.nearFull = res.percent >= 80;
        if (res.nearFull) {
            res.warningMessage = "Dung lượng lưu trữ gần đầy. Vui lòng xóa bớt file hoặc nâng cấp gói.";
        }
        return res;
    }

    public long getLimit() {
        return limit;
    }

    public long getUsed() {
        return used;
    }

    public int getPercent() {
        return percent;
    }

    public boolean isNearFull() {
        return nearFull;
    }

    public String getWarningMessage() {
        return warningMessage;
    }
}
