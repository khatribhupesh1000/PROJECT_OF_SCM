# ============================================================================
# Stage 1: Build Stage (Eclipse Temurin Java 21 JDK Alpine + Maven)
# ============================================================================
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /workspace

RUN apk add --no-cache maven

COPY pom.xml ./
COPY common-lib ./common-lib
COPY auth-service ./auth-service
COPY contact-service ./contact-service
COPY media-service ./media-service
COPY notification-service ./notification-service
COPY audit-service ./audit-service
COPY integration-service ./integration-service

ARG SERVICE_MODULE=contact-service
RUN mvn clean package -pl ${SERVICE_MODULE} -am -DskipTests -B

# ============================================================================
# Stage 2: Production Runtime Stage (Eclipse Temurin Java 21 JRE Alpine)
# ============================================================================
FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app

ARG SERVICE_MODULE=contact-service
ENV SERVICE_MODULE=${SERVICE_MODULE}
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Djava.security.egd=file:/dev/./urandom"

RUN addgroup -S scmgroup && adduser -S scmuser -G scmgroup

COPY --from=builder /workspace/${SERVICE_MODULE}/target/*.jar /app/app.jar
RUN chown -R scmuser:scmgroup /app

USER scmuser

EXPOSE 8080 8081 8082 8083 8084 8085 8086

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${SERVER_PORT:-8082}/v1/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]
