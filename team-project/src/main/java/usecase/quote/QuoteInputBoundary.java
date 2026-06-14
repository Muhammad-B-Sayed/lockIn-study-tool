package usecase.quote;

/**
 * Input boundary for the quote use case.
 */
public interface QuoteInputBoundary {

    /**
     * Loads a new quote and passes it to the output boundary.
     */
    void loadQuote();
}
