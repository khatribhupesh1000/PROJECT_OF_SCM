package com.scm.common.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.Map;

/**
 * Stateless HMAC-SHA256 JWT token issuer and validator using jjwt 0.12.5 (Checklist #24).
 */
public class JwtTokenProvider {

    private static final String DEFAULT_SECRET = "ScmEnterpriseHmacSha256SuperSecretSigningKeyForJwtTokens2026!@#";
    private final SecretKey secretKey;
    private final long expirationMs;

    public JwtTokenProvider() {
        this(DEFAULT_SECRET, 86_400_000L);
    }

    public JwtTokenProvider(String secret, long expirationMs) {
        String effectiveSecret = (secret == null || secret.length() < 32) ? DEFAULT_SECRET : secret;
        this.secretKey = Keys.hmacShaKeyFor(effectiveSecret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    public String generateToken(String userId, String email, String name, List<String> roles) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);
        return Jwts.builder()
                .subject(email)
                .claims(Map.of(
                        "userId", userId,
                        "email", email,
                        "name", name != null ? name : "",
                        "roles", roles != null ? roles : List.of("ROLE_USER")
                ))
                .issuedAt(now)
                .expiration(expiry)
                .signWith(secretKey, Jwts.SIG.HS256)
                .compact();
    }

    public Claims validateAndParseClaims(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    @SuppressWarnings("unchecked")
    public List<String> extractRoles(String token) {
        Claims claims = validateAndParseClaims(token);
        Object rawRoles = claims.get("roles");
        if (rawRoles instanceof List<?> list) {
            return (List<String>) list;
        }
        return List.of("ROLE_USER");
    }

    public long getExpirationMs() {
        return expirationMs;
    }
}
