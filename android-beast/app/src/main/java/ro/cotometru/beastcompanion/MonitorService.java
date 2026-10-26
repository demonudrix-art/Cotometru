package ro.cotometru.beastcompanion;
import android.app.*;
import android.content.*;
import android.os.*;
import android.util.Log;
import org.json.JSONObject;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;

public final class MonitorService extends Service {
  static final String START="ro.cotometru.beastcompanion.START",STOP="ro.cotometru.beastcompanion.STOP";
  private static final String BASE="https://beast-xray-edge.drix-beast-xray.workers.dev/api/watch/";
  private static final String CHANNEL="beast_sse_monitor";
  private volatile boolean active=false;
  private volatile HttpURLConnection streamConnection;
  private Thread runner;
  private String matchUrl="";
  @Override public IBinder onBind(Intent i){return null;}
  @Override public void onCreate(){
    super.onCreate();NotificationManager m=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
    m.createNotificationChannel(new NotificationChannel(CHANNEL,"BEAST X-RAY Live SSE",NotificationManager.IMPORTANCE_HIGH));
  }
  Notification notice(String text){
    Intent activity=new Intent(this,MainActivity.class);
    PendingIntent pi=PendingIntent.getActivity(this,0,activity,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
    return new Notification.Builder(this,CHANNEL).setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentTitle("BEAST X-RAY · SSE").setContentText(text).setContentIntent(pi)
      .setAutoCancel(false).setOngoing(active).build();
  }
  @Override public int onStartCommand(Intent intent,int flags,int id){
    if(intent==null)return START_NOT_STICKY;
    if(STOP.equals(intent.getAction())){shutdown();return START_NOT_STICKY;}
    if(START.equals(intent.getAction())){
      String url=intent.getStringExtra("match");if(url==null)return START_NOT_STICKY;
      stopReading();active=true;matchUrl=url;
      startForeground(101,notice("Conectare la monitorul SSE..."));
      runner=new Thread(this::runMonitor,"BEAST-SSE");runner.start();
    }
    return START_NOT_STICKY;
  }
  private void stopReading(){active=false;if(streamConnection!=null)streamConnection.disconnect();if(runner!=null)runner.interrupt();}
  private void shutdown(){
    stopReading();new Thread(()->{try{post("stop",null);}catch(Exception ignored){}},"BEAST-STOP").start();
    stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();
  }
  private void post(String path,String payload)throws Exception{
    HttpURLConnection c=(HttpURLConnection)new URL(BASE+path).openConnection();
    c.setRequestMethod("POST");c.setConnectTimeout(12000);c.setReadTimeout(14000);
    c.setRequestProperty("X-Beast-Key",SecretStore.get(this));
    if(payload!=null){
      c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");
      try(OutputStream out=c.getOutputStream()){out.write(payload.getBytes(StandardCharsets.UTF_8));}
    }
    int code=c.getResponseCode();c.disconnect();if(code!=200)throw new IOException(path+" HTTP "+code);
  }
  private void alertGoal(JSONObject e){
    String message="Gol "+e.optInt("goalNumber",0)+" · "+e.optString("match","meci")
      +" · "+e.optString("scorer","echipă");
    NotificationManager m=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
    m.notify(200+(int)(System.currentTimeMillis()%5000),notice(message));
    getSharedPreferences("events",0).edit().putString("last",message).putString("time",e.optString("at")).apply();
  }
  private void runMonitor(){
    long end=SystemClock.elapsedRealtime()+7200000L;
    try{post("arm",new JSONObject().put("url",matchUrl).toString());}
    catch(Exception e){Log.e("BEAST","Arm failed",e);shutdown();return;}
    while(active&&SystemClock.elapsedRealtime()<end){
      HttpURLConnection c=null;
      try{
        c=(HttpURLConnection)new URL(BASE+"stream").openConnection();
        streamConnection=c;c.setConnectTimeout(12000);c.setReadTimeout(85000);
        c.setRequestProperty("X-Beast-Key",SecretStore.get(this));
        c.setRequestProperty("Accept","text/event-stream");
        if(c.getResponseCode()!=200)throw new IOException("SSE HTTP "+c.getResponseCode());
        try(BufferedReader input=new BufferedReader(new InputStreamReader(c.getInputStream(),StandardCharsets.UTF_8))){
          String kind="",line;
          while(active&&(line=input.readLine())!=null){
            if(line.startsWith("event:"))kind=line.substring(6).trim();
            else if(line.startsWith("data:")&&"goal".equals(kind)){
              try{JSONObject ev=new JSONObject(line.substring(5).trim());if("goal".equals(ev.optString("kind")))alertGoal(ev);}
              catch(Exception ex){Log.w("BEAST","Goal payload",ex);}
            }else if(line.length()==0)kind="";
          }
        }
      }catch(Exception e){if(active)Log.w("BEAST","SSE reconnect",e);}
      finally{if(c!=null)c.disconnect();streamConnection=null;}
      if(active)try{Thread.sleep(1200);}catch(InterruptedException e){break;}
    }
    active=false;stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();
  }
  @Override public void onDestroy(){stopReading();super.onDestroy();}
}
