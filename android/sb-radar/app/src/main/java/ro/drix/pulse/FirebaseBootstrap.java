package ro.drix.pulse;

import android.content.*;
import android.util.Log;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import org.json.JSONObject;

// Public Firebase Android options are fetched dynamically; no server-side credentials enter the APK.
public final class FirebaseBootstrap {
  static final String PUSH_BASE="https://sb-radar-push-v1.drix-beast-xray.workers.dev";
  private static volatile boolean initialized=false;
  private FirebaseBootstrap(){}
  static void init(Context ctx){
    Context app=ctx.getApplicationContext();
    if(initialized)return;
    new Thread(()->{
      try{
        JSONObject cfg=new JSONObject(MainActivity.readHttp(PUSH_BASE+"/v1/config",null,null));
        if(!cfg.optBoolean("enabled",false))return;
        String project=cfg.optString("project_id"),appId=cfg.optString("application_id");
        String apiKey=cfg.optString("api_key"),sender=cfg.optString("sender_id");
        if(project.isEmpty()||appId.isEmpty()||apiKey.isEmpty()||sender.isEmpty())return;
        synchronized(FirebaseBootstrap.class){
          if(FirebaseApp.getApps(app).isEmpty()){
            FirebaseOptions options=new FirebaseOptions.Builder()
              .setProjectId(project).setApplicationId(appId).setApiKey(apiKey).setGcmSenderId(sender).build();
            FirebaseApp.initializeApp(app,options);
          }
          initialized=true;
        }
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task->{
          if(task.isSuccessful()&&task.getResult()!=null)registerToken(app,task.getResult());
          else Log.w("SB_Radar_FCM","FCM token unavailable");
        });
      }catch(Exception e){Log.i("SB_Radar_FCM","FCM not configured; keeping existing mobile polling");}
    },"SB-FCM-bootstrap").start();
  }
  static void registerToken(Context ctx,String fcm){
    new Thread(()->{
      try{
        SharedPreferences p=ctx.getSharedPreferences(MainActivity.PREF_NAME,Context.MODE_PRIVATE);
        String dev=p.getString("device_id",""),auth=MainActivity.token(ctx);
        if(dev.isEmpty()||auth.isEmpty()||fcm.isEmpty())return;
        JSONObject body=new JSONObject();body.put("device_id",dev);body.put("fcm_token",fcm);
        MainActivity.readHttp(PUSH_BASE+"/v1/register",auth,body.toString());
      }catch(Exception e){Log.w("SB_Radar_FCM","Registration unavailable; polling remains active");}
    },"SB-FCM-enroll").start();
  }
}
