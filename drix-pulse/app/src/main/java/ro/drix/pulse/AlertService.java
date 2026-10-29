package ro.drix.pulse;

import android.app.Service;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.Context;
import android.os.Build;
import android.os.IBinder;
import android.media.AudioAttributes;
import android.net.Uri;
import android.content.SharedPreferences;
import org.json.JSONObject;
import org.json.JSONArray;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.time.Instant;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import android.graphics.Color;

public class AlertService extends Service {
    private static final String CH_ALERT="sb_bet_now_v2";
    private static final String CH_MONITOR="sb_monitor_v2";
    private volatile boolean active=false;
    private ExecutorService executor;
    private SharedPreferences prefs;
    @Override public IBinder onBind(Intent i){return null;}
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        prefs=getSharedPreferences(MainActivity.PREF,MODE_PRIVATE);
        ensureChannels(this);
        Notification n=new Notification.Builder(this,CH_MONITOR)
                .setSmallIcon(R.drawable.drix_icon)
                .setContentTitle("SB Radar • Monitor activ")
                .setContentText("Urmărește semnalele GHOST EGAL în fundal")
                .setOngoing(true).setVisibility(Notification.VISIBILITY_PRIVATE)
                .build();
        startForeground(42,n);
        if(!active){
            active=true;
            executor=Executors.newSingleThreadExecutor();
            executor.execute(()->{
                while(active && !Thread.currentThread().isInterrupted()){
                    try{readAlerts();}catch(Exception e){android.util.Log.w("DrixPulse","Monitor: "+e.getClass().getSimpleName());}
                    try{Thread.sleep(15000);}catch(InterruptedException e){Thread.currentThread().interrupt();break;}
                }
            });
        }
        prefs.edit().putBoolean("monitor",true).apply();
        return START_STICKY;
    }
    private void readAlerts() throws Exception {
        String token=prefs.getString("token","");
        if(token.isEmpty())return;
        HttpURLConnection c=(HttpURLConnection)new URL(MainActivity.BASE+"/api/mobile/alerts").openConnection();
        c.setConnectTimeout(9500);c.setReadTimeout(9500);c.setRequestMethod("GET");
        c.setRequestProperty("Authorization","Bearer "+token);
        c.setRequestProperty("Accept","application/json");
        try{
            int status=c.getResponseCode();
            if(status==401 || status==403){prefs.edit().putBoolean("monitor",false).apply();stopSelf();return;}
            if(status!=200)return;
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();
            try(InputStream in=c.getInputStream()){
                byte[] buffer=new byte[8192];int n;
                while((n=in.read(buffer))!=-1 && bytes.size()<200000)bytes.write(buffer,0,n);
            }
            JSONObject result=new JSONObject(bytes.toString("UTF-8"));
            JSONArray rows=result.optJSONArray("alerts");if(rows==null)return;
            long now=System.currentTimeMillis();
            for(int i=rows.length()-1;i>=0;i--){
                JSONObject a=rows.optJSONObject(i);if(a==null)continue;
                String stage=a.optString("stage",""),evt=a.optString("event_id","");
                if(!stage.equals("PREGATIRE")&&!stage.equals("BET_NOW"))continue;
                String stamp=a.optString("triggered_utc","");
                long at;
                try{at=Instant.parse(stamp).toEpochMilli();}catch(Exception e){continue;}
                if(now-at<0 || now-at>180000)continue;
                String key="seen_"+evt+"_"+stage;
                if(prefs.getBoolean(key,false))continue;
                prefs.edit().putBoolean(key,true).apply();
                String fixture=a.optString("fixture","Meci necunoscut");
                int minute=a.optInt("minute",0);double px=a.optDouble("px",0);
                String title=stage.equals("BET_NOW")?"🔴 SB Radar • BET NOW X":"🟠 SB Radar • Pregătește X";
                String body=fixture+" • "+minute+"' • X "+String.format(java.util.Locale.forLanguageTag("ro-RO"),"%.2f",px);
                showAlert(this,title,body,a.optString("url",MainActivity.BASE+"/app"),key,stage.equals("BET_NOW"));
                try{acknowledge(token,evt,stage);}catch(Exception ex){android.util.Log.w("DrixPulse","Acknowledgement retry not available");}
            }
        }finally{c.disconnect();}
    }
    private void acknowledge(String token,String evt,String stage) throws Exception {
        HttpURLConnection cn=(HttpURLConnection)new URL(MainActivity.BASE+"/api/mobile/ack").openConnection();
        cn.setRequestMethod("POST");cn.setDoOutput(true);cn.setConnectTimeout(5000);cn.setReadTimeout(5000);
        cn.setRequestProperty("Authorization","Bearer "+token);
        cn.setRequestProperty("Content-Type","application/json");
        JSONObject data=new JSONObject().put("event_id",evt).put("stage",stage);
        try(java.io.OutputStream os=cn.getOutputStream()){os.write(data.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));}
        try{cn.getResponseCode();}finally{cn.disconnect();}
    }
    public static void ensureChannels(Context ctx){
        NotificationManager m=(NotificationManager)ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if(m.getNotificationChannel(CH_MONITOR)==null){
            NotificationChannel low=new NotificationChannel(CH_MONITOR,"SB Radar • Monitor",NotificationManager.IMPORTANCE_LOW);
            low.setDescription("Notificare permanentă cât timp radarul este activ");
            low.setShowBadge(false);
            m.createNotificationChannel(low);
        }
        if(m.getNotificationChannel(CH_ALERT)==null){
            NotificationChannel high=new NotificationChannel(CH_ALERT,"SB Radar • Alerte BET NOW",NotificationManager.IMPORTANCE_HIGH);
            high.setDescription("Alerte cu sunet, vibrație și afișare pe ecran blocat");
            high.enableVibration(true);
            high.setVibrationPattern(new long[]{0,220,110,330,130,420});
            high.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            high.enableLights(true);high.setLightColor(Color.rgb(255,117,104));
            Uri sound=android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION);
            high.setSound(sound,new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT).build());
            m.createNotificationChannel(high);
        }
    }
    public static void showAlert(Context ctx,String title,String content,String link,String key,boolean urgent){
        ensureChannels(ctx);
        Intent open;
        try{open=new Intent(Intent.ACTION_VIEW,Uri.parse(link));}
        catch(Exception ex){open=new Intent(ctx,MainActivity.class);}
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent pi=PendingIntent.getActivity(ctx,key.hashCode(),open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification n=new Notification.Builder(ctx,CH_ALERT)
                .setSmallIcon(R.drawable.drix_icon)
                .setColor(Color.rgb(255,117,104))
                .setColorized(urgent)
                .setContentTitle(title)
                .setContentText(content)
                .setStyle(new Notification.BigTextStyle().bigText(content+" • Verifică prețul actual înainte de orice pariu"))
                .setContentIntent(pi).setAutoCancel(true)
                .setWhen(System.currentTimeMillis()).setShowWhen(true)
                .setCategory(Notification.CATEGORY_EVENT)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setPriority(Notification.PRIORITY_HIGH)
                .build();
        ((NotificationManager)ctx.getSystemService(Context.NOTIFICATION_SERVICE)).notify(key.hashCode(),n);
    }
    @Override public void onDestroy(){
        active=false;
        if(executor!=null)executor.shutdownNow();
        if(prefs!=null)prefs.edit().putBoolean("monitor",false).apply();
        super.onDestroy();
    }
}
