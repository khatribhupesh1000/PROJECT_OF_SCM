package com.scm.controller;

import com.scm.service.AuthService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/v1/auth")
public class AuthController {

    private final AuthService authService;

    @Value("${google.oauth2.client-id:google-client-id-placeholder}")
    private String googleClientId;

    @Value("${google.oauth2.redirect-uri:http://localhost:8081/login/oauth2/code/google}")
    private String googleRedirectUri;

    @Value("${github.oauth2.client-id:Ov23liScmGithubOAuthClientId}")
    private String githubClientId;

    @Value("${github.oauth2.redirect-uri:http://localhost:3000/login}")
    private String githubRedirectUri;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/users")
    public ResponseEntity<Map<String, Object>> registerUser(@RequestBody Map<String, Object> payload) {
        Map<String, Object> created = authService.registerUser(payload);
        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) created.get("user");
        String userId = user != null ? String.valueOf(user.get("id")) : "usr-new";
        return ResponseEntity.status(HttpStatus.CREATED)
                .location(URI.create("/v1/auth/users/" + userId))
                .body(created);
    }

    @PostMapping("/tokens")
    public ResponseEntity<Map<String, Object>> issueToken(@RequestBody Map<String, Object> credentials) {
        Map<String, Object> tokenEnvelope = authService.issueToken(credentials);
        return ResponseEntity.status(HttpStatus.CREATED)
                .location(URI.create("/v1/auth/tokens/me"))
                .body(tokenEnvelope);
    }

    @GetMapping("/tokens/me")
    public ResponseEntity<Map<String, Object>> inspectCurrentToken(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authHeader) {
        Map<String, Object> info = authService.inspectToken(authHeader);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(60, TimeUnit.SECONDS).cachePrivate().mustRevalidate())
                .body(info);
    }

    @DeleteMapping("/tokens")
    public ResponseEntity<Void> revokeToken() {
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/oauth2/google")
    public ResponseEntity<Void> redirectToGoogleOAuth2() {
        String googleAuthUrl = "https://accounts.google.com/o/oauth2/v2/auth?client_id="
                + googleClientId
                + "&redirect_uri=" + googleRedirectUri
                + "&response_type=code&scope=openid%20profile%20email&prompt=select_account&access_type=offline";
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(googleAuthUrl))
                .build();
    }

    @PostMapping({"/oauth2/google/tokens", "/oauth2/google/signup"})
    public ResponseEntity<Map<String, Object>> exchangeGoogleToken(@RequestBody Map<String, Object> payload) {
        Map<String, Object> tokenEnvelope = authService.exchangeGoogleOAuthToken(payload);
        return ResponseEntity.status(HttpStatus.CREATED).body(tokenEnvelope);
    }

    @GetMapping("/oauth2/github")
    public ResponseEntity<Void> redirectToGithubOAuth2() {
        String githubAuthUrl = "https://github.com/login/oauth/authorize?client_id="
                + githubClientId
                + "&redirect_uri=" + githubRedirectUri
                + "&scope=read:user,user:email";
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(githubAuthUrl))
                .build();
    }

    @PostMapping({"/oauth2/github/tokens", "/oauth2/github/signup"})
    public ResponseEntity<Map<String, Object>> exchangeGithubToken(@RequestBody Map<String, Object> payload) {
        Map<String, Object> tokenEnvelope = authService.exchangeGithubOAuthToken(payload);
        return ResponseEntity.status(HttpStatus.CREATED).body(tokenEnvelope);
    }

    @GetMapping("/admin/users")
    public ResponseEntity<List<Map<String, Object>>> listAllUsersForAdmin(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authHeader) {
        List<Map<String, Object>> users = authService.listAllUsersForAdmin(authHeader);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(60, TimeUnit.SECONDS).cachePrivate().mustRevalidate())
                .body(users);
    }
}
