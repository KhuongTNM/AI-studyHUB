package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class CreateStudyRoomRequest {

    @NotBlank(message = "Mã phòng không được để trống.")
    @Size(min = 4, max = 20, message = "Mã phòng phải từ 4-20 ký tự.")
    private String roomCode;

    @Size(max = 255, message = "Mật khẩu không được vượt quá 255 ký tự.")
    private String password;

    public String getRoomCode() { return roomCode; }
    public void setRoomCode(String roomCode) { this.roomCode = roomCode; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}
