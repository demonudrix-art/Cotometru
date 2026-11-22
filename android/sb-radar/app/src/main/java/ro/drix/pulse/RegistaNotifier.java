package ro.drix.pulse;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Locale;

/**
 * Regista local vibration polling (NO FCM, NO Twilio).
 * Called by the existing AlertService foreground monitor, approximately every 25 seconds.
 * Never makes a betting transaction and never marks an unverified signal as actionable.
 */
final class RegistaNotifier {
  private static final String CHANNEL="sb_regista_local_vibrate_v1";
  private RegistaNotifier(){}

  static void poll(Context context) {
    if(Build.VERSION.SDK_INT>=33 &&
       context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;
    final String token=MainActivity.token(context);
    if(token==null||token.isEmpty())return;
    try{
      JSONObject data=new JSONObject(MainActivity.readHttp(
        MainActivity.BASE+"/api/mobile/regista/alerts",token,null));
      if(!"LOCAL_VIBRATE_NO_FCM".equals(data.optString("mode","")))return;
      JSONArray alerts=data.optJSONArray("alerts");
      if(alerts==null||alerts.length()==0)return;

      NotificationManager mgr=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
      if(mgr==null)return;
      NotificationChannel channel=new NotificationChannel(CHANNEL,
        "♜ Regista · BET NOW · doar vibrații",NotificationManager.IMPORTANCE_HIGH);
      channel.setDescription("Alerta Regista verificată înainte de meci. Numai vibrații locale, fără sunet sau FCM.");
      channel.enableVibration(true);
      channel.setVibrationPattern(new long[]{0,270,160,270,180,650});
      channel.setSound(null,null);
      channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
      mgr.createNotificationChannel(channel);

      SharedPreferences prefs=context.getSharedPreferences(MainActivity.PREF_NAME,Context.MODE_PRIVATE);
      for(int i=0;i<alerts.length();i++){
        JSONObject signal=alerts.optJSONObject(i);
        if(signal==null||!"BET_NOW".equals(signal.optString("stage",""))||
           !"REGISTA".equals(signal.optString("source","")))continue;
        long eventId=signal.optLong("event_id",0);
        double odds=signal.optDouble("odds",0),prob=signal.optDouble("probability_pct",-1);
        String id=signal.optString("signal_id",""),market=signal.optString("market","").toUpperCase(Locale.ROOT);
        if(eventId<=0||id.length()<8||id.length()>128||
           !("1".equals(market)||"X".equals(market)||"2".equals(market))||
           !Double.isFinite(odds)||odds<=1||!Double.isFinite(prob)||prob<0||prob>100)continue;
        String key="regista_native_seen_v1_"+id;
        if(prefs.getBoolean(key,false))continue;
        final String fixture=signal.optString("fixture","Meci");
        final String family=signal.optString("list_code","REGISTA");
        final String path="/app?tab=live&event_id="+eventId+"&regista=1";
        final int notificationId=650000+(id.hashCode()&0x7fffffff)%300000;
        final String text=fixture+"\n"+family+" · selecția "+market+
          " · "+String.format(Locale.US,"%.0f",prob)+"%"+
          " · cotă Superbet "+String.format(Locale.US,"%.2f",odds)+
          "\nVerifică piața și decide manual dacă pregătești un bilet.";
        Notification n=new Notification.Builder(context,CHANNEL)
          .setSmallIcon(R.drawable.sbr_alert_regista)
          .setContentTitle("♜ REGISTA · BET NOW")
          .setContentText(fixture+" · "+market+" @ "+String.format(Locale.US,"%.2f",odds))
          .setStyle(new Notification.BigTextStyle().bigText(text))
          .setContentIntent(AlertService.open(context,notificationId,path))
          .addAction(R.drawable.sbr_alert_regista,
            "BET NOW · verifică",AlertService.open(context,notificationId+1,path))
          .setCategory(Notification.CATEGORY_REMINDER)
          .setVisibility(Notification.VISIBILITY_PUBLIC)
          .setPriority(Notification.PRIORITY_HIGH)
          .setAutoCancel(true)
          .setOnlyAlertOnce(true)
          .setColor(0xff65d8bd)
          .build();
        mgr.notify(notificationId,n);
        prefs.edit().putBoolean(key,true).apply();
        try{
          JSONObject ack=new JSONObject();ack.put("signal_id",id);
          MainActivity.readHttp(MainActivity.BASE+"/api/mobile/regista/ack",token,ack.toString());
        }catch(Exception ignored){}
      }
    }catch(Exception e){
      android.util.Log.w("SB_Radar_Regista","Regista polling unavailable",e);
    }
  }
}