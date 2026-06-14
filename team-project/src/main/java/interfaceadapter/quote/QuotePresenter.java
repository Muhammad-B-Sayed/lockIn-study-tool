package interfaceadapter.quote;

import usecase.quote.QuoteOutputBoundary;
import usecase.quote.QuoteOutputData;

/**
 * Presenter for the quote feature.
 * <p>
 * Converts {@link QuoteOutputData} into HTML and stores it in the
 * {@link QuoteViewModel}.
 */
public class QuotePresenter implements QuoteOutputBoundary {

    private final QuoteViewModel viewModel;

    /**
     * Constructs a presenter that writes into the given view model.
     *
     * @param viewModel the view model to update
     */
    public QuotePresenter(final QuoteViewModel viewModel) {
        this.viewModel = viewModel;
    }

    @Override
    public void presentQuote(final QuoteOutputData data) {
        // Use plain ASCII characters to satisfy Checkstyle RegexpSingleline.
        final String html =
                "<html><div style='text-align:right;'>"
                        + "<i>\"" + data.getContent()
                        + "\"</i><br/>"
                        + "- " + data.getAuthor()
                        + "</div></html>";

        viewModel.setQuoteHtml(html);
    }

    @Override
    public void presentError(final String message) {
        viewModel.setQuoteHtml(message);
    }
}
