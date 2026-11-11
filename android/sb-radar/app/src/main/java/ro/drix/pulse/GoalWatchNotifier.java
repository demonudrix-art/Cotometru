package ro.drix.pulse;
import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import java.util.*;
/** Native notification restored from the installed 2.3.34 baseline, independent of Away57. */
final class GoalWatchNotifier {
 private static final String DAY="sb_radar_goal_watch_day_v231",NIGHT="sb_radar_goal_watch_night_v231";
 private GoalWatchNotifier(){}
 static void post(Context ctx,Map<String,String> d){
  try{
   long id=Long.parseLong(d.getOrDefault("event_id","0"));
   if(id<=0||(Build.VERSION.SDK_INT>=33&&ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED))return;
   SharedPreferences pref=ctx.getSharedPreferences(MainActivity.PREF_NAME,Context.MODE_PRIVATE);
   String key="goal_watch_seen_v231_"+id;if(pref.getBoolean(key,false))return;
   NotificationManager mgr=(NotificationManager)ctx.getSystemService(Context.NOTIFICATION_SERVICE);if(mgr==null)return;
   int h=Calendar.getInstance(TimeZone.getTimeZone("Europe/Bucharest")).get(Calendar.HOUR_OF_DAY);
   boolean quiet=h>=22||h<5;String channel=quiet?NIGHT:DAY;
   NotificationChannel ch=new NotificationChannel(channel,quiet?"⚡ Goal Watch • vibrație 22–05":"⚡ Goal Watch • Over 0.5",NotificationManager.IMPORTANCE_HIGH);
   ch.setDescription("Alertă informativă Over 0.5 la 57′, fără plasare automată");ch.enableVibration(true);
   ch.setVibrationPattern(quiet?new long[]{0,190,150,190}:new long[]{0,240,150,290,150,160});
   if(quiet)ch.setSound(null,null);
   else ch.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT).build());
   ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);mgr.createNotificationChannel(ch);
   String fixture=d.getOrDefault("fixture","Meci"),risk=d.getOrDefault("goal_risk_pct","—");
   String hDrop=d.getOrDefault("drop_home_pp","—"),aDrop=d.getOrDefault("drop_away_pp","—");
   String body=fixture+"\n0–0 la 57′ · Risc gol "+risk+"%\nGenerosity: gazde −"+hDrop+" pp, oaspeți −"+aDrop+" pp\nOver 0.5 până la final · informativ, fără pariu automat";
   int nid=(int)(id%160000)+780000;
   Notification note=new Notification.Builder(ctx,channel).setSmallIcon(R.drawable.sbr_status_goalwatch)
    .setContentTitle("⚡ GOAL WATCH · OVER 0.5").setContentText(fixture+" · Risc "+risk+"%")
    .setStyle(new Notification.BigTextStyle().bigText(body)).setColor(0xff29b0b1)
    .setAutoCancel(true).setOnlyAlertOnce(true).setCategory(Notification.CATEGORY_STATUS)
    .setVisibility(Notification.VISIBILITY_PUBLIC)
    .setContentIntent(AlertService.open(ctx,nid,"/app?tab=live&goal_watch="+id)).build();
   mgr.notify(nid,note);pref.edit().putBoolean(key,true).apply();
  }catch(Exception ignored){}
 }
}
