package ro.drix.pulse;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import java.util.Locale;
import java.util.Map;

/** Owner-only information / verified journal WIN notifications. Never starts a bet. */
final class RadarInfoWinNotifier {
  private static final String CH_INFO="sb_radar_xcoverage_info_v250";
  private static final String CH_WIN="sb_radar_wins_verified_v250";
  private RadarInfoWinNotifier(){}

  static synchronized void post(Context context, Map<String,String> data){
    final String stage=data.getOrDefault("stage","");
    final boolean win="BET_WON".equals(stage);
    if(!win && !"X_COVERAGE_INFO".equals(stage))return;
    if(Build.VERSION.SDK_INT>=33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;
    final long eventId, betId;
    try {
      eventId=Long.parseLong(data.getOrDefault("event_id","0"));
      betId=win?Long.parseLong(data.getOrDefault("bet_id","0")):0L;
    }catch(NumberFormatException e){return;}
    if(eventId<=0 || (win&&betId<=0))return;
    final SharedPreferences prefs=context.getSharedPreferences(MainActivity.PREF_NAME,Context.MODE_PRIVATE);
    final String dedup="sb_info_win_seen_v250_"+stage+"_"+(win?betId:eventId);
    if(prefs.getBoolean(dedup,false))return;
    final NotificationManager mgr=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
    if(mgr==null)return;
    final String channelId=win?CH_WIN:CH_INFO;
    final NotificationChannel channel=new NotificationChannel(channelId,
      win?"SB Radar • Bilete câștigate":"SB Radar • X-COVERAGE informativ",
      win?NotificationManager.IMPORTANCE_HIGH:NotificationManager.IMPORTANCE_DEFAULT);
    channel.setDescription("Notificări informative, fără sunet, fără apel Twilio și fără pariu automat");
    channel.enableVibration(true);
    channel.setVibrationPattern(win?new long[]{0,260,160,260}:new long[]{0,160,180,160});
    channel.setSound(null,null);
    channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    mgr.createNotificationChannel(channel);
    final String fixture=data.getOrDefault("fixture","Meci");
    final String title=win?"✅ SB Radar • Bilet câștigat":"🔎 SB Radar • X-COVERAGE informativ";
    final String body;
    final String path;
    if(win){
      String gain=data.getOrDefault("profit_lei","—");
      body=fixture+"\nDecontat WIN în jurnalul SB Radar • Profit +"+gain+" lei.\nDeschide biletul și verifică rezultatul.";
      path="/app?tab=slip&bet_id="+betId;
    }else{
      final String px=data.getOrDefault("px","—");
      final String minute=data.getOrDefault("minute",data.getOrDefault("checkpoint","57"));
      body=fixture+"\n"+data.getOrDefault("home_score","—")+"–"+data.getOrDefault("away_score","—")+
        " • minutul "+minute+"′ • X @ "+px+"\nDOAR informativ, model experimental. NU BET NOW.";
      path="/app?tab=live&event_id="+eventId;
    }
    final int notificationId=(int)((win?betId:eventId)%200000)+(win?770000:550000);
    final Notification note=new Notification.Builder(context,channelId)
      .setSmallIcon(win?android.R.drawable.ic_dialog_info:R.drawable.sbr_alert_dna)
      .setContentTitle(title)
      .setContentText(fixture)
      .setStyle(new Notification.BigTextStyle().bigText(body))
      .setContentIntent(AlertService.open(context,notificationId,path))
      .setColor(win?0xff5acda9:0xff65a5df)
      .setCategory(Notification.CATEGORY_STATUS)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setAutoCancel(true)
      .setOnlyAlertOnce(true)
      .build();
    mgr.notify(notificationId,note);
    prefs.edit().putBoolean(dedup,true).apply();
  }
}
