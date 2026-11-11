package ro.drix.pulse;
import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import java.util.*;
/** Retains KLOPP experimental notification behavior from the previous signed APK. */
final class KloppWaveNotifier {
 private static final String DAY="sb_radar_klopp_wave_day_v232",NIGHT="sb_radar_klopp_wave_night_v232";
 private KloppWaveNotifier(){}
 static void post(Context ctx,Map<String,String> d){
  try{
   long id=Long.parseLong(d.getOrDefault("event_id","0"));
   if(id<=0||(Build.VERSION.SDK_INT>=33&&ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED))return;
   SharedPreferences pref=ctx.getSharedPreferences(MainActivity.PREF_NAME,Context.MODE_PRIVATE);
   String key="klopp_wave_fcm_seen_v232_"+id;if(pref.getBoolean(key,false))return;
   NotificationManager mgr=(NotificationManager)ctx.getSystemService(Context.NOTIFICATION_SERVICE);if(mgr==null)return;
   int h=Calendar.getInstance(TimeZone.getTimeZone("Europe/Bucharest")).get(Calendar.HOUR_OF_DAY);
   boolean quiet=h>=22||h<5;String channel=quiet?NIGHT:DAY;
   NotificationChannel ch=new NotificationChannel(channel,quiet?"KLOPP WAVE • vibrație nocturnă":"KLOPP WAVE • Test 2 lei",NotificationManager.IMPORTANCE_HIGH);
   ch.setDescription("Semnal experimental X57 pentru confirmare manuală; fără plasare automată");
   ch.enableVibration(true);ch.setVibrationPattern(quiet?new long[]{0,180,140,200}:new long[]{0,280,120,300,100,220});
   if(quiet)ch.setSound(null,null);
   else ch.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT).build());
   ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);mgr.createNotificationChannel(ch);
   String fixture=d.getOrDefault("fixture","Meci"),price=d.getOrDefault("px","—");
   String filter=d.getOrDefault("filter_id","FAIR42"),fair=d.getOrDefault("fair_x_pct","—");
   String body=fixture+"\n0–0 la 57′ • Egal X @ "+price+" • "+filter+"\nFAIR X "+fair+"% • Miză test 2 lei\nEXPERIMENTAL • Confirmă manual pariul real în KLOPP Slip.";
   int nid=(int)(id%50000)+945000;
   Notification note=new Notification.Builder(ctx,channel).setSmallIcon(R.drawable.sbr_status_purple)
    .setContentTitle("🪙 KLOPP BET NOW • TEST 2 LEI").setContentText(fixture+" • X @ "+price+" • "+filter)
    .setStyle(new Notification.BigTextStyle().bigText(body)).setColor(0xffae95e8).setAutoCancel(true)
    .setOnlyAlertOnce(true).setCategory(Notification.CATEGORY_STATUS)
    .setVisibility(Notification.VISIBILITY_PUBLIC).setContentIntent(AlertService.open(ctx,nid,"/app?tab=klopp")).build();
   mgr.notify(nid,note);pref.edit().putBoolean(key,true).apply();
  }catch(Exception ignored){}
 }
}
