package com.scm.service;

import com.scm.common.error.BadRequestException;
import com.scm.common.error.ForbiddenException;
import com.scm.common.error.UnauthorizedException;
import com.scm.common.error.UnprocessableEntityException;
import com.scm.common.security.JwtTokenProvider;
import com.scm.entity.User;
import com.scm.repository.UserRepository;
import io.jsonwebtoken.Claims;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final HttpClient httpClient;

    @Value("${notification.service.url:http://localhost:8084}")
    private String notificationServiceUrl;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider jwtTokenProvider) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
    }

    @Transactional
    public Map<String, Object> registerUser(Map<String, Object> payload) {
        String name = (String) payload.get("name");
        String email = (String) payload.get("email");
        String password = (String) payload.get("password");
        String phoneNumber = (String) payload.getOrDefault("phoneNumber", "+14155552671");
        String requestedRole = (String) payload.getOrDefault("role", "ROLE_USER");

        if (name == null || name.isBlank() || email == null || email.isBlank() || password == null || password.length() < 6) {
            throw new UnprocessableEntityException("Name, valid email, and password (min 6 chars) are required.");
        }
        if (!email.contains("@")) {
            throw new UnprocessableEntityException("Invalid email format.");
        }
        if (userRepository.existsByEmail(email)) {
            throw new UnprocessableEntityException("A user with email '" + email + "' already exists.");
        }

        User user = new User();
        user.setName(name.trim());
        user.setEmail(email.trim().toLowerCase());
        user.setPassword(passwordEncoder.encode(password));
        user.setPhoneNumber(phoneNumber);
        user.setProvider("LOCAL");
        user.setRoles("ROLE_ADMIN".equalsIgnoreCase(requestedRole) ? "ROLE_USER,ROLE_ADMIN" : "ROLE_USER");
        user = userRepository.save(user);

        dispatchAsyncWelcomeEmailSafely(user.getEmail(), user.getName());

        List<String> roles = Arrays.asList(user.getRoles().split(","));
        String token = jwtTokenProvider.generateToken(user.getId(), user.getEmail(), user.getName(), roles);

        return buildTokenEnvelope(user, token, roles);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> issueToken(Map<String, Object> credentials) {
        String email = (String) credentials.get("email");
        String password = (String) credentials.get("password");

        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            throw new BadRequestException("Email and password are required to issue a token.");
        }

        User user = userRepository.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new UnauthorizedException("No account found with this email. Please sign up first."));

        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new UnauthorizedException("Invalid email or password credentials.");
        }

        List<String> roles = Arrays.asList(user.getRoles().split(","));
        String token = jwtTokenProvider.generateToken(user.getId(), user.getEmail(), user.getName(), roles);

        return buildTokenEnvelope(user, token, roles);
    }

    public Map<String, Object> inspectToken(String authHeader) {
        String token = extractBearerToken(authHeader);
        try {
            Claims claims = jwtTokenProvider.validateAndParseClaims(token);
            Map<String, Object> info = new LinkedHashMap<>();
            info.put("userId", claims.get("userId"));
            info.put("email", claims.getSubject());
            info.put("name", claims.get("name"));
            info.put("roles", jwtTokenProvider.extractRoles(token));
            info.put("valid", true);
            return info;
        } catch (Exception ex) {
            throw new UnauthorizedException("Invalid or expired Bearer JWT token.");
        }
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listAllUsersForAdmin(String authHeader) {
        String token = extractBearerToken(authHeader);
        List<String> roles;
        try {
            roles = jwtTokenProvider.extractRoles(token);
        } catch (Exception ex) {
            throw new UnauthorizedException("Invalid or expired Bearer JWT token.");
        }
        if (!roles.contains("ROLE_ADMIN")) {
            throw new ForbiddenException("Access denied: ROLE_ADMIN authority is required.");
        }
        return userRepository.findAll().stream().map(u -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", u.getId());
            m.put("name", u.getName());
            m.put("email", u.getEmail());
            m.put("roles", Arrays.asList(u.getRoles().split(",")));
            m.put("provider", u.getProvider());
            m.put("createdAt", u.getCreatedAt());
            return m;
        }).toList();
    }

    @Transactional
    public Map<String, Object> exchangeGoogleOAuthToken(Map<String, Object> payload) {
        String email = ((String) payload.getOrDefault("email", "")).trim().toLowerCase();
        String name = (String) payload.getOrDefault("name", "Google User");
        String googleId = (String) payload.getOrDefault("googleId", "google-oidc-sub-1001");
        String intent = (String) payload.getOrDefault("intent", "login");

        if (email.isBlank()) {
            throw new BadRequestException("Email is required for Google authentication.");
        }

        boolean exists = userRepository.existsByEmail(email);
        if (!"signup".equalsIgnoreCase(intent) && !exists) {
            throw new UnauthorizedException("No account found with this email. Please sign up first.");
        }

        User user = userRepository.findByEmail(email).orElseGet(() -> {
            User created = new User();
            created.setName(name);
            created.setEmail(email);
            created.setPassword(passwordEncoder.encode("oauth2-" + googleId));
            created.setProvider("GOOGLE");
            created.setProviderId(googleId);
            created.setRoles("ROLE_USER");
            return userRepository.save(created);
        });

        if (!exists || "signup".equalsIgnoreCase(intent)) {
            dispatchAsyncWelcomeEmailSafely(user.getEmail(), user.getName());
        }

        List<String> roles = Arrays.asList(user.getRoles().split(","));
        String token = jwtTokenProvider.generateToken(user.getId(), user.getEmail(), user.getName(), roles);
        return buildTokenEnvelope(user, token, roles);
    }

    @Transactional
    public Map<String, Object> exchangeGithubOAuthToken(Map<String, Object> payload) {
        String email = ((String) payload.getOrDefault("email", "")).trim().toLowerCase();
        String name = (String) payload.getOrDefault("name", "GitHub OAuth User");
        String githubId = (String) payload.getOrDefault("githubId", "github-oauth-sub-2001");
        String intent = (String) payload.getOrDefault("intent", "login");

        if (email.isBlank()) {
            throw new BadRequestException("Email is required for GitHub authentication.");
        }

        boolean exists = userRepository.existsByEmail(email);
        if (!"signup".equalsIgnoreCase(intent) && !exists) {
            throw new UnauthorizedException("No account found with this email. Please sign up first.");
        }

        User user = userRepository.findByEmail(email).orElseGet(() -> {
            User created = new User();
            created.setName(name);
            created.setEmail(email);
            created.setPassword(passwordEncoder.encode("oauth2-" + githubId));
            created.setProvider("GITHUB");
            created.setProviderId(githubId);
            created.setRoles("ROLE_USER");
            return userRepository.save(created);
        });

        if (!exists || "signup".equalsIgnoreCase(intent)) {
            dispatchAsyncWelcomeEmailSafely(user.getEmail(), user.getName());
        }

        List<String> roles = Arrays.asList(user.getRoles().split(","));
        String token = jwtTokenProvider.generateToken(user.getId(), user.getEmail(), user.getName(), roles);
        return buildTokenEnvelope(user, token, roles);
    }

    private String extractBearerToken(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new UnauthorizedException("Missing or malformed Authorization: Bearer <token> header.");
        }
        return authHeader.substring(7).trim();
    }

    private Map<String, Object> buildTokenEnvelope(User user, String token, List<String> roles) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("accessToken", token);
        response.put("tokenType", "Bearer");
        response.put("expiresInMs", jwtTokenProvider.getExpirationMs());
        Map<String, Object> userMap = new LinkedHashMap<>();
        userMap.put("id", user.getId());
        userMap.put("name", user.getName());
        userMap.put("email", user.getEmail());
        userMap.put("phoneNumber", user.getPhoneNumber());
        userMap.put("provider", user.getProvider());
        userMap.put("roles", roles);
        response.put("user", userMap);
        return response;
    }

    /**
     * Resilient Mail Dispatching Mandate: Wrapped in try-catch with 3s timeout so SMTP or network
     * errors never block user registration or login.
     */
    private void dispatchAsyncWelcomeEmailSafely(String email, String name) {
        try {
            String jsonBody = String.format(
                    "{\"to\":\"%s\",\"type\":\"WELCOME\",\"subject\":\"Welcome to Smart Contact Manager\",\"name\":\"%s\"}",
                    email, name
            );
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(notificationServiceUrl + "/v1/notifications/emails"))
                    .timeout(Duration.ofSeconds(3))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();
            httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                    .exceptionally(ex -> {
                        log.warn("Non-blocking notification dispatch fallback for {}: {}", email, ex.getMessage());
                        return null;
                    });
        } catch (Exception ex) {
            log.warn("Resilient mail dispatch caught exception for {}: {}", email, ex.getMessage());
        }
    }
}
