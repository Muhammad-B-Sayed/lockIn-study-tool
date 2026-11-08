package com.lockin.backend.config;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.Module;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;
import com.fasterxml.jackson.databind.module.SimpleModule;
import java.io.IOException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class StudyJsonConfig {
    @Bean
    Module studyTimeModule() {
        SimpleModule module = new SimpleModule();
        module.addDeserializer(LocalDate.class, new StdDeserializer<>(LocalDate.class) {
            @Override
            public LocalDate deserialize(JsonParser parser, DeserializationContext context) throws IOException {
                if (parser.currentToken() == JsonToken.VALUE_STRING) {
                    String value = parser.getText();
                    if (value.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")) {
                        try { return LocalDate.parse(value); } catch (DateTimeParseException ignored) { }
                    }
                }
                throw context.wrongTokenException(parser, LocalDate.class, JsonToken.VALUE_STRING,
                        "Date must be a valid YYYY-MM-DD string.");
            }
        });
        module.addDeserializer(OffsetDateTime.class, new StdDeserializer<>(OffsetDateTime.class) {
            @Override
            public OffsetDateTime deserialize(JsonParser parser, DeserializationContext context) throws IOException {
                if (parser.currentToken() == JsonToken.VALUE_STRING) {
                    try { return OffsetDateTime.parse(parser.getText()); } catch (DateTimeParseException ignored) { }
                }
                throw context.wrongTokenException(parser, OffsetDateTime.class, JsonToken.VALUE_STRING,
                        "Instant must be an ISO-8601 string with an offset or Z.");
            }
        });
        return module;
    }
}
