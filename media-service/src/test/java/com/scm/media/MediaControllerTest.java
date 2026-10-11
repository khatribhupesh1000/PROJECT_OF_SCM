package com.scm.media;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes = MediaServiceApplication.class)
@AutoConfigureMockMvc
class MediaControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void shouldAcceptValidPhotoAndRejectOversizedOrInvalidMimeType() throws Exception {
        // 1. Valid PNG photo upload (201 Created)
        MockMultipartFile validFile = new MockMultipartFile(
                "file",
                "avatar.png",
                "image/png",
                new byte[1024]
        );
        mockMvc.perform(multipart("/v1/media/photos").file(validFile))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.contentType").value("image/png"));

        // 2. Invalid MIME type (422 Unprocessable Entity)
        MockMultipartFile exeFile = new MockMultipartFile(
                "file",
                "script.exe",
                "application/octet-stream",
                new byte[256]
        );
        mockMvc.perform(multipart("/v1/media/photos").file(exeFile))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.status").value(422));

        // 3. Oversized >2MB photo upload (422 Unprocessable Entity)
        MockMultipartFile oversizedFile = new MockMultipartFile(
                "file",
                "huge.jpg",
                "image/jpeg",
                new byte[2 * 1024 * 1024 + 100]
        );
        mockMvc.perform(multipart("/v1/media/photos").file(oversizedFile))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.status").value(422));
    }
}
