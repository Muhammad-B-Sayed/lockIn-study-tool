package com.lockin.backend.service;

import com.lockin.backend.dto.QuoteResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class QuoteService {

    private static final Duration CACHE_TTL = Duration.ofHours(6);
    private static final List<String> FOCUS_KEYWORDS = List.of(
            "learn", "learner", "study", "student", "read", "book", "work", "focus",
            "practice", "progress", "improve", "improvement", "growth", "discipline",
            "success", "failure", "future", "dream", "excellence", "inspire",
            "inspiration", "beginner", "begin", "effort", "knowledge", "wisdom");
    private static final List<QuoteResponse> FALLBACK_QUOTES = List.of(
            new QuoteResponse("Small steps, repeated often, become real mastery.", "LockIn"),
            new QuoteResponse("The work you finish calmly is worth more than the work you rush halfway.", "LockIn"),
            new QuoteResponse("Learning compounds when you return to it every day.", "LockIn"),
            new QuoteResponse("Progress feels slow until consistency turns it into momentum.", "LockIn"),
            new QuoteResponse("Focus is easier when the next step is written down.", "LockIn"));

    private final RestClient quoteRestClient;
    private List<QuoteResponse> cachedQuotes = FALLBACK_QUOTES;
    private Instant cacheExpiresAt = Instant.EPOCH;
    private String lastQuoteContent;

    public QuoteService(RestClient quoteRestClient) {
        this.quoteRestClient = quoteRestClient;
    }

    public QuoteResponse randomQuote() {
        List<QuoteResponse> quotePool = getQuotePool();
        return chooseQuote(quotePool);
    }

    private synchronized List<QuoteResponse> getQuotePool() {
        Instant now = Instant.now();
        if (now.isBefore(cacheExpiresAt) && !cachedQuotes.isEmpty()) {
            return cachedQuotes;
        }

        try {
            ZenQuoteItem[] payload = quoteRestClient.get()
                    .uri("/api/quotes")
                    .retrieve()
                    .body(ZenQuoteItem[].class);

            List<QuoteResponse> nextQuotes = mapQuotes(payload);
            if (!nextQuotes.isEmpty()) {
                cachedQuotes = nextQuotes;
                cacheExpiresAt = now.plus(CACHE_TTL);
                return cachedQuotes;
            }
        } catch (Exception exception) {
            // Fall back to the last cached pool or local quotes if the API is unavailable.
        }

        cachedQuotes = FALLBACK_QUOTES;
        cacheExpiresAt = now.plus(CACHE_TTL);
        return cachedQuotes;
    }

    private List<QuoteResponse> mapQuotes(ZenQuoteItem[] payload) {
        if (payload == null || payload.length == 0) {
            return List.of();
        }

        List<QuoteResponse> parsedQuotes = new ArrayList<>();
        for (ZenQuoteItem item : payload) {
            if (item == null || item.q() == null || item.a() == null) {
                continue;
            }

            String content = item.q().trim();
            String author = item.a().trim();
            if (content.isEmpty() || author.isEmpty()) {
                continue;
            }

            parsedQuotes.add(new QuoteResponse(content, author));
        }

        List<QuoteResponse> focusedQuotes = parsedQuotes.stream()
                .filter(quote -> focusScore(quote) > 0)
                .toList();
        return focusedQuotes.isEmpty() ? parsedQuotes : focusedQuotes;
    }

    private QuoteResponse chooseQuote(List<QuoteResponse> quotes) {
        if (quotes.isEmpty()) {
            return FALLBACK_QUOTES.getFirst();
        }

        int startIndex = ThreadLocalRandom.current().nextInt(quotes.size());
        for (int offset = 0; offset < quotes.size(); offset++) {
            QuoteResponse candidate = quotes.get((startIndex + offset) % quotes.size());
            if (!candidate.content().equals(lastQuoteContent) || quotes.size() == 1) {
                lastQuoteContent = candidate.content();
                return candidate;
            }
        }

        QuoteResponse fallback = quotes.get(startIndex);
        lastQuoteContent = fallback.content();
        return fallback;
    }

    private int focusScore(QuoteResponse quote) {
        String haystack = (quote.content() + " " + quote.author()).toLowerCase(Locale.ROOT);
        int score = 0;

        for (String keyword : FOCUS_KEYWORDS) {
            if (haystack.contains(keyword)) {
                score++;
            }
        }

        return score;
    }

    private record ZenQuoteItem(String q, String a) {
    }
}
