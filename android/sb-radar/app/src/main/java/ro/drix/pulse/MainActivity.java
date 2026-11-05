package ro.drix.pulse;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.net.Uri;
import android.os.*;
import android.webkit.*;
import android.view.*;
import android.widget.*;
import org.json.JSONObject;
import java.net.*;
import java.io.*;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;

public class MainActivity extends Activity implements SensorEventListener {
  static final String BASE="https://ghost-equal-alert-v1.drix-beast-xray.workers.dev";
  static final String APP_VERSION="2.3.19";
  static final String PREF_NAME="drix_pulse";
  WebView web;
  TextView footer;
  LinearLayout root;
  SharedPreferences prefs;
  // Native gravity sensor: 3D radar moves from launch, without a screen tap.
  // Does not touch FCM, betting signals, the alert monitor, or the 2D view.
  SensorManager tiltSensorManager;
  Sensor gravitySensor;
  long lastTiltFrameMs;
  int tiltCalSamples=0;
  float tiltSumP, tiltSumW, tiltBaseP, tiltBaseW;
  float tiltFilteredP=Float.NaN, tiltFilteredW=Float.NaN;
  float tiltTargetP=48f, tiltTargetW=-12f;
  float tiltSmoothP=48f, tiltSmoothW=-12f;
  float tiltPublishedP=Float.NaN, tiltPublishedW=Float.NaN;

  // Exactly one camera writer on Android: native tilt. WebView sensor listeners are
  // still present as a fallback for browser users, but may not overwrite native tilt.
  static final String NATIVE_TILT_GUARD_SCRIPT=
    "(function(){try{if(window.__sbNativeTiltGuard||typeof setRadar3DCamera!=='function')return;"+
    "var camera=setRadar3DCamera;window.__sbNativeTiltGuard=true;"+
    "window.__sbNativeTiltSet=function(p,y){if(typeof radarMode==='undefined'||radarMode!=='3d')return;"+
    "var stage=document.querySelector('.radar3d-stage');if(!stage||stage.classList.contains('dragging'))return;"+
    "if(typeof radar3dMotionHoldUntil!=='undefined'&&Date.now()<radar3dMotionHoldUntil)return;"+
    "window.__sbNativeTiltWrite=true;try{camera(p,y);stage.classList.add('radar-sensor-active')}"+
    "finally{window.__sbNativeTiltWrite=false}};"+
    "window.setRadar3DCamera=function(p,y){"+
    "if(!window.__sbNativeTiltWrite&&!(typeof radar3dMotionHoldUntil!=='undefined'&&Date.now()<radar3dMotionHoldUntil))return;"+
    "return camera.apply(this,arguments)};"+
    "}catch(e){}})();";
  static float tiltClamp(float v,float min,float max){return Math.max(min,Math.min(max,v));}
  static float tiltDeadZone(float v,float zone){
    return Math.abs(v)<=zone?0f:Math.copySign(Math.abs(v)-zone,v);
  }

