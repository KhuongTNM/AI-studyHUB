package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.CreateStudyRoomRequest;
import com.aistudyhub.backend.dto.JoinStudyRoomRequest;
import com.aistudyhub.backend.dto.SendStudyRoomMessageRequest;
import com.aistudyhub.backend.dto.ShareRoomDocumentRequest;
import com.aistudyhub.backend.dto.StudyRoomResponse;
import com.aistudyhub.backend.service.StudyRoomService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/study-rooms")
public class StudyRoomController {

    private final StudyRoomService studyRoomService;

    public StudyRoomController(StudyRoomService studyRoomService) {
        this.studyRoomService = studyRoomService;
    }

    @GetMapping
    public ResponseEntity<List<StudyRoomResponse>> list() {
        return ResponseEntity.ok(studyRoomService.listActiveRooms());
    }

    @GetMapping("/{code}")
    public ResponseEntity<StudyRoomResponse> get(@PathVariable String code) {
        return ResponseEntity.ok(studyRoomService.getRoom(code));
    }

    @PostMapping
    public ResponseEntity<StudyRoomResponse> create(@Valid @RequestBody CreateStudyRoomRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(studyRoomService.createRoom(request));
    }

    @PostMapping("/{code}/join")
    public ResponseEntity<StudyRoomResponse> join(
            @PathVariable String code,
            @RequestBody(required = false) JoinStudyRoomRequest request) {
        return ResponseEntity.ok(studyRoomService.joinRoom(code, request));
    }

    @PostMapping("/{code}/leave")
    public ResponseEntity<StudyRoomResponse> leave(@PathVariable String code) {
        return ResponseEntity.ok(studyRoomService.leaveRoom(code));
    }

    @PostMapping("/{code}/messages")
    public ResponseEntity<StudyRoomResponse> sendMessage(
            @PathVariable String code,
            @Valid @RequestBody SendStudyRoomMessageRequest request) {
        return ResponseEntity.ok(studyRoomService.sendMessage(code, request));
    }

    @PostMapping("/{code}/share-document")
    public ResponseEntity<StudyRoomResponse> shareDocument(
            @PathVariable String code,
            @Valid @RequestBody ShareRoomDocumentRequest request) {
        return ResponseEntity.ok(studyRoomService.shareDocument(code, request));
    }
}
