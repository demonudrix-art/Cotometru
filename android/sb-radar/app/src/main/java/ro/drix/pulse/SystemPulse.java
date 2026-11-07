package ro.drix.pulse;

import android.content.Context;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Passive owner-only System Pulse client. No betting or control actions. */
final class SystemPulse {
  private static final String BASE="https://sb-radar-system-pulse-v1.drix-beast-xray.workers.dev";
  private SystemPulse(){}

  private static JSONObject sendRequest(Context context,String path,String body) throws Exception {
    final String token=MainActivity.token(context);
    if(token.isEmpty())throw new IllegalStateException("Device token absent");
    HttpURLConnection con=(HttpURLConnection)new URL(BASE+path).openConnection();
    try{
      con.setConnectTimeout(4500);
      con.setReadTimeout(4500);
      con.setRequestProperty("Authorization","Bearer "+token);
      con.setRequestProperty("Accept","application/json");
      con.setUseCaches(false);
      if(body!=null){
        con.setRequestMethod("POST");
        con.setDoOutput(true);
        con.setRequestProperty("Content-Type","application/json");
        try(OutputStream out=con.getOutputStream()){
          out.write(body.getBytes(StandardCharsets.UTF_8));
        }
      }
      int response=con.getResponseCode();
      if(response<200||response>=300)throw new java.io.IOException("Pulse HTTP "+response);
      try(InputStream stream=con.getInputStream();ByteArrayOutputStream bytes=new ByteArrayOutputStream()){
        byte[] buffer=new byte[2048];
        for(int size;(size=stream.read(buffer))>=0;){if(size>0)bytes.write(buffer,0,size);}
        return new JSONObject(bytes.toString("UTF-8"));
      }
    }finally{con.disconnect();}
  }

  static JSONObject snapshot(Context context)throws Exception{
    return sendRequest(context,"/v1/pulse",null);
  }

  static void heartbeat(Context context,boolean foreground){
    Context app=context.getApplicationContext();
    if(MainActivity.token(app).isEmpty())return;
    new Thread(()->{
      try{
        JSONObject payload=new JSONObject();
        payload.put("foreground",foreground);
        payload.put("app_version",MainActivity.APP_VERSION);
        sendRequest(app,"/v1/mobile/heartbeat",payload.toString());
      }catch(Exception e){
        android.util.Log.d("SB_SystemPulse","Heartbeat unavailable: "+e.getClass().getSimpleName());
      }
    },"SB-Radar-Pulse").start();
  }
}
