package com.aistudyhub.backend.dto;

import java.util.Map;

public class VietQrTransactionSyncResponse {

    private final boolean error;
    private final String errorReason;
    private final String toastMessage;
    private final Map<String, String> object;

    public VietQrTransactionSyncResponse(boolean error, String errorReason, String toastMessage, String reftransactionid) {
        this.error = error;
        this.errorReason = errorReason;
        this.toastMessage = toastMessage;
        this.object = Map.of("reftransactionid", reftransactionid == null ? "" : reftransactionid);
    }

    public boolean isError() {
        return error;
    }

    public String getErrorReason() {
        return errorReason;
    }

    public String getToastMessage() {
        return toastMessage;
    }

    public Map<String, String> getObject() {
        return object;
    }
}
