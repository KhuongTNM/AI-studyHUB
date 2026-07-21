package com.aistudyhub.backend.exception;

import org.springframework.http.HttpStatus;

public class PlanAlreadyExistsException extends ApiException {
    public PlanAlreadyExistsException(String message) {
        super(HttpStatus.BAD_REQUEST, message);
    }
}

