package io.github.gurtejhundal.traqu;

import android.app.Activity;
import android.content.Intent;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.print.PrintJob;
import android.util.Base64;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.io.File;
import java.io.FileOutputStream;
import androidx.core.content.FileProvider;

/** User-chosen document destinations; no broad storage permission or automatic sharing. */
@CapacitorPlugin(name = "TraquFiles")
public class TraquFilesPlugin extends Plugin {
    @PluginMethod
    public void save(PluginCall call) {
        String name = call.getString("name", "Traqu-export.json").replaceAll("[/\\\\]", "_");
        String data = call.getString("data", "");
        if (data.length() > 24000000) { call.reject("This export is too large. Export one roadmap at a time."); return; }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("mime", "application/octet-stream"));
        intent.putExtra(Intent.EXTRA_TITLE, name);
        startActivityForResult(call, intent, "savedDocument");
    }

    @ActivityCallback
    private void savedDocument(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("Saving was cancelled. Your work is still in Traqu."); return;
        }
        try (OutputStream stream = getContext().getContentResolver().openOutputStream(result.getData().getData(), "wt")) {
            if (stream == null) throw new IllegalStateException("Document could not be opened");
            stream.write(Base64.decode(call.getString("data", ""), Base64.DEFAULT));
            call.resolve(new JSObject().put("saved", true));
        } catch (Exception error) { call.reject("This file could not be saved. Choose another destination.", error); }
    }

    @PluginMethod
    public void share(PluginCall call) {
        try {
            String data = call.getString("data", "");
            if (data.length() > 24000000) { call.reject("This card is too large to share."); return; }
            File directory = new File(getContext().getCacheDir(), "shared-cards");
            if (!directory.isDirectory() && !directory.mkdirs()) throw new IllegalStateException("Could not prepare share folder");
            File[] older = directory.listFiles();
            if (older != null) for (File previous : older) if (previous.lastModified() < System.currentTimeMillis() - 86400000L) previous.delete();
            File image = new File(directory, "Traqu-profile-" + System.currentTimeMillis() + ".png");
            try (OutputStream output = new FileOutputStream(image)) { output.write(Base64.decode(data, Base64.DEFAULT)); }
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("image/png");
            intent.putExtra(Intent.EXTRA_STREAM, FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", image));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().runOnUiThread(() -> { try { getActivity().startActivity(Intent.createChooser(intent, "Share your Traqu card")); call.resolve(); } catch (Exception error) { call.reject("No share app could be opened. Save the image instead.", error); } });
        } catch (Exception error) { call.reject("The share sheet could not be opened. Save the image instead.", error); }
    }

    @PluginMethod
    public void print(PluginCall call) {
        String html = call.getString("html", "");
        if (html.isEmpty() || html.length() > 16000000) { call.reject("Export a smaller roadmap."); return; }
        getActivity().runOnUiThread(() -> {
            WebView printView = new WebView(getContext());
            printView.getSettings().setJavaScriptEnabled(false);
            printView.getSettings().setAllowFileAccess(false);
            printView.getSettings().setAllowContentAccess(false);
            printView.setWebViewClient(new WebViewClient() {
                private boolean started = false;
                @Override public void onPageFinished(WebView view, String url) {
                    if (started) return;
                    started = true;
                    PrintManager manager = (PrintManager) getActivity().getSystemService(Activity.PRINT_SERVICE);
                    if (manager == null) { call.reject("Printing is not available on this device."); printView.destroy(); return; }
                    PrintJob job = manager.print("Traqu roadmap", view.createPrintDocumentAdapter("Traqu roadmap"), new PrintAttributes.Builder().build());
                    PrintManager.PrintJobStateChangeListener listener = new PrintManager.PrintJobStateChangeListener() {
                        @Override public void onPrintJobStateChanged(android.print.PrintJobId changed) {
                            if (!changed.equals(job.getId())) return;
                            if (job.isCompleted() || job.isCancelled() || job.isFailed()) {
                                manager.removePrintJobStateChangeListener(this);
                                printView.destroy();
                            }
                        }
                    };
                    manager.addPrintJobStateChangeListener(listener);
                    call.resolve();
                }
            });
            printView.loadDataWithBaseURL("https://localhost/", html, "text/html", "UTF-8", null);
        });
    }
}
