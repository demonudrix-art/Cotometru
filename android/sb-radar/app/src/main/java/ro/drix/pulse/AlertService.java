package ro.drix.pulse;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.*;
import org.json.*;
import java.util.Locale;
import java.util.Calendar;
import java.util.TimeZone;

public class AlertService extends Service {
  static final String CH_MONITOR="sb_radar_monitor_v230";
  static final String CH_GOLD="sb_radar_strong_alarm_v2316";
  static final String CH_ML="sb_radar_purple_alarm_v2316";
  static final String CH_NIGHT="sb_radar_vibration_night_v2315";
  static final String CH_WINS="sb_radar_wins_v232";
  static final int FOREGROUND_ID=1310;
  static final String SILENCE="SILENCE";
  private static volatile AlertService current;
  private static final Handler MAIN=new Handler(Looper.getMainLooper());
  private static Runnable ringTimeout;
  static boolean nightQuiet(){return false;} // User enabled urgent purple/red alerts and fullscreen 24/7.
  private MediaPlayer player;
  private Vibrator vibrator;
  volatile boolean running=false;
  Thread thread;

  @Override public void onCreate(){ super.onCreate();current=this;ensureChannels(); }
  @Override public IBinder onBind(Intent i){return null;}
  private void ensureChannels(){
    NotificationManager mgr=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
    NotificationChannel monitor=new NotificationChannel(CH_MONITOR,"SB Radar • Monitor activ",NotificationManager.IMPORTANCE_LOW);
    monitor.setDescription("Monitorizarea alertelor SB Radar");mgr.createNotificationChannel(monitor);
    ensureUrgentChannels(this);
    NotificationChannel wins=new NotificationChannel(CH_WINS,"Bilete câștigate",NotificationManager.IMPORTANCE_HIGH);
    wins.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);mgr.createNotificationChannel(wins);
  }
  // Channels are immutable: v237 restores urgent audio/vibration without changing users\u0027 previous channel settings.
  private static void ensureUrgentChannels(Context context){
    NotificationManager mgr=(NotificationManager)context.getSystemService(NOTIFICATION_SERVICE);
    Uri ring=RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
    AudioAttributes soundAttrs=new AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
    NotificationChannel gold=new NotificationChannel(CH_GOLD,"🔴 Strong • Alarmă fullscreen 24/7",NotificationManager.IMPORTANCE_HIGH);
    gold.setDescription("Golden Strong: notificare fullscreen, alarmă și vibrație 24/7");
    gold.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    gold.enableVibration(true);
    gold.setVibrationPattern(new long[]{0,650,350,650,900});
    gold.setSound(ring,soundAttrs);
    mgr.createNotificationChannel(gold);
    NotificationChannel ml=new NotificationChannel(CH_ML,"🟣 Strong + Silver • Alarmă fullscreen 24/7",NotificationManager.IMPORTANCE_HIGH);
    ml.setDescription("Strong + Silver: notificare fullscreen, alarmă și vibrație 24/7");
    ml.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    ml.enableVibration(true);
    ml.setVibrationPattern(new long[]{0,420,250,420,250,420});
    ml.setSound(ring,soundAttrs);
    mgr.createNotificationChannel(ml);
    NotificationChannel night=new NotificationChannel(CH_NIGHT,"SB Radar • Vibrație nocturnă 22–05",NotificationManager.IMPORTANCE_HIGH);
    night.setDescription("Golden Ticket, Gold Rush, GG Power: numai vibrație noaptea, fără sunet sau apel.");
    night.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    night.enableVibration(true);
    night.setVibrationPattern(new long[]{0,320,180,320,180,320});
    night.setSound(null,null);
    mgr.createNotificationChannel(night);
  }

  static PendingIntent open(Context ctx,int code,String path){
    Intent i=new Intent(ctx,MainActivity.class);
    i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
    i.setData(Uri.parse(MainActivity.BASE+path));
    i.putExtra("sb_alert_id",code);
    return PendingIntent.getActivity(ctx,code,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  }
  static Notification.Builder builder(Context ctx,String channel){return new Notification.Builder(ctx,channel);}
  static void silence(Context context){
    AlertAttention.stop();
    AlertService s=current;
    if(s!=null)s.stopRinging();
  }
  // Mark before stopping to prevent a delayed FCM foreground-service start from re-ringing.
  static synchronized void dismiss(Context context,int notificationId){
    if(notificationId>0){
      context.getSharedPreferences(MainActivity.PREF_NAME,Context.MODE_PRIVATE).edit()
        .putBoolean("dismissed_alert_"+notificationId,true).commit();
    }
    silence(context);
    if(notificationId>0){
      ((NotificationManager)context.getSystemService(NOTIFICATION_SERVICE)).cancel(notificationId);
    }
  }
  private static boolean canRing(Context context,int id){
    if(id<=0||context.getSharedPreferences(MainActivity.PREF_NAME,Context.MODE_PRIVATE)
       .getBoolean("dismissed_alert_"+id,false))return false;
    try{
      NotificationManager manager=(NotificationManager)context.getSystemService(NOTIFICATION_SERVICE);
      for(android.service.notification.StatusBarNotification n:manager.getActiveNotifications()){
        if(n.getId()==id)return true;
      }
    }catch(Exception ignored){}
    return false;
  }
  private static synchronized void ringIfActive(Context context,int id){
    if(!nightQuiet()&&canRing(context,id))AlertAttention.start(context);
  }
  private static String signalTitle(boolean gold,String modelVersion){
    String normalized=modelVersion==null?"":modelVersion.toUpperCase(Locale.ROOT);
    if(normalized.contains("STRONG + SILVER")||normalized.contains("STRONG_SILVER")||normalized.contains("STRONG-SILVER"))
      return "🟣 GOLDEN STRONG + SILVER • 75 LEI • SB Radar";
    if(normalized.contains("STRONG"))return "🔴 GOLDEN STRONG • 50 LEI • SB Radar";
    if(modelVersion!=null&&modelVersion.toUpperCase(Locale.ROOT).contains("GG_POWER"))return "⚡ GG POWER • 50 LEI • SB Radar";
    if(gold)return "🏆 GOLDEN TICKET • SB Radar";
    String v=modelVersion==null?"":modelVersion.toUpperCase(Locale.ROOT);
    if(v.contains("GOLD_RUSH"))return "💰 GOLD RUSH • SB Radar";
    if(v.isEmpty()||v.contains("SHADOW_HOURLY"))return "🧠 ML • ANTRENAT ORAR • SB Radar";
    if(v.contains("TREND_V2")||v.contains("GENVAR"))return "🧠 ML V2 • SB Radar";
    return "🧠 ML • MODEL NECUNOSCUT • SB Radar";
  }
  private synchronized void stopRinging(){AlertAttention.stop();}
  @Override public int onStartCommand(Intent intent,int flags,int startId){
    String action=intent==null?"START":intent.getAction();
    if(SILENCE.equals(action)){stopRinging();return START_STICKY;}
    if("STOP".equals(action)){stopSelf();return START_NOT_STICKY;}
    Notification foreground=builder(this,CH_MONITOR).setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentTitle("SB Radar • Monitor activ").setContentText("Urmărește Strong + Silver și Golden Strong")
      .setContentIntent(open(this,FOREGROUND_ID,"/app?tab=live")).setOngoing(true).build();
    startForeground(FOREGROUND_ID,foreground);
    if("TEST_GOLD".equals(action)||"TEST_RUSH".equals(action)){
      boolean gold="TEST_GOLD".equals(action);
      showSignal(gold?"GOLDEN TICKET":"GOLD RUSH",0,"Simulare notificare", "Acesta este un test local. Nu este un semnal real.\n⏱ MINUTUL 57 • SCOR 0–0\n🎯 PARIU EGAL (X) • COTĂ 2.10\nMIZĂ SUGERATĂ 20 LEI",
        "/app?tab=live",gold?"":"SB_GOLD_RUSH_00_M57_X205_214_V1",true); 
    }
    if("RING_FCM".equals(action)&&intent!=null)ringIfActive(this,intent.getIntExtra("notification_id",0));
    if(running)return START_STICKY;
    running=true;
    thread=new Thread(()->{
      while(running){
        // Keep System Pulse fresh even when MainActivity is paused/backgrounded.
        // Uses the EXISTING foreground monitor; no new Android service or permission.
        SystemPulse.heartbeat(this,MainActivity.isAppForeground());
        try{checkAlerts();}catch(Exception e){android.util.Log.w("SB_Radar","Monitor temporarily unavailable");}
        try{Thread.sleep(25000);}catch(InterruptedException ignored){break;}
      }
    },"SB-Radar-monitor");
    thread.start();return START_STICKY;
  }
  private boolean notificationsAllowed(){
    return Build.VERSION.SDK_INT<33||checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED;
  }
  private void showSignal(String category,int notificationId,String fixture,String body,String path,String modelVersion,boolean test){
    if(!notificationsAllowed())return;
    boolean purple=category.contains("STRONG + SILVER")||category.contains("STRONG_SILVER")||
      (modelVersion!=null&&(modelVersion.contains("STRONG_SILVER")||modelVersion.contains("STRONG + SILVER")));
    boolean gold="GOLDEN TICKET".equals(category)||"STRONG".equals(category);
    boolean quiet=nightQuiet();
    String channel=purple?CH_ML:CH_GOLD;
    String title=signalTitle(gold,(modelVersion==null?"":modelVersion)+" "+category);
    NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
    int id=notificationId==0?(gold?23201:23202):notificationId;
    Intent fs=new Intent(this,AlertScreenActivity.class);
    fs.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
    fs.putExtra("title",title);fs.putExtra("body",body);fs.putExtra("path",path);fs.putExtra("notification_id",id);
    PendingIntent full=PendingIntent.getActivity(this,id+400000,fs,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    Intent dismiss=new Intent(this,AlertDismissReceiver.class).setAction("ro.drix.pulse.SILENCE");
    dismiss.putExtra("notification_id",id);
    PendingIntent silent=PendingIntent.getBroadcast(this,id,dismiss,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    Notification.Builder b=builder(this,channel).setSmallIcon(android.R.drawable.ic_dialog_info)
      .setSmallIcon(purple?R.drawable.sbr_status_purple:R.drawable.sbr_status_red)
       .setContentTitle(title).setContentText(fixture+" • EGAL (X)").setStyle(new Notification.BigTextStyle().bigText(body))
      .setContentIntent(open(this,id,path)).setAutoCancel(true)
      .setPriority(Notification.PRIORITY_MAX).setVisibility(Notification.VISIBILITY_PUBLIC)
      .setCategory(Notification.CATEGORY_ALARM).setColor(purple?0xffa879ff:0xfff54d61)
      .setDeleteIntent(silent).setOnlyAlertOnce(true)
      .addAction(android.R.drawable.ic_media_pause,"Închide alerta",silent);
    if(!quiet&&(Build.VERSION.SDK_INT<34||manager.canUseFullScreenIntent()))b.setFullScreenIntent(full,true);
    getSharedPreferences(MainActivity.PREF_NAME,MODE_PRIVATE).edit().remove("dismissed_alert_"+id).commit();
    manager.notify(id,b.build());
    if(!quiet)AlertAttention.start(this); // Night vibration is handled solely by the silent channel.
  }
   private void checkAlerts()throws Exception {
    if(!notificationsAllowed())return; // Never mark an alert delivered when notifications are blocked.
    String token=MainActivity.token(this);if(token.isEmpty())return;
    String json=MainActivity.readHttp(MainActivity.BASE+"/api/mobile/alerts",token,null);
    JSONArray arr=new JSONObject(json).optJSONArray("alerts");if(arr==null)return;
    SharedPreferences prefs=getSharedPreferences(MainActivity.PREF_NAME,MODE_PRIVATE);
    for(int i=0;i<arr.length();i++){
      JSONObject row=arr.optJSONObject(i);if(row==null)continue;
      long event=row.optLong("event_id",0);String stage=row.optString("stage","");
      boolean win="WIN".equals(stage)||row.optBoolean("native_win_compat",false);
      if(event<=0||(!win&&!"BET_NOW".equals(stage)))continue;
      if("AWAY_57".equalsIgnoreCase(row.optString("signal_type","")))continue;
            String category=row.optString("signal_label",row.optString("signal_type","")).toUpperCase(Locale.ROOT).trim();
      JSONObject priority=row.optJSONObject("priority_category");
      String code=priority==null?"":priority.optString("code","");
      boolean purple="strong-silver".equals(code);
      boolean red="strong".equals(code);
      boolean gold="GOLDEN TICKET".equals(category);
      boolean power="GG POWER".equals(category)||row.optString("model_version","").contains("GG_POWER")||row.optBoolean("gg_power",false);
      boolean rush="GOLD RUSH".equals(category)||("ML".equals(category)&&row.optString("model_version","").contains("GOLD_RUSH"));
      if(!win&&!gold&&!rush&&!power&&!purple&&!red)continue; // Silver-only and retired filters never ring.
      String key="notified_"+event+"_"+(win?"win":"betnow");
      if(prefs.getBoolean(key,false))continue;
      String fixture=row.optString("fixture","Meci").replaceFirst("^\\[[^\\]]+\\]\\s*","");
      int min=row.optInt("minute",0);String score=row.optString("home_score","-")+"–"+row.optString("away_score","-");
      String category57=row.optString("gold_category_label","");
      String body=fixture+(win?" • Rezultat confirmat":"\nCATEGORIA GOLDEN X57: "+(category57.isEmpty()?"captură indisponibilă":category57)+"\n⏱ MINUTUL "+min+" • SCOR "+score+"\n🎯 PARIU EGAL (X) • COTĂ "+String.format(Locale.US,"%.2f",row.optDouble("px",0))+(power?"\n⚡ GG POWER • MIZĂ SUGERATĂ 50 LEI":rush?"\n💰 GOLD RUSH • MIZĂ SUGERATĂ 20 LEI":"")+"\nDESCHIDE SB RADAR ȘI VERIFICĂ PREȚUL");
      String path=win?"/app?tab=slip&bet_id="+row.optLong("bet_id",0):"/app?tab=live&event_id="+event;
      int id=(int)(Math.abs(event)%100000)+3000+(win?100000:0);
      if(win){
        Notification n=builder(this,CH_WINS).setSmallIcon(android.R.drawable.ic_dialog_info).setAutoCancel(true)
          .setContentTitle("SB Radar • Bilet câștigat").setContentText(body).setStyle(new Notification.BigTextStyle().bigText(body))
          .setContentIntent(open(this,id,path)).setVisibility(Notification.VISIBILITY_PUBLIC).build();
        ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(id,n);
      }else showSignal(purple?"STRONG + SILVER":red?"STRONG":power?"GG POWER":gold?"GOLDEN TICKET":"GOLD RUSH",
        id,fixture,body,path,row.optString("model_version","")+" "+code,false);
      prefs.edit().putBoolean(key,true).apply();
      if(!win){try{
        JSONObject ack=new JSONObject();ack.put("event_id",event);ack.put("stage","BET_NOW");
        MainActivity.readHttp(MainActivity.BASE+"/api/mobile/ack",token,ack.toString());
      }catch(Exception ignored){}}
    }
  }

  // Data-only FCM: display immediately, then try to start the foreground monitor for local ringing.
  // Shared deduplication key prevents duplicate notifications from FCM and the 25-second polling fallback.
  static synchronized void postFromFcm(Context ctx,String category,long event,String fixture,String body,String path,boolean highPriority,String modelVersion){
    boolean strong=category!=null&&category.toUpperCase(Locale.ROOT).contains("STRONG");
    if(event<=0||!("GOLDEN TICKET".equals(category)||"GOLD RUSH".equals(category)||"GG POWER".equals(category)||"ML".equals(category)||strong))return;
    SharedPreferences prefs=ctx.getSharedPreferences(MainActivity.PREF_NAME,Context.MODE_PRIVATE);
    String key="notified_"+event+"_betnow";
    if(prefs.getBoolean(key,false))return;
    if(Build.VERSION.SDK_INT>=33&&ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;
    int id=(int)(Math.abs(event)%100000)+3000;
    boolean purple=category.contains("STRONG + SILVER")||category.contains("STRONG_SILVER")||
      (modelVersion!=null&&(modelVersion.contains("STRONG_SILVER")||modelVersion.contains("STRONG + SILVER")));
    String title=signalTitle("GOLDEN TICKET".equals(category)||strong, (modelVersion==null?"":modelVersion)+" "+category);
    boolean quiet=nightQuiet();
    String channel=purple?CH_ML:CH_GOLD;
    ensureUrgentChannels(ctx); // Required when FCM wakes a process with no monitor service.
    NotificationManager mgr=(NotificationManager)ctx.getSystemService(NOTIFICATION_SERVICE);
    Intent fs=new Intent(ctx,AlertScreenActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
    fs.putExtra("title",title);fs.putExtra("body",body);fs.putExtra("path",path);fs.putExtra("notification_id",id);
    PendingIntent full=PendingIntent.getActivity(ctx,id+400000,fs,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    Intent dismiss=new Intent(ctx,AlertDismissReceiver.class).setAction("ro.drix.pulse.SILENCE").putExtra("notification_id",id);
    PendingIntent silent=PendingIntent.getBroadcast(ctx,id,dismiss,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    Notification.Builder b=builder(ctx,channel).setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentTitle(title).setContentText(fixture+" • EGAL (X)").setStyle(new Notification.BigTextStyle().bigText(body))
      .setContentIntent(open(ctx,id,path)).setAutoCancel(true).setCategory(Notification.CATEGORY_ALARM)
      .setVisibility(Notification.VISIBILITY_PUBLIC).setPriority(Notification.PRIORITY_MAX)
      .setDeleteIntent(silent).setOnlyAlertOnce(true)
      .addAction(android.R.drawable.ic_media_pause,"Închide alerta",silent);
    if(!quiet&&(Build.VERSION.SDK_INT<34||mgr.canUseFullScreenIntent()))b.setFullScreenIntent(full,true);
    prefs.edit().remove("dismissed_alert_"+id).commit();
    mgr.notify(id,b.build());
    NotificationChannel activeChannel=mgr.getNotificationChannel(channel);
    prefs.edit().putBoolean("fcm_last_fsi_requested",!quiet&&(Build.VERSION.SDK_INT<34||mgr.canUseFullScreenIntent()))
      .putInt("fcm_last_channel_importance",activeChannel==null?0:activeChannel.getImportance()).apply();
    // Start attention immediately after displaying the native notification;
    // getActiveNotifications() may lag by a frame on Samsung when FCM wakes the app.
    if(!quiet)AlertAttention.start(ctx);
    prefs.edit().putBoolean(key,true).apply();
    // High-priority FCM may start a foreground service while the screen is off.
    // It keeps the user-requested 45-second alarm alive beyond onMessageReceived().
    // If Android refuses background starts, the direct alarm is the fallback.
    boolean started=false;
    if(highPriority&&!quiet) {
      try {
        Intent attention=new Intent(ctx,AlertService.class).setAction("RING_FCM").putExtra("notification_id",id);
        if(Build.VERSION.SDK_INT>=26)ctx.startForegroundService(attention);
        else ctx.startService(attention);
        started=true;
      }catch(Exception ignored){}
    }
    if(!started)ringIfActive(ctx,id);
  }

  static void testAlert(Context c,String kind){
    Intent i=new Intent(c,AlertService.class);
    i.setAction(("GOLD RUSH".equals(kind)||"ML".equals(kind))?"TEST_RUSH":"TEST_GOLD");
    try{c.startForegroundService(i);}catch(Exception ignored){}
  }
  @Override public void onDestroy(){running=false;if(thread!=null)thread.interrupt();stopRinging();current=null;super.onDestroy();}
}
