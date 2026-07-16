package com.aistudyhub.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.aistudyhub.backend.dto.FlashcardResponse;
import com.aistudyhub.backend.dto.GenerateFlashcardsRequest;
import com.aistudyhub.backend.entity.Document;
import com.aistudyhub.backend.entity.Flashcard;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.DocumentRepository;
import com.aistudyhub.backend.repository.FlashcardRepository;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

@ExtendWith(MockitoExtension.class)
public class FlashcardServiceTest {

    @Mock
    private FlashcardRepository flashcardRepository;

    @Mock
    private DocumentRepository documentRepository;

    @Mock
    private RestTemplate aiServiceRestTemplate;

    private FlashcardService flashcardService;

    private UUID userId;
    private UUID documentId;
    private Document document;

    @BeforeEach
    void setUp() {
        flashcardService = new FlashcardService(
                flashcardRepository,
                documentRepository,
                aiServiceRestTemplate,
                "http://localhost:8000"
        );

        userId = UUID.randomUUID();
        documentId = UUID.randomUUID();

        document = new Document();
        document.setId(documentId);
        document.setUserId(userId);
        document.setEmbeddingStatus("done");

        // Mock SecurityContext for getCurrentUserId()
        AuthUserPrincipal principal = mock(AuthUserPrincipal.class);
        when(principal.getId()).thenReturn(userId);
        
        Authentication authentication = mock(Authentication.class);
        when(authentication.getPrincipal()).thenReturn(principal);
        
        SecurityContext securityContext = mock(SecurityContext.class);
        when(securityContext.getAuthentication()).thenReturn(authentication);
        SecurityContextHolder.setContext(securityContext);
    }

    @Test
    void testGenerateFlashcards_SuccessfulGeneration() {
        // Test Case 1: Successful Generation
        GenerateFlashcardsRequest request = new GenerateFlashcardsRequest();
        request.setDocumentId(documentId);
        request.setCount(2);

        when(documentRepository.findById(documentId)).thenReturn(Optional.of(document));

        FlashcardService.FlashcardItem[] mockItems = new FlashcardService.FlashcardItem[1];
        mockItems[0] = new FlashcardService.FlashcardItem();
        mockItems[0].setQuestion("Q1");
        mockItems[0].setAnswer("A1");

        ResponseEntity<FlashcardService.FlashcardItem[]> responseEntity = 
            new ResponseEntity<>(mockItems, HttpStatus.OK);
            
        when(aiServiceRestTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(FlashcardService.FlashcardItem[].class)))
                .thenReturn(responseEntity);

        when(flashcardRepository.saveAll(anyList())).thenAnswer(invocation -> {
            List<Flashcard> cards = invocation.getArgument(0);
            cards.forEach(card -> card.setId(UUID.randomUUID())); // Simulate DB assigning ID
            return cards;
        });

        List<FlashcardResponse> result = flashcardService.generateFlashcards(request);

        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals("Q1", result.get(0).getQuestion());
        assertEquals("A1", result.get(0).getAnswer());
        assertTrue(result.get(0).isAiGenerated());
        
        verify(flashcardRepository).saveAll(argThat(iterable -> {
            Flashcard card = iterable.iterator().next();
            return card.isAiGenerated() && card.getDocumentId().equals(documentId);
        }));
    }

    @Test
    void testGenerateFlashcards_AiMicroserviceFailure() {
        // Test Case 2: AI Microservice Failure/Timeout
        GenerateFlashcardsRequest request = new GenerateFlashcardsRequest();
        request.setDocumentId(documentId);

        when(documentRepository.findById(documentId)).thenReturn(Optional.of(document));

        when(aiServiceRestTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(FlashcardService.FlashcardItem[].class)))
                .thenThrow(new RestClientException("Connection Timeout"));

        ApiException exception = assertThrows(ApiException.class, () -> {
            flashcardService.generateFlashcards(request);
        });

        assertEquals(HttpStatus.BAD_GATEWAY, exception.getStatus());
        assertEquals("AI service unavailable. Please try later.", exception.getMessage());
    }

    @Test
    void testGenerateFlashcards_SecurityAccessControl_Forbidden() {
        // Test Case 3: Security & Access Control (RBAC)
        GenerateFlashcardsRequest request = new GenerateFlashcardsRequest();
        request.setDocumentId(documentId);

        // Document owned by a DIFFERENT user
        Document docOtherUser = new Document();
        docOtherUser.setId(documentId);
        docOtherUser.setUserId(UUID.randomUUID()); // Not matching the logged-in userId
        docOtherUser.setEmbeddingStatus("done");

        when(documentRepository.findById(documentId)).thenReturn(Optional.of(docOtherUser));

        ApiException exception = assertThrows(ApiException.class, () -> {
            flashcardService.generateFlashcards(request);
        });

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatus());
        assertEquals("You don't own this document", exception.getMessage());
        
        // Assert no call is made to AI service
        verifyNoInteractions(aiServiceRestTemplate);
    }

    @Test
    void testGenerateFlashcards_InvalidProcessingState() {
        // Test Case 4: Invalid Processing State
        GenerateFlashcardsRequest request = new GenerateFlashcardsRequest();
        request.setDocumentId(documentId);

        // Document is still processing
        document.setEmbeddingStatus("processing");
        when(documentRepository.findById(documentId)).thenReturn(Optional.of(document));

        ApiException exception = assertThrows(ApiException.class, () -> {
            flashcardService.generateFlashcards(request);
        });

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatus());
        assertEquals("Document not processed yet. Please try later.", exception.getMessage());
        
        // Assert no call is made to AI service
        verifyNoInteractions(aiServiceRestTemplate);
    }
}
