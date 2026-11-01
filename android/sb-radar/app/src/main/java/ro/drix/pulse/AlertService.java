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

public class AlertService extends Service {
  static final String CH_MONITOR="sb_radar_monitor_v230";
  static final String CH_GOLD="sb_radar_gold_loud_v237";
  static final String CH_ML="sb_radar_ml_loud_v237";
  static final String CH_WINS="sb_radar_wins_v232";
  static final int FOREGROUND_ID=1310;
  static final String SILENCE="SILENCE";
  private static volatile AlertService current;
  private static final Handler MAIN=new Handler(Looper.getMainLooper());
  private static Runnable ringTimeout;
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
    NotificationChannel gold=new NotificationChannel(CH_GOLD,"Golden Ticket • Alertă puternică",NotificationManager.IMPORTANCE_HIGH);
    gold.setDescription("Golden Ticket: alarmă repetată până la 45 secunde, vibrație și ecran vizual când este permis");
    gold.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    gold.enableVibration(true);
    gold.setVibrationPattern(new long[]{0,650,350,650,900});
    gold.setSound(ring,soundAttrs);
    mgr.createNotificationChannel(gold);
    NotificationChannel ml=new NotificationChannel(CH_ML,"Machine Learning v2.0 • Alertă puternică",NotificationManager.IMPORTANCE_HIGH);
    ml.setDescription("Machine Learning v2.0: alarmă repetată până la 45 secunde, vibrație și ecran vizual când este permis");
    ml.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    ml.enableVibration(true);
    ml.setVibrationPattern(new long[]{0,650,350,650,900});
    ml.setSound(ring,soundAttrs);
    mgr.createNotificationChannel(ml);
  }

  static PendingIntent open(Context ctx,int code,String path){
    Intent i=new Intent(ctx,MainActivity.class);
    i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
    i.setData(Uri.parse(MainActivity.BASE+path));
    return PendingIntent.getActivity(ctx,code,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  }
  static Notification.Builder builder(Context ctx,String channel){return new Notification.Builder(ctx,channel);}
  static void silence(Context context){
    AlertAttention.stop();
    AlertService s=current;
    if(s!=null)s.stopRinging();
  }
  private synchronized void stopRinging(){AlertAttention.stop();}
  private synchronized void ring(){AlertAttention.start(this);}
  @Override public int onStartCommand(Intent intent,int flags,int startId){
    String action=intent==null?"START":intent.getAction();
    if(SILENCE.equals(action)){stopRinging();return START_STICKY;}
    if("STOP".equals(action)){stopSelf();return START_NOT_STICKY;}
    Notification foreground=builder(this,CH_MONITOR).setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentTitle("SB Radar • Monitor activ").setContentText("Urmărește Golden Ticket și ML")
      .setContentIntent(open(this,FOREGROUND_ID,"/app?tab=live")).setOngoing(true).build();
    startForeground(FOREGROUND_ID,foreground);
    if("TEST_GOLD".equals(action)||"TEST_ML".equals(action)){
      boolean gold="TEST_GOLD".equals(action);
      showSignal(gold?"GOLDEN TICKET":"ML",0,"Simulare notificare", "Acesta este un test local. Nu este un semnal real.",
        "/app?tab=live",true); 
    }
    if("RING_FCM".equals(action)){ring();}
    if(running)return START_STICKY;
    running=true;
    thread=new Thread(()->{
      while(running){
        try{checkAlerts();}catch(Exception e){android.util.Log.w("SB_Radar","Monitor temporarily unavailable");}
        try{Thread.sleep(25000);}catch(InterruptedException ignored){break;}
      }
    },"SB-Radar-monitor");
    thread.start();return START_STICKY;
  }
  private boolean notificationsAllowed(){
    return Build.VERSION.SDK_INT<33||checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED;
  }
  private void showSignal(String category,int notificationId,String fixture,String body,String path,boolean test){
    if(!notificationsAllowed())return;
    boolean gold=category.contains("GOLD");
    String channel=gold?CH_GOLD:CH_ML;
    String title=gold?"🏆 GOLDEN TICKET • SB Radar":"🧠 Machine Learning v2.0 • SB Radar";
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
      .setContentTitle(title).setContentText(fixture+" • EGAL (X)").setStyle(new Notification.BigTextStyle().bigText(body))
      .setContentIntent(open(this,id,path)).setAutoCancel(true)
      .setPriority(Notification.PRIORITY_MAX).setVisibility(Notification.VISIBILITY_PUBLIC)
      .setCategory(Notification.CATEGORY_REMINDER).setColor(gold?0xffffc74f:0xfff54d61)
      .setDeleteIntent(silent).setOnlyAlertOnce(true)
      .addAction(android.R.drawable.ic_media_pause,"Închide alerta",silent);
    if(Build.VERSION.SDK_INT<34||manager.canUseFullScreenIntent())b.setFullScreenIntent(full,true);
    manager.notify(id,b.build());
    ring(); // Native audible attention; stops on dismissal or after 45 seconds.
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
      String category=row.optString("signal_label",row.optString("signal_type","")).toUpperCase(Locale.ROOT).trim();
      boolean gold=category.contains("GOLD"), ml=category.equals("ML")||category.startsWith("ML ");
      if(!win&&!gold&&!ml)continue; // Beta B and generic/base signals never ring.
      String key="notified_"+event+"_"+(win?"win":"betnow");
      if(prefs.getBoolean(key,false))continue;
      String fixture=row.optString("fixture","Meci").replaceFirst("^\\[[^\\]]+\\]\\s*","");
      int min=row.optInt("minute",0);String score=row.optString("home_score","-")+"–"+row.optString("away_score","-");
      String body=fixture+(win?" • Rezultat confirmat":"\n⏱ MINUTUL "+min+" • SCOR "+score+"\n🎯 PARIU EGAL (X) • COTĂ "+String.format(Locale.US,"%.2f",row.optDouble("px",0))+"\nDESCHIDE SB RADAR ȘI VERIFICĂ PREȚUL");
      String path=win?"/app?tab=slip&bet_id="+row.optLong("bet_id",0):"/app?tab=live&event_id="+event;
      int id=(int)(Math.abs(event)%100000)+3000+(win?100000:0);
      if(win){
        Notification n=builder(this,CH_WINS).setSmallIcon(android.R.drawable.ic_dialog_info).setAutoCancel(true)
          .setContentTitle("SB Radar • Bilet câștigat").setContentText(body).setStyle(new Notification.BigTextStyle().bigText(body))
          .setContentIntent(open(this,id,path)).setVisibility(Notification.VISIBILITY_PUBLIC).build();
        ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(id,n);
      }else showSignal(gold?"GOLDEN TICKET":"ML",id,fixture,body,path,false);
      prefs.edit().putBoolean(key,true).apply();
      if(!win){try{
        JSONObject ack=new JSONObject();ack.put("event_id",event);ack.put("stage","BET_NOW");
        MainActivity.readHttp(MainActivity.BASE+"/api/mobile/ack",token,ack.toString());
      }catch(Exception ignored){}}
    }
  }

  // Data-only FCM: display immediately, then try to start the foreground monitor for local ringing.
  // Shared deduplication key prevents duplicate notifications from FCM and the 25-second polling fallback.
  static synchronized void postFromFcm(Context ctx,String category,long event,String fixture,String body,String path,boolean highPriority){
    if(event<=0||!("GOLDEN TICKET".equals(category)||"ML".equals(category)))return;
    SharedPreferences prefs=ctx.getSharedPreferences(MainActivity.PREF_NAME,Context.MODE_PRIVATE);
    String key="notified_"+event+"_betnow";
    if(prefs.getBoolean(key,false))return;
    if(Build.VERSION.SDK_INT>=33&&ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;
    int id=(int)(Math.abs(event)%100000)+3000;
    String title="GOLDEN TICKET".equals(category)?"🏆 GOLDEN TICKET • SB Radar":"🧠 Machine Learning v2.0 • SB Radar";
    String channel="GOLDEN TICKET".equals(category)?CH_GOLD:CH_ML;
    ensureUrgentChannels(ctx); // Required when FCM wakes a process with no monitor service.
    NotificationManager mgr=(NotificationManager)ctx.getSystemService(NOTIFICATION_SERVICE);
    Intent fs=new Intent(ctx,AlertScreenActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
    fs.putExtra("title",title);fs.putExtra("body",body);fs.putExtra("path",path);fs.putExtra("notification_id",id);
    PendingIntent full=PendingIntent.getActivity(ctx,id+400000,fs,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    Intent dismiss=new Intent(ctx,AlertDismissReceiver.class).setAction("ro.drix.pulse.SILENCE").putExtra("notification_id",id);
    PendingIntent silent=PendingIntent.getBroadcast(ctx,id,dismiss,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    Notification.Builder b=builder(ctx,channel).setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentTitle(title).setContentText(fixture+" • EGAL (X)").setStyle(new Notification.BigTextStyle().bigText(body))
      .setContentIntent(open(ctx,id,path)).setAutoCancel(true).setCategory(Notification.CATEGORY_REMINDER)
      .setVisibility(Notification.VISIBILITY_PUBLIC).setPriority(Notification.PRIORITY_MAX)
      .setDeleteIntent(silent).setOnlyAlertOnce(true)
      .addAction(android.R.drawable.ic_media_pause,"Închide alerta",silent);
    if(Build.VERSION.SDK_INT<34||mgr.canUseFullScreenIntent())b.setFullScreenIntent(full,true);
    mgr.notify(id,b.build());
    prefs.edit().putBoolean(key,true).apply();
    // High-priority FCM may start a foreground service while the screen is off.
    // It keeps the user-requested 45-second alarm alive beyond onMessageReceived().
    // If Android refuses background starts, the direct alarm is the fallback.
    boolean started=false;
    if(highPriority) {
      try {
        Intent attention=new Intent(ctx,AlertService.class).setAction("RING_FCM");
        if(Build.VERSION.SDK_INT>=26)ctx.startForegroundService(attention);
        else ctx.startService(attention);
        started=true;
      }catch(Exception ignored){}
    }
    if(!started)AlertAttention.start(ctx);
  }

  static void testAlert(Context c,String kind){
    Intent i=new Intent(c,AlertService.class);
    i.setAction("ML".equals(kind)?"TEST_ML":"TEST_GOLD");
    try{c.startForegroundService(i);}catch(Exception ignored){}
  }
  @Override public void onDestroy(){running=false;if(thread!=null)thread.interrupt();stopRinging();current=null;super.onDestroy();}
}
