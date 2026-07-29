package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public class CreateSubscriptionPlanRequest {

    private String name;

    @NotNull(message = "Giá không được để trống.")
    @DecimalMin(value = "0.01", message = "Giá gói cước phải lớn hơn 0.")
    private BigDecimal price;

    @Min(value = 1, message = "Số lượng thành viên tối đa không hợp lệ.")
    private short maxRoomMembers;

    @Min(value = 1, message = "Dung lượng mặc định không hợp lệ.")
    private long defaultStorageBytes;

    @Min(value = 0, message = "Giới hạn tạo nhóm không hợp lệ.")
    private int createGroupLimit;

    @Min(value = 1, message = "Giới hạn tham gia nhóm không hợp lệ.")
    private int joinGroupLimit;

    @Min(value = -1, message = "Giới hạn AI chat ngày không hợp lệ.")
    private int dailyAiChatLimit = 5;

    @Min(value = -1, message = "Giới hạn flashcards không hợp lệ.")
    private int maxFlashcards = 5;

    /** BR-110: hạn mức tạo Flashcard bằng AI MỖI NGÀY. -1 = không giới hạn. */
    @Min(value = -1, message = "Giới hạn flashcard AI/ngày không hợp lệ.")
    private int dailyMaxFlashcards = 5;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
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

    public int getDailyAiChatLimit() {
        return dailyAiChatLimit;
    }

    public void setDailyAiChatLimit(int dailyAiChatLimit) {
        this.dailyAiChatLimit = dailyAiChatLimit;
    }

    public int getMaxFlashcards() {
        return maxFlashcards;
    }

    public void setMaxFlashcards(int maxFlashcards) {
        this.maxFlashcards = maxFlashcards;
    }

    public int getDailyMaxFlashcards() {
        return dailyMaxFlashcards;
    }

    public void setDailyMaxFlashcards(int dailyMaxFlashcards) {
        this.dailyMaxFlashcards = dailyMaxFlashcards;
    }
}
