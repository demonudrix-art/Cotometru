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
import java.util.Map;
import java.util.TimeZone;

/** Dedicated KLOPP X57 experimental alert, separate from Radio and Goal Watch. */
final class KloppWaveNotifier {
  private static final String DAY="sb_radar_klopp_wave_day_v232";
  private static final String NIGHT="sb_radar_klopp_wave_night_v232";
  private KloppWaveNotifier(){}
  static void post(Context ctx,Map<String,String> data){
    long eventId;
    try{eventId=Long.parseLong(data.getOrDefault("event_id","0"));}
    catch(Exception e){return;}
    if(eventId<=0)return;
    if(Build.VERSION.SDK_INT>=33&&ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;
    SharedPreferences prefs=ctx.getSharedPreferences(MainActivity.PREF_NAME,Context.MODE_PRIVATE);
    String seen="klopp_wave_fcm_seen_v232_"+eventId;
    if(prefs.getBoolean(seen,false))return;
    NotificationManager nm=(NotificationManager)ctx.getSystemService(Context.NOTIFICATION_SERVICE);
    if(nm==null)return;
    int h=Calendar.getInstance(TimeZone.getTimeZone("Europe/Bucharest")).get(Calendar.HOUR_OF_DAY);
    boolean quiet=h>=22||h<5;
    String channel=quiet?NIGHT:DAY;
    NotificationChannel ch=new NotificationChannel(channel,quiet?"KLOPP WAVE • vibrație nocturnă":"KLOPP WAVE • Test 2 lei",NotificationManager.IMPORTANCE_HIGH);
    ch.setDescription("Semnal experimental X57 pentru confirmare manuală; fără plasare automată.");
    ch.enableVibration(true);
    ch.setVibrationPattern(quiet?new long[]{0,180,140,200}:new long[]{0,280,120,300,100,220});
    if(quiet)ch.setSound(null,null);
    else{
      Uri sound=RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
      ch.setSound(sound,new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT).build());
    }
    ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    nm.createNotificationChannel(ch);
    String fixture=data.getOrDefault("fixture","Meci");
    String price=data.getOrDefault("px","—");
    String filter=data.getOrDefault("filter_id","FAIR42");
    String fair=data.getOrDefault("fair_x_pct","—");
    String body=fixture+"\n0–0 la 57′ • Egal X @ "+price+" • "+filter+
      "\nFAIR X "+fair+"% • Miză test 2 lei"+
      "\nEXPERIMENTAL • Confirmă manual pariul real în KLOPP Slip.";
    int notifId=945000+(int)(eventId%50000L);
    Notification alert=new Notification.Builder(ctx,channel)
      .setSmallIcon(R.drawable.sbr_status_purple)
      .setContentTitle("🪙 KLOPP BET NOW • TEST 2 LEI")
      .setContentText(fixture+" • X @ "+price+" • "+filter)
      .setStyle(new Notification.BigTextStyle().bigText(body))
      .setColor(0xffc398e8)
      .setAutoCancel(true).setOnlyAlertOnce(true)
      .setCategory(Notification.CATEGORY_STATUS)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setContentIntent(AlertService.open(ctx,notifId,"/app?tab=klopp"))
      .build();
    nm.notify(notifId,alert);
    prefs.edit().putBoolean(seen,true).apply();
  }
}
