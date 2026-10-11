package com.scm.repository;

import com.scm.entity.Contact;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Parameterised Spring Data JPA queries for Contacts supporting O(1) keyset cursor pagination
 * and SQL-injection-safe search filtering (Checklist #11 & #22).
 */
@Repository
public interface ContactRepository extends JpaRepository<Contact, String> {

    @Query("""
            SELECT c FROM Contact c
            WHERE (:cursor IS NULL OR c.id > :cursor)
              AND (:search IS NULL OR LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(c.email) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR c.phoneNumber LIKE CONCAT('%', :search, '%'))
              AND (:favorite IS NULL OR c.favorite = :favorite)
            ORDER BY c.id ASC
            """)
    List<Contact> findContactsKeysetPage(
            @Param("cursor") String cursor,
            @Param("search") String search,
            @Param("favorite") Boolean favorite,
            Pageable pageable
    );
}
