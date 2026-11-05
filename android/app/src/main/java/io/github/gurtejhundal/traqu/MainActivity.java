package io.github.gurtejhundal.traqu;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TraquFilesPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
