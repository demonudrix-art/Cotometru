package ro.drix.pulse;

import android.content.*;
import android.util.Log;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import org.json.JSONObject;

/** Optional FCM transport; never changes app account, slip or existing notification monitor. */
public final class FirebaseBootstrap {
  static final String PUSH_BASE="https://sb-radar-push-v1.drix-beast-xray.workers.dev";
  private static volatile boolean initialized=false;
  private static volatile boolean initializing=false;
  private FirebaseBootstrap(){}

  private static void status(Context ctx,String state){
    ctx.getApplicationContext().getSharedPreferences(MainActivity.PREF_NAME,Context.MODE_PRIVATE)
       .edit().putString("fcm_state",state).apply();
    Log.i("SB_Radar_FCM","state="+state);
  }
  static String status(Context ctx){
    return ctx.getSharedPreferences(MainActivity.PREF_NAME,Context.MODE_PRIVATE).getString("fcm_state","inițializare");
  }
  static void init(Context ctx){
    Context app=ctx.getApplicationContext();
    synchronized(FirebaseBootstrap.class){
      if(initialized){ refreshToken(app);return; }
      if(initializing)return;
      initializing=true;
    }
    status(app,"configurare");
    new Thread(()->{
      try{
        JSONObject cfg=new JSONObject(MainActivity.readHttp(PUSH_BASE+"/v1/config",null,null));
        if(!cfg.optBoolean("enabled",false))throw new IllegalStateException("Firebase config disabled");
        String project=cfg.optString("project_id"),appId=cfg.optString("application_id");
        String apiKey=cfg.optString("api_key"),sender=cfg.optString("sender_id");
        if(project.isEmpty()||appId.isEmpty()||apiKey.isEmpty()||sender.isEmpty())
          throw new IllegalStateException("Incomplete client configuration");
        synchronized(FirebaseBootstrap.class){
          if(FirebaseApp.getApps(app).isEmpty()){
            FirebaseOptions options=new FirebaseOptions.Builder()
              .setProjectId(project).setApplicationId(appId).setApiKey(apiKey)
              .setGcmSenderId(sender).build();
            FirebaseApp.initializeApp(app,options);
          }
          initialized=true;
        }
        refreshToken(app);
      }catch(Exception e){
        status(app,"config invalidă");
        Log.w("SB_Radar_FCM","Firebase bootstrap failed",e);
      }finally{initializing=false;}
    },"SB-FCM-bootstrap").start();
  }
  static void refreshToken(Context ctx){
    Context app=ctx.getApplicationContext();
    if(!initialized){init(app);return;}
    status(app,"obținere token");
    try{
      FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task->{
        if(task.isSuccessful()&&task.getResult()!=null&&!task.getResult().isEmpty()){
          String fcm=task.getResult();
          app.getSharedPreferences(MainActivity.PREF_NAME,Context.MODE_PRIVATE)
             .edit().putString("fcm_token_pending",fcm).apply();
          registerToken(app,fcm);
        }else{
          status(app,"token indisponibil");
          Log.w("SB_Radar_FCM","FCM token unavailable",task.getException());
        }
      });
    }catch(Exception e){status(app,"token indisponibil");Log.w("SB_Radar_FCM","getToken error",e);}
  }
  /** Called after /api/mobile/claim succeeds. Retries any registration racing with enrollment. */
  static void onClaimReady(Context ctx){
    Context app=ctx.getApplicationContext();
    if(!initialized){init(app);return;}
    String pending=app.getSharedPreferences(MainActivity.PREF_NAME,Context.MODE_PRIVATE)
      .getString("fcm_token_pending","");
    if(!pending.isEmpty())registerToken(app,pending);
    else refreshToken(app);
  }
  static void registerToken(Context ctx,String fcm){
    Context app=ctx.getApplicationContext();
    if(fcm==null||fcm.isEmpty())return;
    app.getSharedPreferences(MainActivity.PREF_NAME,Context.MODE_PRIVATE)
       .edit().putString("fcm_token_pending",fcm).apply();
    new Thread(()->{
      try{
        SharedPreferences p=app.getSharedPreferences(MainActivity.PREF_NAME,Context.MODE_PRIVATE);
        String deviceId=p.getString("device_id",""),auth=MainActivity.token(app);
        if(deviceId.isEmpty()||auth.isEmpty()){status(app,"așteaptă identificare");return;}
        if(fcm.equals(p.getString("fcm_token_registered",""))){status(app,"înregistrat");return;}
        status(app,"înregistrare");
        JSONObject body=new JSONObject();body.put("device_id",deviceId);body.put("fcm_token",fcm);
        JSONObject reply=new JSONObject(MainActivity.readHttp(PUSH_BASE+"/v1/register",auth,body.toString()));
        if(!reply.optBoolean("ok",false))throw new IllegalStateException("Server rejected registration");
        p.edit().putString("fcm_token_registered",fcm).putString("fcm_state","înregistrat").apply();
      }catch(Exception e){
        status(app,"înregistrare eșuată");
        Log.w("SB_Radar_FCM","FCM device registration failed; existing alerts remain active",e);
      }
    },"SB-FCM-enroll").start();
  }
}