  static String token(Context ctx){return ctx.getSharedPreferences(PREF_NAME,Context.MODE_PRIVATE).getString("token","");}
  static String readHttp(String url,String token,String payload)throws Exception{
    HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();
    c.setConnectTimeout(12000);c.setReadTimeout(12000);
    c.setRequestProperty("Accept","application/json");
    if(token!=null&&!token.isEmpty())c.setRequestProperty("Authorization","Bearer "+token);
    if(payload!=null){c.setRequestMethod("POST");c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");try(OutputStream os=c.getOutputStream()){os.write(payload.getBytes("UTF-8"));}}
    int status=c.getResponseCode();
    if(status<200||status>=300){c.disconnect();throw new IOException("request unavailable");}
    try(InputStream is=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
      byte[] b=new byte[4096];int n;while((n=is.read(b))!=-1)out.write(b,0,n);
      c.disconnect();return out.toString("UTF-8");
    }
  }
  @Override public void onCreate(Bundle b){
    super.onCreate(b);
    getWindow().setStatusBarColor(Color.rgb(12,19,26));getWindow().setNavigationBarColor(Color.rgb(12,19,26));
    prefs=getSharedPreferences(PREF_NAME,MODE_PRIVATE);
    tiltSensorManager=(SensorManager)getSystemService(SENSOR_SERVICE);
    if(tiltSensorManager!=null){
      gravitySensor=tiltSensorManager.getDefaultSensor(Sensor.TYPE_GRAVITY);
      if(gravitySensor==null)gravitySensor=tiltSensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
    }
    if(prefs.getString("device_id","").isEmpty()){
      byte[] v=new byte[32];new SecureRandom().nextBytes(v);
      prefs.edit().putString("device_id",UUID.randomUUID().toString()).putString("token",Base64.getUrlEncoder().withoutPadding().encodeToString(v)).apply();
    }
    root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(0xff101719);
    web=new WebView(this);web.setBackgroundColor(0xff101719);
    web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);web.getSettings().setAllowFileAccess(false);
    web.getSettings().setAllowContentAccess(false);web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    WebView.setWebContentsDebuggingEnabled(false);
    web.addJavascriptInterface(new NativeBridge(),"DrixNative");
    web.setWebChromeClient(new WebChromeClient());
    web.setWebViewClient(new WebViewClient(){
      @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest r){
        Uri u=r.getUrl();if("https".equals(u.getScheme())&&"ghost-equal-alert-v1.drix-beast-xray.workers.dev".equals(u.getHost()))return false;
        if("http".equals(u.getScheme())||"https".equals(u.getScheme())||"whatsapp".equals(u.getScheme())){
          try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){}return true;
        }
        return true;
      }
      @Override public void onPageFinished(WebView view,String url){
        super.onPageFinished(view,url);
        if(gravitySensor!=null&&url!=null&&url.startsWith(BASE+"/app"))
          view.evaluateJavascript(NATIVE_TILT_GUARD_SCRIPT,null);
      }
      @Override public void onReceivedError(WebView view,WebResourceRequest req,WebResourceError e){if(req.isForMainFrame())showOffline();}
      @Override public void onReceivedHttpError(WebView view,WebResourceRequest req,WebResourceResponse resp){if(req.isForMainFrame()&&resp.getStatusCode()>=500)showOffline();}
    });
    root.addView(web,new LinearLayout.LayoutParams(-1,0,1f));
    footer=new TextView(this);footer.setText("APK "+APP_VERSION+"  •  Server —");
    footer.setTextSize(10);footer.setTextColor(0xff97a5b4);footer.setPadding(14,5,12,7);footer.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);
    root.addView(footer,new LinearLayout.LayoutParams(-1,-2));
    setContentView(root);
    if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)
      requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},1);
    acknowledgeAlert(getIntent()); // Opening via a notification stops sound/vibration, including a delayed FCM start.
    startRadar(); // Native monitor is enabled whenever the user opens the app.
    offerFullScreenPermission();
    FirebaseBootstrap.init(this); // Optional FCM; never interferes with the existing login or slip.
    enrollAndOpen();
  }
  private void offerFullScreenPermission(){
    if(Build.VERSION.SDK_INT<34)return;
    android.app.NotificationManager m=(android.app.NotificationManager)getSystemService(NOTIFICATION_SERVICE);
    if(m.canUseFullScreenIntent()||prefs.getBoolean("fsi_prompted_v237",false))return;
    prefs.edit().putBoolean("fsi_prompted_v237",true).apply();
    new android.app.AlertDialog.Builder(this).setTitle("Alerte pe ecranul blocat")
      .setMessage("Pentru 🟣 Strong + Silver și 🔴 Strong, permite afișarea alertelor fullscreen pe ecranul blocat. Fără această permisiune, Android poate afișa doar notificarea obișnuită.")
      .setPositiveButton("Deschide setările",(d,w)->openFullScreenSettings())
      .setNegativeButton("Mai târziu",null).show();
  }
  private void openFullScreenSettings(){
    if(Build.VERSION.SDK_INT<34)return;
    try{Intent i=new Intent(android.provider.Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
      Uri.parse("package:"+getPackageName()));startActivity(i);}catch(Exception ignored){}
  }
  @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] results){
    super.onRequestPermissionsResult(requestCode,permissions,results);
    if(requestCode==1&&results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)startRadar();
  }
  private void enrollAndOpen(){
    new Thread(()->{
      try{
        JSONObject j=new JSONObject();
        j.put("device_id",prefs.getString("device_id",""));j.put("token",token(this));
        j.put("model",Build.MANUFACTURER+" "+Build.MODEL);j.put("os_version",Build.VERSION.RELEASE);j.put("app_version",APP_VERSION);
        readHttp(BASE+"/api/mobile/claim",null,j.toString());
        FirebaseBootstrap.onClaimReady(this);
        final String v;
        String value="—";try{value=new JSONObject(readHttp(BASE+"/api/mobile/version",token(this),null)).optString("server_version","—");}catch(Exception ignored){}
        v=value;runOnUiThread(()->{footer.setText("APK "+APP_VERSION+"  •  Server "+v);openIntent(getIntent());});
      }catch(Exception e){runOnUiThread(this::showOffline);}
    }).start();
  }
  private void showOffline(){
    String page="<!doctype html><html lang='ro'><meta name='viewport' content='width=device-width,initial-scale=1'><body style='background:#101719;color:#f3f4f7;font:16px system-ui;padding:34px;text-align:center'><div style='font-size:50px'>📡</div><h2>SB Radar este offline</h2><p>Nu putem încărca datele acum. Verifică Wi-Fi sau datele mobile.</p><button style='padding:13px 25px;border:0;border-radius:12px;background:#ed2944;color:white' onclick='DrixNative.retry()'>Reîncearcă</button></body></html>";
    web.loadDataWithBaseURL(BASE+"/app",page,"text/html","UTF-8",null);
  }
  private void openIntent(Intent intent){
    String tab="live",id=null,bet=null;
    Uri u=intent==null?null:intent.getData();
    if(u!=null){tab="slip".equals(u.getQueryParameter("tab"))?"slip":"live";id=u.getQueryParameter("event_id");bet=u.getQueryParameter("bet_id");}
    String path="/app?tab="+tab;
    if(id!=null&&id.matches("[0-9]{1,16}"))path+="&event_id="+id;
    if(bet!=null&&bet.matches("[0-9]{1,16}"))path+="&bet_id="+bet;
    web.loadUrl(BASE+path);
  }
  private void acknowledgeAlert(Intent i){
    int id=i==null?0:i.getIntExtra("sb_alert_id",0);
    if(id>0)AlertService.dismiss(this,id);
    else AlertService.silence(this);
  }
  @Override protected void onNewIntent(Intent i){super.onNewIntent(i);setIntent(i);acknowledgeAlert(i);if(web!=null)openIntent(i);}
  @Override public void onBackPressed(){if(web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();}
  @Override protected void onResume(){
    super.onResume();
    tiltCalSamples=0;tiltSumP=0;tiltSumW=0;
    tiltFilteredP=Float.NaN;tiltFilteredW=Float.NaN;
    tiltTargetP=48f;tiltTargetW=-12f;
    tiltSmoothP=48f;tiltSmoothW=-12f;
    tiltPublishedP=Float.NaN;tiltPublishedW=Float.NaN;lastTiltFrameMs=0;
    if(tiltSensorManager!=null&&gravitySensor!=null)
      tiltSensorManager.registerListener(this,gravitySensor,SensorManager.SENSOR_DELAY_GAME);
  }
  @Override protected void onPause(){
    if(tiltSensorManager!=null)tiltSensorManager.unregisterListener(this);
    super.onPause();
  }
  @Override public void onAccuracyChanged(Sensor sensor,int accuracy){}
  @Override public void onSensorChanged(SensorEvent e){
    if(e.sensor!=gravitySensor||web==null||e.values.length<3||!web.isShown())return;
    long now=SystemClock.elapsedRealtime();
    if(now-lastTiltFrameMs<65)return; // Cap work to ~15fps when visible.
    lastTiltFrameMs=now;
    float x=e.values[0],y=e.values[1],z=e.values[2];
    if(!Float.isFinite(x)||!Float.isFinite(y)||!Float.isFinite(z))return;
    float p=(float)Math.toDegrees(Math.atan2(-y,Math.max(1.0,Math.abs(z))));
    float w=(float)Math.toDegrees(Math.atan2(x,Math.max(1.0,Math.hypot(y,z))));

    // Allow gravity/accelerometer to settle before establishing the neutral pose.
    if(tiltCalSamples<8){
      tiltSumP+=p;tiltSumW+=w;tiltCalSamples++;
      if(tiltCalSamples==8){
        tiltBaseP=tiltSumP/8f;tiltBaseW=tiltSumW/8f;
        tiltFilteredP=tiltBaseP;tiltFilteredW=tiltBaseW;
      }
      return;
    }

    // Two filters: suppress raw sensor noise, then smooth the camera.
    tiltFilteredP+=(p-tiltFilteredP)*0.13f;
    tiltFilteredW+=(w-tiltFilteredW)*0.13f;
    float nextP=tiltClamp(48f+tiltDeadZone(tiltFilteredP-tiltBaseP,1.7f)*0.40f,30f,56f);
    float nextW=tiltClamp(-12f+tiltDeadZone(tiltFilteredW-tiltBaseW,1.6f)*0.72f,-34f,34f);
    // Hysteresis prevents camera jumps even if the phone is held perfectly still.
    if(Math.abs(nextP-tiltTargetP)>0.60f)tiltTargetP=nextP;
    if(Math.abs(nextW-tiltTargetW)>0.60f)tiltTargetW=nextW;
    tiltSmoothP+=(tiltTargetP-tiltSmoothP)*0.17f;
    tiltSmoothW+=(tiltTargetW-tiltSmoothW)*0.17f;
    if(Math.abs(tiltSmoothP-tiltTargetP)<0.08f)tiltSmoothP=tiltTargetP;
    if(Math.abs(tiltSmoothW-tiltTargetW)<0.08f)tiltSmoothW=tiltTargetW;
    if(Float.isFinite(tiltPublishedP)&&Float.isFinite(tiltPublishedW)&&
        Math.abs(tiltSmoothP-tiltPublishedP)<0.13f&&Math.abs(tiltSmoothW-tiltPublishedW)<0.13f)return;
    tiltPublishedP=tiltSmoothP;tiltPublishedW=tiltSmoothW;
    // Never write CSS from both native and browser sensor listeners.
    String js="try{if(!document.hidden&&window.__sbNativeTiltSet)window.__sbNativeTiltSet("+
      Float.toString(tiltSmoothP)+","+Float.toString(tiltSmoothW)+");}catch(e){}";
    web.evaluateJavascript(js,null);
  }
  private void startRadar(){
    prefs.edit().putBoolean("monitor",true).apply();
    Intent i=new Intent(this,AlertService.class);i.setAction("START");
    try{if(Build.VERSION.SDK_INT>=26)startForegroundService(i);else startService(i);}catch(Exception e){Toast.makeText(this,"Monitorul nu a pornit. Verifică permisiunile.",Toast.LENGTH_LONG).show();}
  }
  private void stopRadar(){prefs.edit().putBoolean("monitor",false).apply();stopService(new Intent(this,AlertService.class));}
  public class NativeBridge{
    @JavascriptInterface public String getToken(){return token(MainActivity.this);}
    @JavascriptInterface public String getAppVersion(){return APP_VERSION;}
    @JavascriptInterface public String getFcmStatus(){return FirebaseBootstrap.status(MainActivity.this);}
    @JavascriptInterface public String getFullscreenDiagnostics(){
      try{
        android.app.NotificationManager n=(android.app.NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        JSONObject j=new JSONObject();
        j.put("apk",APP_VERSION);
        j.put("fsi_permission",Build.VERSION.SDK_INT<34||n.canUseFullScreenIntent());
        j.put("last_fcm_ms",prefs.getLong("fcm_last_received_ms",0));
        j.put("last_fcm_priority",prefs.getString("fcm_last_priority",""));
        j.put("last_fsi_requested",prefs.getBoolean("fcm_last_fsi_requested",false));
        j.put("last_notification_importance",prefs.getInt("fcm_last_channel_importance",0));
        j.put("last_fcm_label",prefs.getString("fcm_last_signal",""));
        return j.toString();
      }catch(Exception e){return "{}";}
    }
    @JavascriptInterface public String isMonitoring(){return prefs.getBoolean("monitor",false)?"true":"false";}
    @JavascriptInterface public void startMonitor(){runOnUiThread(()->startRadar());}
    @JavascriptInterface public void stopMonitor(){runOnUiThread(()->stopRadar());}
    @JavascriptInterface public void retry(){runOnUiThread(()->enrollAndOpen());}
    @JavascriptInterface public void testNotification(){runOnUiThread(()->AlertService.testAlert(MainActivity.this,"GOLDEN TICKET"));}
    @JavascriptInterface public void testGoldenAlert(){runOnUiThread(()->AlertService.testAlert(MainActivity.this,"GOLDEN TICKET"));}
    @JavascriptInterface public void testMlAlert(){runOnUiThread(()->AlertService.testAlert(MainActivity.this,"GOLD RUSH"));}
    @JavascriptInterface public void setupFullScreenAlerts(){runOnUiThread(()->openFullScreenSettings());}
  }
}