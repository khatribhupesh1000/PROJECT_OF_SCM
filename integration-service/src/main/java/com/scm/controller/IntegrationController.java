package com.scm.controller;

import com.scm.service.SoapIntegrationService;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/v1")
public class IntegrationController {

    private final SoapIntegrationService soapIntegrationService;

    public IntegrationController(SoapIntegrationService soapIntegrationService) {
        this.soapIntegrationService = soapIntegrationService;
    }

    @GetMapping(value = "/soap/wsdl", produces = MediaType.TEXT_XML_VALUE)
    public ResponseEntity<String> getWsdlDocument() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(300, TimeUnit.SECONDS).cachePublic().mustRevalidate())
                .body(SoapIntegrationService.TELECOM_WSDL_XML);
    }

    @GetMapping("/soap/metadata")
    public ResponseEntity<Map<String, Object>> getWsdlMetadata() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(300, TimeUnit.SECONDS).cachePublic().mustRevalidate())
                .body(soapIntegrationService.parseWsdlMetadata());
    }

    @PostMapping("/soap/execute")
    public ResponseEntity<Map<String, Object>> executeSoapRequest(
            @RequestBody Map<String, Object> payload,
            @RequestHeader(value = "SOAPAction", required = false) String soapAction) {
        Map<String, Object> response = soapIntegrationService.executeSoapCall(payload, soapAction);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/resilience/status")
    public ResponseEntity<Map<String, Object>> getCircuitBreakerStatus() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noCache())
                .body(soapIntegrationService.getResilienceStatus());
    }

    @PostMapping("/resilience/state")
    public ResponseEntity<Map<String, Object>> updateCircuitBreakerState(@RequestBody Map<String, Object> body) {
        String state = body != null && body.get("state") != null ? String.valueOf(body.get("state")) : "CLOSED";
        return ResponseEntity.ok(soapIntegrationService.transitionCircuitBreaker(state));
    }
}
