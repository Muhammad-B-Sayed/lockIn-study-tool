package dataaccess;

import entity.Quote;
import org.json.JSONObject;
import usecase.quote.QuoteGateway;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class QuoteApiClient implements QuoteGateway {

    private static final String QUOTE_URL =
            "https://dummyjson.com/quotes/random";

    private final HttpClient client;

    public QuoteApiClient() {
        this.client = HttpClient.newHttpClient();
    }

    @Override
    public Quote fetchRandomQuote() {
        Quote result = new Quote("Could not load quote from the server.", "LockIn");

        try {
            final HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(QUOTE_URL))
                    .GET()
                    .build();

            final HttpResponse<String> response =
                    client.send(request, HttpResponse.BodyHandlers.ofString());

            final JSONObject json = new JSONObject(response.body());
            final String content = json.optString("quote", "");
            final String author = json.optString("author", "");

            if (!content.isEmpty()) {
                result = new Quote(content, author);
            }
        } catch (IOException ioException) {
            // Network issue: keep fallback quote.
        } catch (InterruptedException interruptedException) {
            Thread.currentThread().interrupt();
        }

        return result;
    }
}
