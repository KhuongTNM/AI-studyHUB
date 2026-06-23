package com.aistudyhub.backend.dto;

public class UpdateGroupMuteRequest {

    private boolean muted;

    public boolean isMuted() {
        return muted;
    }

    public void setMuted(boolean muted) {
        this.muted = muted;
    }
}
