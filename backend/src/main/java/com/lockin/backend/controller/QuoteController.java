package com.lockin.backend.controller;

import com.lockin.backend.dto.QuoteResponse;
import com.lockin.backend.service.QuoteService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/quotes")
public class QuoteController {

    private final QuoteService quoteService;

    public QuoteController(QuoteService quoteService) {
        this.quoteService = quoteService;
    }

    @GetMapping("/random")
    public QuoteResponse randomQuote() {
        return quoteService.randomQuote();
    }
}
