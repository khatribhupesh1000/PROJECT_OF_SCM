package com.scm.controller;

import com.scm.common.error.BadRequestException;
import com.scm.dto.ContactParsedDto;
import com.scm.dto.DraftEmailRequest;
import com.scm.dto.DraftEmailResponse;
import com.scm.dto.ParseContactRequest;
import com.scm.service.AiService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/ai")
public class AiController {

    private final AiService aiService;

    public AiController(AiService aiService) {
        this.aiService = aiService;
    }

    @PostMapping("/parse-contact")
    public ResponseEntity<ContactParsedDto> parseContact(@RequestBody(required = false) ParseContactRequest request) {
        if (request == null || request.getRawText() == null || request.getRawText().trim().isEmpty()) {
            throw new BadRequestException("Request body must include a non-empty 'rawText' field.");
        }
        ContactParsedDto parsed = aiService.parseContact(request.getRawText().trim());
        return ResponseEntity.ok(parsed);
    }

    @PostMapping("/draft-email")
    public ResponseEntity<DraftEmailResponse> draftEmail(@RequestBody(required = false) DraftEmailRequest request) {
        if (request == null || request.getPrompt() == null || request.getPrompt().trim().isEmpty()) {
            throw new BadRequestException("Request body must include a non-empty 'prompt' field.");
        }
        DraftEmailResponse draft = aiService.draftEmail(request);
        return ResponseEntity.ok(draft);
    }
}
