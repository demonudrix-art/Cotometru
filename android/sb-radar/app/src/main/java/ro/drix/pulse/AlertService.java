package ro.drix.pulse;

import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import org.json.*;
import java.net.*;
import java.io.*;

public class AlertService extends Service {
  static final String CH_MONITOR="sb_radar_monitor_v230";
  static final String CH_SIGNALS="sb_radar_signals_v230";
  static final int FOREGROUND_ID=1310;
  volatile boolean running=false;
  Thread thread;
  @Override public void onCreate(){super.onCreate();ensureChannels();}
  @Override public IBinder onBind(Intent i){return null;}
  private void ensureChannels(){
    NotificationManager mgr=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
    if(Build.VERSION.SDK_INT>=26){
      NotificationChannel monitor=new NotificationChannel(CH_MONITOR,"SB Radar • Monitor activ",NotificationManager.IMPORTANCE_LOW);
      monitor.setDescription("Monitorizarea meciurilor este activă");mgr.createNotificationChannel(monitor);
      NotificationChannel signals=new NotificationChannel(CH_SIGNALS,"SB Radar • Alerte BET NOW",NotificationManager.IMPORTANCE_HIGH);
      signals.enableVibration(true);mgr.createNotificationChannel(signals);
    }
  }
  static PendingIntent open(Context ctx,int code,String path){
    Intent i=new Intent(ctx,MainActivity.class);
    i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
    i.setData(Uri.parse(MainActivity.BASE+path));
    return PendingIntent.getActivity(ctx,code,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  }
  static Notification.Builder builder(Context ctx,String channel){
    if(Build.VERSION.SDK_INT>=26)return new Notification.Builder(ctx,channel);
    return new Notification.Builder(ctx);
  }
  @Override public int onStartCommand(Intent intent,int flags,int startId){
    if(intent!=null&&"STOP".equals(intent.getAction())){stopSelf();return START_NOT_STICKY;}
    Notification foreground=builder(this,CH_MONITOR).setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentTitle("SB Radar • Monitor activ").setContentText("Monitorizarea meciurilor este activă.")
      .setContentIntent(open(this,FOREGROUND_ID,"/app?tab=live")).setOngoing(true).build();
    startForeground(FOREGROUND_ID,foreground);
    if(running)return START_STICKY;
    running=true;thread=new Thread(()->{while(running){try{checkAlerts();}catch(Exception e){android.util.Log.w("SB_Radar","Monitor temporarily unavailable");}
      try{Thread.sleep(25000);}catch(InterruptedException ignored){break;}}},"SB-Radar-monitor");
    thread.start();return START_STICKY;
  }
  private void checkAlerts()throws Exception {
    String token=MainActivity.token(this);if(token.isEmpty())return;
    String json=MainActivity.readHttp(MainActivity.BASE+"/api/mobile/alerts",token,null);
    JSONArray arr=new JSONObject(json).optJSONArray("alerts");if(arr==null)return;
    android.content.SharedPreferences prefs=getSharedPreferences(MainActivity.PREF_NAME,MODE_PRIVATE);
    for(int i=0;i<arr.length();i++){
      JSONObject row=arr.optJSONObject(i);if(row==null)continue;
      long event=row.optLong("event_id",0);String stage=row.optString("stage","");
      boolean win="WIN".equals(stage)||row.optBoolean("native_win_compat",false);
      if(event<=0||(!win&&!"BET_NOW".equals(stage)))continue;
      String category=row.optString("signal_label","");
      // Public users receive generic alerts; admin-only category names are not exposed.
      String key="notified_"+event+"_"+(win?"win":"betnow");
      if(prefs.getBoolean(key,false))continue;
      String fixture=row.optString("fixture","Meci").replaceFirst("^\\[[^\\]]+\\]\\s*","");
      String title=win?"SB Radar • Bilet câștigat":category.equals("GOLDEN TICKET")?"🏆 SB Radar • Golden Ticket":category.equals("BETA B")?"🟠 SB Radar • Beta B":category.equals("ML")?"🧠 SB Radar • ML":"SB Radar • BET NOW";
      int min=row.optInt("minute",0);String score=row.optString("home_score","-")+"–"+row.optString("away_score","-");
      String body=fixture+(win?" • Rezultat confirmat":"\nMin. "+min+" • "+score+" • Egal (X) "+String.format(java.util.Locale.US,"%.2f",row.optDouble("px",0)));
      String path=win?"/app?tab=slip&bet_id="+row.optLong("bet_id",0):"/app?tab=live&event_id="+event;
      int notificationId=(int)(Math.abs(event)%100000)+3000+(win?100000:0);
      Notification n=builder(this,CH_SIGNALS).setSmallIcon(android.R.drawable.ic_dialog_info).setAutoCancel(true)
        .setContentTitle(title).setContentText(body).setStyle(new Notification.BigTextStyle().bigText(body))
        .setContentIntent(open(this,notificationId,path)).build();
      ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(notificationId,n);
      prefs.edit().putBoolean(key,true).apply();
      if(!win){try{JSONObject ack=new JSONObject();ack.put("event_id",event);ack.put("stage","BET_NOW");
        MainActivity.readHttp(MainActivity.BASE+"/api/mobile/ack",token,ack.toString());}catch(Exception ignored){}}
    }
  }
  static void testAlert(Context c){
    NotificationManager mgr=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
    if(Build.VERSION.SDK_INT>=26){
      NotificationChannel ch=new NotificationChannel(CH_SIGNALS,"SB Radar • Alerte BET NOW",NotificationManager.IMPORTANCE_HIGH);
      mgr.createNotificationChannel(ch);
    }
    mgr.notify(2310,builder(c,CH_SIGNALS).setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentTitle("SB Radar • Notificare test").setContentText("Atinge pentru a deschide aplicația")
      .setContentIntent(open(c,2310,"/app?tab=live")).setAutoCancel(true).build());
  }
  @Override public void onDestroy(){running=false;if(thread!=null)thread.interrupt();super.onDestroy();}
}