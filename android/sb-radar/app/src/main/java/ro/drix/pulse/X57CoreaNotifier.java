package ro.drix.pulse;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import java.util.Calendar;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;

/**
 * X57 Coreea Pattern native FCM delivery, independent of the BET_NOW/Auto Mode pipeline.
 * An event may create one preliminary (halftime) and one confirmed notification.
 * Never sends a betting action, uses no Twilio, and never writes to the slip.
 */
final class X57CoreaNotifier {
  private static final String HALF_DAY = "sb_x57_corea_half_day_v1";
  private static final String HALF_NIGHT = "sb_x57_corea_half_night_v1";
  private static final String CONF_DAY = "sb_x57_corea_confirm_day_v1";
  private static final String CONF_NIGHT = "sb_x57_corea_confirm_night_v1";

  private X57CoreaNotifier() {}

  private static String decimal(String value) {
    if (value == null || value.isEmpty()) return "—";
    try { return String.format(Locale.ROOT, "%.2f", Double.parseDouble(value)); }
    catch (Exception ignored) { return value; }
  }

  private static String generosityPct(String value) {
    if (value == null || value.isEmpty()) return "—";
    try { return String.format(Locale.ROOT, "%.2f%%", 100.0 * Double.parseDouble(value)); }
    catch (Exception ignored) { return "—"; }
  }

  private static void acknowledge(Context context,long eventId,String stage) {
    final Context app=context.getApplicationContext();
    new Thread(()->{try{String auth=MainActivity.token(app);if(auth.isEmpty())return;org.json.JSONObject ack=new org.json.JSONObject();ack.put("event_id",eventId);ack.put("stage",stage);MainActivity.readHttp(MainActivity.BASE+"/api/mobile/ack",auth,ack.toString());}catch(Exception e){android.util.Log.w("SB_Radar_X57","Receipt pending",e);}},"SB-Corea-receipt").start();
  }
  static synchronized void post(Context context, Map<String, String> data) {
    try {
      final String stage = data.getOrDefault("stage", "");
      final boolean ht = "XCOREA_HT".equals(stage);
      if (ht ? !"XCOREA_HT_V1".equals(data.get("model_version")) : !"X57_COREA_PATTERN".equals(data.get("model_version"))) return;
      final boolean confirmed = "X57_CONFIRM".equals(stage);
      if (!confirmed && !ht && !"X57_HALF".equals(stage)) return;

      final long eventId = Long.parseLong(data.getOrDefault("event_id", "0"));
      if (eventId <= 0L) return;
      if (Build.VERSION.SDK_INT >= 33 &&
          context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
      final NotificationManager manager =
          (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
      if (manager == null || !manager.areNotificationsEnabled()) return;

      final SharedPreferences prefs =
          context.getSharedPreferences(MainActivity.PREF_NAME, Context.MODE_PRIVATE);
      final String dedup = "x57_corea_seen_v1_" + stage + "_" + eventId;
      if (prefs.getBoolean(dedup, false)) { acknowledge(context,eventId,stage); return; }

      final int hour = Calendar.getInstance(TimeZone.getTimeZone("Europe/Bucharest"))
          .get(Calendar.HOUR_OF_DAY);
      final boolean quiet = hour >= 22 || hour < 5;
      final String channelId =
          ht ? (quiet ? "sb_xcorea_ht_night_v1" : "sb_xcorea_ht_day_v1") : confirmed ? (quiet ? CONF_NIGHT : CONF_DAY) : (quiet ? HALF_NIGHT : HALF_DAY);
      final NotificationChannel channel = new NotificationChannel(channelId,
          ht ? "X COREA HT • vibrații" : confirmed ? (quiet ? "X57 Coreea • confirmare • noapte" : "X57 Coreea • confirmare")
                    : (quiet ? "X57 Coreea • candidat • noapte" : "X57 Coreea • candidat"),
          confirmed ? NotificationManager.IMPORTANCE_HIGH : NotificationManager.IMPORTANCE_DEFAULT);
      channel.setDescription("Filtru experimental X57 — notificare informativa, fara pariu automat");
      channel.enableVibration(true);
      channel.setVibrationPattern(confirmed ? new long[]{0, 300, 180, 320, 180, 240}
          : new long[]{0, 200, 170, 190});
      channel.setSound(null, null);
      channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
      manager.createNotificationChannel(channel);
      final NotificationChannel effective=manager.getNotificationChannel(channelId);
      if(effective==null || effective.getImportance()==NotificationManager.IMPORTANCE_NONE)return;

      final String fixture = data.getOrDefault("fixture", "Meci");
      final String minute = data.getOrDefault("minute", confirmed ? "57" : "45");
      final String x45 = decimal(data.get("px45"));
      final String px = decimal(data.get("px"));
      final String gh = generosityPct(data.get("gh"));
      final String ga = generosityPct(data.get("ga"));
      final String title = ht ? "🧬 X COREA HT · PAUZĂ" : "🧬 X57 COREA";
      final String body = fixture + "\n"
          + (ht ? "0–0 la pauză · semnal experimental" : confirmed ? "✅ CONFIRMAT 57′ · 0–0 la min. " + minute + " · criteriile X57 îndeplinite"
                       : "🕒 CANDIDAT PAUZĂ · 0–0 · așteaptă verificarea de la 57′") + "\n"
          + (ht ? "X la pauză: " + px : "X45: " + x45 + " · X acum: " + px) + "\n"
          + (confirmed ? "Generosity: acasă " + gh + " · deplasare " + ga + "\n" : "")
          + "Experimental • NU este BET NOW și NU pune bilet automat";
      final int notificationId = (int) (eventId % 150000) + (ht ? 1050000 : confirmed ? 880000 : 710000);

      final Notification note = new Notification.Builder(context, channelId)
          .setSmallIcon(R.drawable.sbr_alert_dna)
          .setContentTitle(title)
          .setContentText((ht ? "PAUZĂ · " : confirmed ? "✓ CONFIRMAT · " : "◉ CANDIDAT · ") + fixture + " · X " + px)
          .setStyle(new Notification.BigTextStyle().bigText(body))
          .setContentIntent(AlertService.open(context, notificationId,
              "/app?tab=live&event_id=" + eventId))
          .setColor(confirmed ? 0xff55ccae : 0xff64b3d6)
          .setCategory(Notification.CATEGORY_STATUS)
          .setVisibility(Notification.VISIBILITY_PUBLIC)
          .setAutoCancel(true)
          .setOnlyAlertOnce(true)
          .build();

      manager.notify(notificationId, note);
      prefs.edit().putBoolean(dedup, true).apply();
      acknowledge(context,eventId,stage);
    } catch (Exception exception) {
      android.util.Log.w("SB_Radar_X57", "Unable to show experimental alert", exception);
    }
  }
}
