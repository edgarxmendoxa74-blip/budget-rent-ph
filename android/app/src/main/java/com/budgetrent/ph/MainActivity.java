package com.budgetrent.ph;

import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int STATUS_BAR_COLOR = Color.parseColor("#002652");

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DeviceLocationPlugin.class);
        super.onCreate(savedInstanceState);
        paintStatusBar();
    }

    // Android 15+ (Infinix/Tecno etc.) draws the app edge-to-edge and ignores statusBarColor,
    // leaving a white strip where the white clock/battery/notification icons become invisible.
    // Paint that strip dark blue ourselves and force light icons.
    private void paintStatusBar() {
        View decor = getWindow().getDecorView();
        if (!(decor instanceof FrameLayout)) return;
        FrameLayout root = (FrameLayout) decor;

        View strip = new View(this);
        strip.setBackgroundColor(STATUS_BAR_COLOR);
        root.addView(strip, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, 0, Gravity.TOP));

        ViewCompat.setOnApplyWindowInsetsListener(decor, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.displayCutout());
            FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) strip.getLayoutParams();
            if (lp.height != bars.top) {
                lp.height = bars.top;
                strip.setLayoutParams(lp);
            }
            strip.bringToFront();
            return ViewCompat.onApplyWindowInsets(v, insets);
        });

        WindowCompat.getInsetsController(getWindow(), decor).setAppearanceLightStatusBars(false);
        ViewCompat.requestApplyInsets(decor);
    }
}
