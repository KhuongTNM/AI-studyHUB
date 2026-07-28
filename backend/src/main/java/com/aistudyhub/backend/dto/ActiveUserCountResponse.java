package com.aistudyhub.backend.dto;

/** GET /api/admin/subscription-plans/{planName}/active-user-count — SUB-201/SUB-302. */
public class ActiveUserCountResponse {

    private long activeUserCount;

    public ActiveUserCountResponse(long activeUserCount) {
        this.activeUserCount = activeUserCount;
    }

    public long getActiveUserCount() {
        return activeUserCount;
    }

    public void setActiveUserCount(long activeUserCount) {
        this.activeUserCount = activeUserCount;
    }
}
