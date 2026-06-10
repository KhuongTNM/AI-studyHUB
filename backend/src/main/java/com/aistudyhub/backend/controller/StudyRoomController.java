package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.CreateStudyRoomRequest;
import com.aistudyhub.backend.dto.StudyRoomResponse;
import com.aistudyhub.backend.service.StudyRoomService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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

    @PostMapping
    public ResponseEntity<StudyRoomResponse> create(@Valid @RequestBody CreateStudyRoomRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(studyRoomService.createRoom(request));
    }
}
