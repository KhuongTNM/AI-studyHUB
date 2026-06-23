package com.aistudyhub.backend.dto;

public class UpdateGroupPinRequest {

    private boolean pinned;

    public boolean isPinned() {
        return pinned;
    }

    public void setPinned(boolean pinned) {
        this.pinned = pinned;
    }
}
