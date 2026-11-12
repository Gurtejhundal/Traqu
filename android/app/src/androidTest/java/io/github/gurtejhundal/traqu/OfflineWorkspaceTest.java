package io.github.gurtejhundal.traqu;

import static org.junit.Assert.*;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/** Exercises the installed APK and its actual WebView/IndexedDB while the emulator is offline. */
@RunWith(AndroidJUnit4.class)
public class OfflineWorkspaceTest {
    private WebView webView;
    private String js(String script) throws Exception {
        AtomicReference<String> result = new AtomicReference<>("");
        CountDownLatch latch = new CountDownLatch(1);
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> webView.evaluateJavascript(script, value -> { result.set(value); latch.countDown(); }));
        assertTrue("WebView did not respond", latch.await(8, TimeUnit.SECONDS));
        return result.get();
    }
    private void waitFor(String condition) throws Exception {
        long deadline = System.currentTimeMillis() + 45000;
        while (System.currentTimeMillis() < deadline) { if ("true".equals(js("Boolean(" + condition + ")"))) return; Thread.sleep(150); }
        fail("Expected UI: " + condition + "; actual: " + js("document.body.innerText.slice(0,2500)"));
    }
    private void fill(String selector, String value) throws Exception {
        js("(()=>{const el=document.querySelector("+org.json.JSONObject.quote(selector)+");const p=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(el,"+org.json.JSONObject.quote(value)+");el.dispatchEvent(new Event('input',{bubbles:true}));return true})()");
    }
    @Test public void profileAndDailyPlanPersistWithoutAnApiServer() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> webView = activity.getBridge().getWebView());
            waitFor("document.querySelector('.quick-setup') || document.querySelector('h1')?.textContent.includes('Your roadmaps')");
            js("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Set up later')?.click()");
            waitFor("document.querySelector('h1')?.textContent.includes('Your roadmaps')");
            assertFalse(js("document.body.innerText").contains("online workspace is not available"));
            js("document.querySelector('a[href=\"/profile\"]').click()");
            waitFor("document.querySelector('.profile-name-line h1')");
            js("document.querySelector('.profile-view-nav button:nth-child(2)').click()");
            waitFor("document.querySelector('input[autocomplete=nickname]')");
            fill("input[autocomplete=nickname]", "Android tester");
            js("document.querySelector('.profile-savebar button[type=submit]').click()");
            waitFor("document.querySelector('.profile-saved')");
            scenario.recreate();
            scenario.onActivity(activity -> webView = activity.getBridge().getWebView());
            waitFor("document.querySelector('a[href=\"/profile\"]')");
            js("document.querySelector('a[href=\"/profile\"]').click()");
            waitFor("document.querySelector('.profile-name-line h1')?.textContent==='Android tester'");
            js("document.querySelector('a[href=\"/import\"]').click()");
            waitFor("Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('Paste text'))");
            js("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Paste text')).click()");
            waitFor("document.querySelector('textarea')");
            fill("#roadmap-name", "Offline daily plan");
            fill("#roadmap-text", "# Week 1: Foundations\n## Day 1 - 2026-11-05\n- [ ] Learn vectors\n## Day 2 - 2026-11-06\n- [ ] Solve an array question");
            js("document.querySelector('button[type=submit]').click()");
            waitFor("Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Import roadmap')");
            js("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Import roadmap').click()");
            waitFor("document.querySelectorAll('.day-card').length===2");
            js("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Start Day 1').click()");
            waitFor("document.querySelector('.task-title')?.textContent.includes('Learn vectors')");
            scenario.recreate();
            scenario.onActivity(activity -> webView = activity.getBridge().getWebView());
            waitFor("document.body.innerText.includes('Offline daily plan')");
        }
    }
}
