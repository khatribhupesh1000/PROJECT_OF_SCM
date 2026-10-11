package com.scm.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlProperty;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlRootElement;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "contacts")
@JacksonXmlRootElement(localName = "Contact")
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Contact {

    @Id
    @Column(nullable = false, length = 64)
    @JacksonXmlProperty(localName = "id")
    private String id;

    @Column(nullable = false, length = 64)
    @JacksonXmlProperty(localName = "userId")
    private String userId = "usr-default";

    @Column(nullable = false, length = 120)
    @JacksonXmlProperty(localName = "name")
    private String name;

    @Column(nullable = false, length = 180)
    @JacksonXmlProperty(localName = "email")
    private String email;

    @Column(nullable = false, length = 30)
    @JacksonXmlProperty(localName = "phoneNumber")
    private String phoneNumber;

    @Column(length = 300)
    @JacksonXmlProperty(localName = "address")
    private String address;

    @Column(length = 1000)
    @JacksonXmlProperty(localName = "description")
    private String description;

    @Column(nullable = false)
    @JacksonXmlProperty(localName = "favorite")
    private boolean favorite = false;

    @Column(length = 255)
    @JacksonXmlProperty(localName = "websiteLink")
    private String websiteLink;

    @Column(length = 255)
    @JacksonXmlProperty(localName = "linkedInLink")
    private String linkedInLink;

    @Column(length = 500)
    @JacksonXmlProperty(localName = "pictureUrl")
    private String pictureUrl;

    @Column(nullable = false, length = 64)
    @JacksonXmlProperty(localName = "createdAt")
    private String createdAt;

    @Column(nullable = false, length = 64)
    @JacksonXmlProperty(localName = "updatedAt")
    private String updatedAt;

    public Contact() {
    }

    @PrePersist
    public void prePersist() {
        String now = Instant.now().toString();
        if (this.id == null || this.id.isBlank()) {
            this.id = "cnt-" + UUID.randomUUID();
        }
        if (this.userId == null || this.userId.isBlank()) {
            this.userId = "usr-default";
        }
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        this.updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = Instant.now().toString();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public boolean isFavorite() {
        return favorite;
    }

    public void setFavorite(boolean favorite) {
        this.favorite = favorite;
    }

    public String getWebsiteLink() {
        return websiteLink;
    }

    public void setWebsiteLink(String websiteLink) {
        this.websiteLink = websiteLink;
    }

    public String getLinkedInLink() {
        return linkedInLink;
    }

    public void setLinkedInLink(String linkedInLink) {
        this.linkedInLink = linkedInLink;
    }

    public String getPictureUrl() {
        return pictureUrl;
    }

    public void setPictureUrl(String pictureUrl) {
        this.pictureUrl = pictureUrl;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }
}
