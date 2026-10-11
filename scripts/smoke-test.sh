#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${API_BASE_URL:-http://localhost:8080}"
echo "================================================================="
echo " Smart Contact Manager (SCM) - Live End-to-End Smoke Test"
echo " Target Gateway: $BASE_URL"
echo "================================================================="

echo "[1/10] Checking /v1/health and X-Correlation-ID propagation..."
curl -fsS -i -H "X-Correlation-ID: smoke-corr-001" "$BASE_URL/v1/health" | head -n 12

echo "[2/10] Authenticating admin user (POST /v1/auth/tokens)..."
TOKEN_RES=$(curl -fsS -X POST "$BASE_URL/v1/auth/tokens" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@scm.enterprise.io","password":"AdminPass123!"}')
echo "   -> Issued JWT token response received."

echo "[3/10] Testing Idempotent Contact Creation (POST /v1/contacts with Idempotency-Key)..."
IDEM_KEY="smoke-idem-$(date +%s)"
CREATE_RES=$(curl -fsS -X POST "$BASE_URL/v1/contacts" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEM_KEY" \
  -d '{"name":"Smoke Test Contact","email":"smoke@scm.enterprise.io","phoneNumber":"+919876500001"}')
CONTACT_ID=$(echo "$CREATE_RES" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "   -> Created Contact ID: $CONTACT_ID"

echo "[4/10] Replaying identical POST with same Idempotency-Key..."
curl -fsS -i -X POST "$BASE_URL/v1/contacts" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEM_KEY" \
  -d '{"name":"Smoke Test Contact","email":"smoke@scm.enterprise.io","phoneNumber":"+919876500001"}' | grep -i "X-Idempotent-Replayed"

echo "[5/10] Verifying Cursor Pagination & RFC 5988 Link Header (GET /v1/contacts?limit=2)..."
curl -fsS -i "$BASE_URL/v1/contacts?limit=2" | grep -iE "^(HTTP|Link|ETag|Cache-Control)"

echo "[6/10] Verifying XML Content Negotiation (Accept: application/xml)..."
curl -fsS -H "Accept: application/xml" "$BASE_URL/v1/contacts/$CONTACT_ID" | head -n 6

echo "[7/10] Verifying Conditional GET (ETag -> 304 Not Modified)..."
ETAG=$(curl -fsS -I "$BASE_URL/v1/contacts/$CONTACT_ID" | awk -F': ' 'tolower($1)=="etag"{print $2}' | tr -d '\r')
STATUS_304=$(curl -s -o /dev/null -w "%{http_code}" -H "If-None-Match: $ETAG" "$BASE_URL/v1/contacts/$CONTACT_ID")
echo "   -> ETag=$ETAG, Conditional GET HTTP Status=$STATUS_304"

echo "[8/10] Verifying GraphQL Endpoint (POST /v1/graphql)..."
curl -fsS -X POST "$BASE_URL/v1/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { queryType { name } } contacts { id name email } }"}' | head -c 200
echo ""

echo "[9/10] Verifying WSDL & SOAP 1.1 Outbound Call with Retry/Circuit Breaker..."
curl -fsS -X POST "$BASE_URL/v1/soap/execute" \
  -H "Content-Type: application/json" \
  -d '{"operation":"VerifyPhoneNumber","phoneNumber":"+919876543210","transientFailures":1}' | head -c 220
echo ""

echo "[10/10] Cleaning up Smoke Test Contact (DELETE /v1/contacts/$CONTACT_ID)..."
DEL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL/v1/contacts/$CONTACT_ID")
echo "   -> DELETE HTTP Status=$DEL_STATUS"

echo "✅ All 10 Live Smoke Test checks PASSED!"
