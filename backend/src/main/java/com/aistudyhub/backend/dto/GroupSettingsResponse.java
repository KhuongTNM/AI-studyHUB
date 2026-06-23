package com.aistudyhub.backend.dto;

import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupSettingsResponse {

    private UUID groupId;
    private boolean muted;
    private boolean pinned;
}
