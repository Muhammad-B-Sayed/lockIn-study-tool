package usecase.quote;

import entity.Quote;

/**
 * Interactor for loading a quote from the gateway and sending it
 * to the output boundary.
 */
public class QuoteInteractor implements QuoteInputBoundary {

    private final QuoteGateway gateway;
    private final QuoteOutputBoundary presenter;

    /**
     * Constructs a quote interactor.
     *
     * @param gateway   the data access gateway used to fetch quotes
     * @param presenter the output boundary used to present results
     */
    public QuoteInteractor(final QuoteGateway gateway,
                           final QuoteOutputBoundary presenter) {
        this.gateway = gateway;
        this.presenter = presenter;
    }

    @Override
    public void loadQuote() {
        try {
            final Quote quote = gateway.fetchRandomQuote();
            final QuoteOutputData outputData =
                    new QuoteOutputData(quote.getContent(), quote.getAuthor());
            presenter.presentQuote(outputData);
        }
        catch (Exception exception) {
            // We deliberately swallow the specific cause here and present
            // a friendly message to the user instead.
            presenter.presentError("Could not load quote.");
        }
    }
}
