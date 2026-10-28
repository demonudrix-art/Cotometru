package ro.cotometru.beastcompanion;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.IBinder;
import android.os.SystemClock;
import android.util.Log;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** Independent Sportmonks poller. Does not modify the v1.1 SSE reader or TapService. */
public final class SportmonksMonitorService extends Service {
    static final String START = "ro.cotometru.beastcompanion.SPORTMONKS_START";
    static final String STOP = "ro.cotometru.beastcompanion.SPORTMONKS_STOP";
    static final String PREFS = "sportmonks_monitor";
    private static final String CHANNEL = "beast_sportmonks_goal";
    private static final int NOTICE_ID = 4511, POLL_MS = 10000;
    private volatile boolean active = false;
    private volatile HttpURLConnection connection;
    private Thread runner;
    private final Set<String> known = new LinkedHashSet<>();
    private boolean primed = false;

    @Override public void onCreate() {
        super.onCreate();
        NotificationManager nm = (NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        nm.createNotificationChannel(new NotificationChannel(CHANNEL,
            "BEAST Sportmonks Gol", NotificationManager.IMPORTANCE_LOW));
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        if (STOP.equals(intent.getAction())) { stopMonitoring(); return START_NOT_STICKY; }
        if (!START.equals(intent.getAction()) || active) return START_NOT_STICKY;
        String fixtureId = intent.getStringExtra("fixture_id");
        if (fixtureId == null || !fixtureId.matches("[0-9]{1,15}")) {
            saveStatus("ID meci Sportmonks invalid"); stopSelf(); return START_NOT_STICKY;
        }
        String token = SportmonksTokenStore.read(this);
        if (token.isEmpty()) {
            saveStatus("Lipsește tokenul Sportmonks"); stopSelf(); return START_NOT_STICKY;
        }
        active = true;
        known.clear();
        primed = false;
        startForeground(NOTICE_ID, notice("Conectare Sportmonks · meci " + fixtureId));
        runner = new Thread(() -> monitor(fixtureId, token), "BEAST-Sportmonks");
        runner.start();
        return START_NOT_STICKY;
    }

    private Notification notice(String text) {
        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pending = PendingIntent.getActivity(this, 411, intent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new Notification.Builder(this, CHANNEL)
            .setContentTitle("BEAST X-RAY · Sportmonks")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pending)
            .setOngoing(active).build();
    }

    private void saveStatus(String s) {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
            .putString("status", s).putLong("last_update", System.currentTimeMillis()).apply();
        NotificationManager nm = (NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        if (active) nm.notify(NOTICE_ID, notice(s));
    }

    private static final class ApiError extends Exception {
        final int code, waitSeconds;
        ApiError(int code, int waitSeconds) {this.code=code; this.waitSeconds=waitSeconds;}
    }

    private JSONObject fetchFixture(String fixtureId, String token) throws Exception {
        URL url = new URL("https://api.sportmonks.com/v3/football/livescores/inplay?include=events");
        HttpURLConnection c = (HttpURLConnection)url.openConnection();
        connection = c;
        try {
            c.setRequestMethod("GET");
            c.setConnectTimeout(6000); c.setReadTimeout(8000);
            c.setRequestProperty("Authorization", token);
            c.setRequestProperty("Accept", "application/json");
            int status = c.getResponseCode();
            if (status != 200) {
                int retry = 60;
                try { retry = Integer.parseInt(c.getHeaderField("Retry-After")); }
                catch (RuntimeException ignored) {}
                throw new ApiError(status, Math.max(10, Math.min(180, retry)));
            }
            try (InputStream input = c.getInputStream();
                 BufferedReader reader = new BufferedReader(
                     new InputStreamReader(input, StandardCharsets.UTF_8))) {
                StringBuilder body = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    body.append(line);
                    if (body.length() > 1_500_000) throw new IOException("JSON Sportmonks prea mare");
                }
                return new JSONObject(body.toString());
            }
        } finally {
            c.disconnect();
            if (connection == c) connection = null;
        }
    }

    private void monitor(String fixtureId, String token) {
        long end = SystemClock.elapsedRealtime() + 7200000L;
        int failures = 0;
        try {
            while (active && SystemClock.elapsedRealtime() < end) {
                long start = SystemClock.elapsedRealtime();
                long waitMs = POLL_MS;
                try {
                    JSONObject response = fetchFixture(fixtureId, token);
                    List<SportmonksGoalDetector.Goal> goals =
                        SportmonksGoalDetector.parse(response, fixtureId);
                    int fresh = 0;
                    for (SportmonksGoalDetector.Goal goal : goals) {
                        if (!known.add(goal.key) || !primed) continue;
                        fresh++;
                        JSONObject event = goal.toCompanionEvent();
                        long received = SystemClock.elapsedRealtimeNanos();
                        // The exact v1.1 gesture implementation is still used.
                        TapService.onGoalSse(this, event, received);
                        saveStatus("GOL · " + goal.match + " · " + goal.result +
                            " · " + goal.scorer);
                        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                            .putString("last_goal", goal.key).apply();
                    }
                    // Stay under a bounded memory footprint, retaining newest IDs.
                    while (known.size() > 300)
                        known.remove(known.iterator().next());
                    if (!primed) {
                        primed = true;
                        saveStatus("Conectat · " + goals.size() +
                            " goluri istorice ignorate · aștept gol nou");
                    } else if (fresh == 0) {
                        saveStatus("Conectat · meci " + fixtureId + " · aștept gol nou");
                    }
                    failures = 0;
                } catch (ApiError e) {
                    failures++;
                    saveStatus("Sportmonks HTTP " + e.code +
                        (e.code == 401 || e.code == 403 ? " · verifică token/abonament" : ""));
                    if (e.code == 401 || e.code == 403 || e.code == 404) break;
                    waitMs = e.code == 429 ? Math.max(POLL_MS, e.waitSeconds * 1000L)
                        : Math.min(90000L, POLL_MS * (1L << Math.min(3, failures)));
                } catch (Exception e) {
                    failures++;
                    Log.w("BEAST-Sportmonks", "Monitor error: " + e.getClass().getSimpleName());
                    saveStatus("Eroare date/rețea · încerc din nou");
                    waitMs = Math.min(90000L, POLL_MS * (1L << Math.min(3, failures)));
                }
                while (active && SystemClock.elapsedRealtime() < end &&
                       SystemClock.elapsedRealtime() - start < waitMs) {
                    try { Thread.sleep(300); } catch (InterruptedException ignored) {
                        Thread.currentThread().interrupt(); active = false; break;
                    }
                }
            }
        } finally {
            active = false;
            saveStatus("Monitorizare Sportmonks oprită");
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
        }
    }

    private void stopMonitoring() {
        active = false;
        if (connection != null) connection.disconnect();
        if (runner != null) runner.interrupt();
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override public void onDestroy() {
        active = false;
        if (connection != null) connection.disconnect();
        if (runner != null) runner.interrupt();
        super.onDestroy();
    }
}
