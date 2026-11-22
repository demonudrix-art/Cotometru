package ro.drix.pulse;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import org.json.*;
import java.util.Locale;
import java.util.Calendar;
import java.util.TimeZone;

public class AlertService extends Service {
  static final String CH_MONITOR="sb_radar_monitor_v230";
  static final String CH_GOLD="sb_radar_golden_vibration_only_v240";
  static final String CH_ML="sb_radar_purple_vibration_only_v240";
  static final String CH_OCT31_ML="sb_radar_ml_logreg_vibration_only_v240";
  static final String CH_GAP="sb_radar_gap_navy_soft_nature_v250";
  static final String CH_NIGHT="sb_radar_vibration_night_v2315";
  static final String CH_WINS="sb_radar_wins_vibration_only_v240";
  static final int FOREGROUND_ID=1310;
  static final String SILENCE="SILENCE";
  private static volatile AlertService current;
  private static final Handler MAIN=new Handler(Looper.getMainLooper());
  private static Runnable ringTimeout;
  static boolean nightQuiet(){return false;} // User enabled urgent purple/red alerts and fullscreen 24/7.
  private Vibrator vibrator;
  volatile boolean running=false;
  Thread thread;

  @Override public void onCreate(){ super.onCreate();current=this;ensureChannels(); }
  @Override public IBinder onBind(Intent i){return null;}
  private void ensureChannels(){
    NotificationManager mgr=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
    NotificationChannel monitor=new NotificationChannel(CH_MONITOR,"SB Radar • Live Intelligence",NotificationManager.IMPORTANCE_LOW);
    monitor.setDescription("Monitor activ pentru Golden Classic 57′ și ML LogReg V1 57′–59′.");mgr.createNotificationChannel(monitor);
    ensureUrgentChannels(this);
    NotificationChannel wins=new NotificationChannel(CH_WINS,"Bilete câștigate",NotificationManager.IMPORTANCE_HIGH);
    wins.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);wins.enableVibration(true);wins.setSound(null,null);mgr.createNotificationChannel(wins);
  }
  // Android keeps prior channel settings; v240 uses new vibration-only, silent channel IDs.
  private static void ensureUrgentChannels(Context context){
    NotificationManager mgr=(NotificationManager)context.getSystemService(NOTIFICATION_SERVICE);
    NotificationChannel gold=new NotificationChannel(CH_GOLD,"🟡 Golden Classic 57′ • Vibrație",NotificationManager.IMPORTANCE_HIGH);
    gold.setDescription("Golden Classic 0–0 la 57′: vibrație și ecran de alertă, fără sunet.");
    gold.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    gold.enableVibration(true);
    gold.setVibrationPattern(new long[]{0,650,350,650,900});
    gold.setSound(null,null);
    mgr.createNotificationChannel(gold);
    NotificationChannel ml=new NotificationChannel(CH_ML,"SB Radar • Canal mov (fără sunet)",NotificationManager.IMPORTANCE_HIGH);
    ml.setDescription("Vibrație și afișare, fără sunet.");
    ml.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    ml.enableVibration(true);
    ml.setVibrationPattern(new long[]{0,420,250,420,250,420});
    ml.setSound(null,null);
    mgr.createNotificationChannel(ml);
    NotificationChannel octoberMl=new NotificationChannel(CH_OCT31_ML,"🧠 ML LogReg V1 • 57′–59′",NotificationManager.IMPORTANCE_HIGH);
    octoberMl.setDescription("ML original din 31 octombrie: 0–0 la minutele 57–59, fără apel telefonic.");
    octoberMl.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    octoberMl.enableVibration(true);octoberMl.setVibrationPattern(new long[]{0,500,250,500,350,700});
    octoberMl.setSound(null,null);mgr.createNotificationChannel(octoberMl);
    NotificationChannel gap=new NotificationChannel(CH_GAP,"🔵 GAP NAVY • Natură discretă",NotificationManager.IMPORTANCE_HIGH);
    gap.setDescription("GAP NAVY 40→50: vibrație, ecran și sunet natural delicat redat de aplicație; fără alarmă standard.");
    gap.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    gap.enableVibration(true);gap.setVibrationPattern(new long[]{0,300,160,300});
    gap.setSound(null,null);mgr.createNotificationChannel(gap);
    NotificationChannel night=new NotificationChannel(CH_NIGHT,"SB Radar • Canal vibrație (compatibilitate)",NotificationManager.IMPORTANCE_HIGH);
    night.setDescription("Canal anterior de compatibilitate; setările utilizatorului sunt păstrate.");
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
    // FCM already started vibration and its one-shot nature tone directly.
    // Do NOT restart AlertAttention: doing so cancels the tone before it finishes.
    // Retain this call for legacy foreground wake compatibility only.
    if(!nightQuiet()&&canRing(context,id))return;
  }
  private static String signalTitle(boolean gold,String modelVersion){
    String normalized=modelVersion==null?"":modelVersion.toUpperCase(Locale.ROOT);
    if(normalized.contains("GAP_NAVY")||normalized.contains("SB_RADAR_GAP"))return "🔵 GAP NAVY • X 50′ • SB Radar";
    if(normalized.contains("SB_RADAR_ML_LOGREG_V1")||normalized.contains("ML_OCT31"))return "🧠 ML SELECT • X 2,05–2,09 · ↓ 5–7 pp • SB Radar";
    if(normalized.contains("SB_GOLDEN_CLASSIC_00_M57_1PP_V1"))return "🟡 GOLDEN CLASSIC • 57′ • SB Radar";
    if(normalized.contains("STRONG"))return "SB Radar • Filtru anterior";
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
    Notification foreground=builder(this,CH_MONITOR)
      .setSmallIcon(R.drawable.sbr_status_idle)
      .setContentTitle("SB Radar • LIVE INTELLIGENCE")
      .setContentText("🔵 GAP NAVY 50′ • 🟡 Golden 57′ • ♜ Regista local")
      .setSubText("MONITORIZARE ACTIVĂ")
      .setStyle(new Notification.BigTextStyle().bigText(
        "🟡 Golden Classic • 0–0 la 57′\n" +
        "🔵 GAP NAVY • observație 40′, confirmare 50′\n" +
        "♜ Regista • predicții pre-meci, vibrate local\n" +
        "Alertele depind de conexiune și de restricțiile Android."))
      .setCategory(Notification.CATEGORY_SERVICE)
      .setColor(0xff6de7c7)
      .setWhen(System.currentTimeMillis()).setUsesChronometer(true)
      .setOnlyAlertOnce(true)
      .setContentIntent(open(this,FOREGROUND_ID,"/app?tab=live"))
      .addAction(R.drawable.sbr_status_idle,"RADAR",open(this,FOREGROUND_ID+1,"/app?tab=live"))
      .addAction(R.drawable.sbr_status_ticket,"SLIP",open(this,FOREGROUND_ID+2,"/app?tab=slip"))
      .setOngoing(true).build();
    startForeground(FOREGROUND_ID,foreground);
    if("TEST_GOLD".equals(action)||"TEST_ML".equals(action)||"TEST_GAP".equals(action)||"TEST_RUSH".equals(action)){
      boolean golden="TEST_GOLD".equals(action),gap="TEST_GAP".equals(action);
      String category=golden?"GOLDEN TICKET":gap?"GAP NAVY":"ML";
      String model=golden?"SB_GOLDEN_CLASSIC_00_M57_1PP_V1":gap?"SB_RADAR_GAP_40_50_X50_V1 GAP_NAVY":"SB_RADAR_ML_LOGREG_V1";
      showSignal(category,0,"TEST LOCAL • "+category,
        "Test alerte naturale SB Radar, fără pariu real.\\n"+(golden?"Ciripit discret":gap?"Picături discrete":"Adiere discretă")+
        "\\nVolumul telefonului rămâne nemodificat.", "/app?tab=live",model,true);
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
        try{RegistaNotifier.poll(this);}catch(Exception e){android.util.Log.w("SB_Radar","Regista monitor temporarily unavailable");}
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
    boolean classic=modelVersion!=null&&modelVersion.contains("SB_GOLDEN_CLASSIC_00_M57_1PP_V1");
    boolean purple=!classic&&(category.contains("STRONG + SILVER")||category.contains("STRONG_SILVER")||
      (modelVersion!=null&&(modelVersion.contains("STRONG_SILVER")||modelVersion.contains("STRONG + SILVER"))));
    boolean gold="GOLDEN TICKET".equals(category)||"STRONG".equals(category);
    boolean quiet=nightQuiet();
    boolean isGap="GAP NAVY".equals(category)||(modelVersion!=null&&modelVersion.contains("GAP_NAVY"));
    String channel=isGap?CH_GAP:"ML".equals(category)?CH_OCT31_ML:purple?CH_ML:CH_GOLD;
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
    Notification.Builder b=builder(this,channel)
      .setSmallIcon(isGap?R.drawable.sbr_alert_water:"ML".equals(category)?R.drawable.sbr_alert_wind:R.drawable.sbr_alert_bird)
       .setContentTitle(title).setContentText(fixture+" • EGAL (X)").setStyle(new Notification.BigTextStyle().bigText(body))
      .setContentIntent(full).setAutoCancel(true)
      .setPriority(Notification.PRIORITY_MAX).setVisibility(Notification.VISIBILITY_PUBLIC)
      .setCategory(Notification.CATEGORY_ALARM).setColor(isGap?0xff3679c0:"ML".equals(category)?0xffe35b68:0xffe9b655)
      .setDeleteIntent(silent).setOnlyAlertOnce(true)
      .addAction(android.R.drawable.ic_media_pause,"Închide alerta",silent);
    if(!quiet&&(Build.VERSION.SDK_INT<34||manager.canUseFullScreenIntent()))b.setFullScreenIntent(full,true);
    getSharedPreferences(MainActivity.PREF_NAME,MODE_PRIVATE).edit().remove("dismissed_alert_"+id).commit();
    manager.notify(id,b.build());
    if(!quiet)AlertAttention.start(this,category); // Soft original nature tone; respects silent mode and notification volume.
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
      boolean ml="ML".equals(category)&&"SB_RADAR_ML_LOGREG_V1".equals(row.optString("model_version",""));
      boolean gap=row.optBoolean("gap_pattern_match",false)||"GAP NAVY".equals(category)||row.optString("gap_model_version","").contains("SB_RADAR_GAP");
      if(ml&&!gap)continue; // ML SELECT and ML GENERAL are retired from user alerts; preserve D1 history.
      boolean rush="GOLD RUSH".equals(category);
      if(!win&&!gold&&!ml&&!gap&&!rush&&!power&&!purple&&!red)continue; // Silver-only and retired filters never ring.
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
      }else showSignal(gap?"GAP NAVY":ml?"ML":purple?"STRONG + SILVER":red?"STRONG":power?"GG POWER":gold?"GOLDEN TICKET":"GOLD RUSH",
        id,fixture,gap?("🔵 GAP NAVY · X "+String.format(Locale.US,"%.2f",row.optDouble("px",0))+" · GAP +"+String.format(Locale.US,"%.2f",row.optDouble("gap50_pp",0))+" pp\n"+body):body,path,row.optString("model_version","")+" "+code+(gap?" GAP_NAVY":""),false);
      prefs.edit().putBoolean(key,true).apply();
      if(!win){try{
        JSONObject ack=new JSONObject();ack.put("event_id",event);ack.put("stage","BET_NOW");
        MainActivity.readHttp(MainActivity.BASE+"/api/mobile/ack",token,ack.toString());
      }catch(Exception ignored){}}
    }
  }

  // Data-only FCM: display immediately and preserve vibration-only attention.
  // Shared deduplication key prevents duplicate notifications from FCM and the 25-second polling fallback.
  static synchronized void postFromFcm(Context ctx,String category,long event,String fixture,String body,String path,boolean highPriority,String modelVersion){
    boolean strong=category!=null&&category.toUpperCase(Locale.ROOT).contains("STRONG");
    if(event<=0||!("GOLDEN TICKET".equals(category)||"GOLD RUSH".equals(category)||"GG POWER".equals(category)||"ML".equals(category)||"GAP NAVY".equals(category)||strong))return;
    SharedPreferences prefs=ctx.getSharedPreferences(MainActivity.PREF_NAME,Context.MODE_PRIVATE);
    String key="notified_"+event+"_betnow";
    if(prefs.getBoolean(key,false))return;
    if(Build.VERSION.SDK_INT>=33&&ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;
    int id=(int)(Math.abs(event)%100000)+3000;
    boolean classic=modelVersion!=null&&modelVersion.contains("SB_GOLDEN_CLASSIC_00_M57_1PP_V1");
    boolean purple=!classic&&(category.contains("STRONG + SILVER")||category.contains("STRONG_SILVER")||
      (modelVersion!=null&&(modelVersion.contains("STRONG_SILVER")||modelVersion.contains("STRONG + SILVER"))));
    String title=signalTitle("GOLDEN TICKET".equals(category)||strong, (modelVersion==null?"":modelVersion)+" "+category);
    boolean quiet=nightQuiet();
    boolean isGap="GAP NAVY".equals(category)||(modelVersion!=null&&modelVersion.contains("GAP_NAVY"));
    String channel=isGap?CH_GAP:"ML".equals(category)?CH_OCT31_ML:purple?CH_ML:CH_GOLD;
    ensureUrgentChannels(ctx); // Required when FCM wakes a process with no monitor service.
    NotificationManager mgr=(NotificationManager)ctx.getSystemService(NOTIFICATION_SERVICE);
    Intent fs=new Intent(ctx,AlertScreenActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
    fs.putExtra("title",title);fs.putExtra("body",body);fs.putExtra("path",path);fs.putExtra("notification_id",id);
    PendingIntent full=PendingIntent.getActivity(ctx,id+400000,fs,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    Intent dismiss=new Intent(ctx,AlertDismissReceiver.class).setAction("ro.drix.pulse.SILENCE").putExtra("notification_id",id);
    PendingIntent silent=PendingIntent.getBroadcast(ctx,id,dismiss,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    Notification.Builder b=builder(ctx,channel).setSmallIcon(isGap?R.drawable.sbr_alert_water:"ML".equals(category)?R.drawable.sbr_alert_wind:R.drawable.sbr_alert_bird)
      .setContentTitle(title).setContentText(fixture+" • EGAL (X)").setStyle(new Notification.BigTextStyle().bigText(body))
      .setContentIntent(full).setAutoCancel(true).setCategory(Notification.CATEGORY_ALARM)
      .setVisibility(Notification.VISIBILITY_PUBLIC).setPriority(Notification.PRIORITY_MAX)
      .setDeleteIntent(silent).setOnlyAlertOnce(true)
      .addAction(android.R.drawable.ic_media_pause,"Închide alerta",silent);
    if(!quiet&&(Build.VERSION.SDK_INT<34||mgr.canUseFullScreenIntent()))b.setFullScreenIntent(full,true);
    prefs.edit().remove("dismissed_alert_"+id).commit();
    mgr.notify(id,b.build());
    NotificationChannel activeChannel=mgr.getNotificationChannel(channel);
    prefs.edit().putBoolean("fcm_last_fsi_requested",!quiet&&(Build.VERSION.SDK_INT<34||mgr.canUseFullScreenIntent()))
      .putInt("fcm_last_channel_importance",activeChannel==null?0:activeChannel.getImportance()).apply();
    // Start repeating attention immediately after displaying the native notification;
    // getActiveNotifications() may lag by a frame on Samsung when FCM wakes the app.
    if(!quiet)AlertAttention.start(ctx,category); // Audible, repeating natural tone and vibration until dismiss.
    prefs.edit().putBoolean(key,true).apply();
    // High-priority FCM may start a foreground service while the screen is off.
    // It preserves vibration-only attention beyond onMessageReceived().
    // If Android refuses background starts, direct vibration is the fallback.
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
    i.setAction("GAP NAVY".equals(kind)?"TEST_GAP":("ML".equals(kind)||"GOLD RUSH".equals(kind))?"TEST_ML":"TEST_GOLD");
    try{c.startForegroundService(i);}catch(Exception ignored){}
  }
  @Override public void onDestroy(){running=false;if(thread!=null)thread.interrupt();stopRinging();current=null;super.onDestroy();}
}
