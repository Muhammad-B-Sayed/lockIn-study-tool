package usecase.quote;

/**
 * Output boundary for the quote use case.
 * <p>
 * Implementations are responsible for presenting either a successfully
 * loaded quote or an error message.
 */
public interface QuoteOutputBoundary {

    /**
     * Presents a successfully loaded quote.
     *
     * @param data output data containing the quote content and author
     */
    void presentQuote(QuoteOutputData data);

    /**
     * Presents an error message when the quote cannot be loaded.
     *
     * @param message a human-readable error message
     */
    void presentError(String message);
}
