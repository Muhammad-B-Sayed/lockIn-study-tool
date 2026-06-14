package view;

import java.awt.*;
import java.util.ArrayList;
import java.util.List;

public final class ColorPalettes {
    private ColorPalettes() {}

    public static final List<Color> ALL = List.of(
            new Color(0x28365A), new Color(0xE39C61), new Color(0x358F35),
            new Color(0x881112), new Color(0x600BA1), new Color(0x653D34),
            new Color(0x009792), new Color(0x2B098A), new Color(0xBCBD22),
            new Color(0x17BECF), new Color(0x003A59), new Color(0xF47E09),
            new Color(0x9ADC91), new Color(0xE15759), new Color(0x0F512F),
            new Color(0x612907), new Color(0x5A5656), new Color(0x76B7B2),
            new Color(0xF1CE63), new Color(0xA34E79A7, true), new Color(0x80C5F3),
            new Color(0xFFDD81CC, true), new Color(0x6B4F93), new Color(0xE43D70)
    );

    public static List<List<Color>> pages(int n) {
        List<List<Color>> out = new ArrayList<>();
        for (int i = 0; i < ALL.size(); i += n) {
            out.add(ALL.subList(i, Math.min(ALL.size(), i + n)));
        }
        return out;
    }
}
