package ro.drix.pulse;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import java.util.Calendar;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;

/**
 * GOAL WATCH — Over 0.5 information only. Independent notification ID/channel.
 * No betting callbacks, full-screen takeover, call, or changes to red/purple alerts.
 */
final class GoalWatchNotifier {
  private static final String CH_DAY="sb_radar_goal_watch_day_v231";
  private static final String CH_NIGHT="sb_radar_goal_watch_night_v231";
  private GoalWatchNotifier(){}

  static void post(Context ctx,Map<String,String> data){
    long eventId;
    try{eventId=Long.parseLong(data.getOrDefault("event_id","0"));}
    catch(Exception e){return;}
    if(eventId<=0)return;
    String idKey="goal_watch_seen_v231_"+eventId;
    SharedPreferences prefs=ctx.getSharedPreferences(MainActivity.PREF_NAME,Context.MODE_PRIVATE);
    if(prefs.getBoolean(idKey,false))return;
    if(Build.VERSION.SDK_INT>=33&&ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;
    NotificationManager manager=(NotificationManager)ctx.getSystemService(Context.NOTIFICATION_SERVICE);
    if(manager==null)return;

    Calendar local=Calendar.getInstance(TimeZone.getTimeZone("Europe/Bucharest"));
    int hour=local.get(Calendar.HOUR_OF_DAY);
    boolean quiet=hour>=22||hour<5;
    String channel=quiet?CH_NIGHT:CH_DAY;
    NotificationChannel ch=new NotificationChannel(channel,
      quiet?"⚡ Goal Watch • vibrație 22–05":"⚡ Goal Watch • Over 0.5",
      NotificationManager.IMPORTANCE_HIGH);
    ch.setDescription("Alertă informativă Over 0.5 la 57′, fără plasare automată");
    ch.enableVibration(true);
    ch.setVibrationPattern(quiet?new long[]{0,190,150,190}:new long[]{0,240,150,290,150,160});
    if(quiet)ch.setSound(null,null);
    else {
      Uri sound=RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
      AudioAttributes attrs=new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT).build();
      ch.setSound(sound,attrs);
    }
    ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    manager.createNotificationChannel(ch);

    String fixture=data.getOrDefault("fixture","Meci");
    String risk=data.getOrDefault("goal_risk_pct","—");
    String homeDrop=data.getOrDefault("drop_home_pp","—");
    String awayDrop=data.getOrDefault("drop_away_pp","—");
    String body=fixture+"\n0–0 la 57′ · Risc gol "+risk+"%"+
      "\nGenerosity: gazde −"+homeDrop+" pp, oaspeți −"+awayDrop+" pp"+
      "\nOver 0.5 până la final · informativ, fără pariu automat";
    int notificationId=780000+(int)(eventId%160000L);
    Notification notification=new Notification.Builder(ctx,channel)
      .setSmallIcon(R.drawable.sbr_status_goalwatch)
      .setContentTitle("⚡ GOAL WATCH · OVER 0.5")
      .setContentText(fixture+" · Risc "+risk+"%")
      .setStyle(new Notification.BigTextStyle().bigText(body))
      .setColor(0xff29c8b1)
      .setAutoCancel(true)
      .setOnlyAlertOnce(true)
      .setCategory(Notification.CATEGORY_STATUS)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setContentIntent(AlertService.open(ctx,notificationId,"/app?tab=live&goal_watch="+eventId))
      .build();
    manager.notify(notificationId,notification);
    prefs.edit().putBoolean(idKey,true).apply();
  }
}
