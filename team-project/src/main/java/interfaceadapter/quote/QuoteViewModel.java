package interfaceadapter.quote;

import java.beans.PropertyChangeListener;
import java.beans.PropertyChangeSupport;

/**
 * View model for the quote feature.
 *
 * <p>
 * Holds the HTML for the currently displayed quote and notifies any
 * listeners when the quote text changes.
 */
public class QuoteViewModel {

    /** Property name fired when the quote text is updated. */
    public static final String QUOTE_TEXT = "quoteText";

    private final PropertyChangeSupport support = new PropertyChangeSupport(this);

    private String quoteHtml = "";

    /**
     * Adds a listener that will be notified when the quote text changes.
     *
     * @param listener the listener to add
     */
    public void addPropertyChangeListener(final PropertyChangeListener listener) {
        support.addPropertyChangeListener(listener);
    }

    /**
     * Returns the current quote as an HTML string.
     *
     * @return the HTML for the current quote
     */
    public String getQuoteHtml() {
        return quoteHtml;
    }

    /**
     * Updates the quote HTML and notifies listeners of the change.
     *
     * @param newQuoteHtml the new HTML to display
     */
    public void setQuoteHtml(final String newQuoteHtml) {
        final String old = this.quoteHtml;
        this.quoteHtml = newQuoteHtml;
        support.firePropertyChange(QUOTE_TEXT, old, newQuoteHtml);
    }
}
