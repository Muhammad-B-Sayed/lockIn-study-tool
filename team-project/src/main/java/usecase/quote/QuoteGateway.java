package usecase.quote;

import entity.Quote;

/**
 * Gateway for retrieving quotes from an external source.
 */
public interface QuoteGateway {

    /**
     * Fetches a single random quote.
     *
     * @return a {@link Quote} containing content and author
     */
    Quote fetchRandomQuote();
}
