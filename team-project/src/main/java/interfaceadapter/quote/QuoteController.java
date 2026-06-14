package interfaceadapter.quote;

import usecase.quote.QuoteInputBoundary;

public class QuoteController {

    private final QuoteInputBoundary interactor;

    public QuoteController(QuoteInputBoundary interactor) {
        this.interactor = interactor;
    }

    /** Run in a background thread so the UI does not freeze. */
    public void loadQuote() {
        new Thread(interactor::loadQuote).start();
    }
}
