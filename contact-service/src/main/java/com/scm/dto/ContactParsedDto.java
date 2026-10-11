package com.scm.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class ContactParsedDto {
    private String name;
    private String email;
    private String phoneNumber;
    private String company;
    private String role;
    private String address;
    private String tag; // "VIP", "Colleague", "Lead", "Family"

    public ContactParsedDto() {}

    public ContactParsedDto(String name, String email, String phoneNumber, String company, String role, String address, String tag) {
        this.name = name;
        this.email = email;
        this.phoneNumber = phoneNumber;
        this.company = company;
        this.role = role;
        this.address = address;
        this.tag = tag;
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

    public String getCompany() {
        return company;
    }

    public void setCompany(String company) {
        this.company = company;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getTag() {
        return tag;
    }

    public void setTag(String tag) {
        this.tag = tag;
    }
}
