package com.aistudyhub.backend.exception;

public class MaxGroupsLimitExceededException extends RuntimeException {
    public MaxGroupsLimitExceededException(String message) {
        super(message);
    }
}
