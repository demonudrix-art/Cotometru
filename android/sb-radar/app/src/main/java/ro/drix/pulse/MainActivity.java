package ro.drix.pulse;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
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
  static final String APP_VERSION="2.3.31";
  static final String PREF_NAME="drix_pulse";
  WebView web;
  TextView footer;
  LinearLayout root;
  SharedPreferences prefs;
  FrameLayout nativeSurface;
  LinearLayout nativeSplash;
  LinearLayout nativeBottomTabs;
  final LinearLayout[] nativeTabCells=new LinearLayout[4];
  final TextView[] nativeTabGlyphs=new TextView[4];
  final TextView[] nativeTabLabels=new TextView[4];
  static final String[] NATIVE_ROUTES={"live","slip","roi","profile"};
  static final String[] NATIVE_LABELS={"RADAR","SLIP","ROI","PROFIL"};
  static final String[] NATIVE_GLYPHS={"◎","▤","⌁","♙"};
  boolean nativeTabsVisible=false;
  String nativeActiveRoute="live";
  // Native gravity sensor: 3D radar moves from launch, without a screen tap.
  // Does not touch FCM, betting signals, the alert monitor, or the 2D view.
  private static volatile boolean appForeground=false;
  static boolean isAppForeground(){return appForeground;}
  final Handler pulseTimer=new Handler(Looper.getMainLooper());
  final Runnable pulseTick=new Runnable(){
    @Override public void run(){
      SystemPulse.heartbeat(MainActivity.this,true);
      pulseTimer.postDelayed(this,30000);
    }
  };
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

  // The four-tab navigation is rendered by Android. The radar and account
  // forms stay backed by the existing licensed web app and API.
  // If injection cannot initialize, the original web navigation remains visible.
  static final String NATIVE_NAV_SCRIPT=
    "(function(){try{if(window.__sbAndroidNavInstalled||typeof tab!=='function')return;"+
    "var nav=document.getElementById('nav');if(!nav)return;"+
    "window.__sbAndroidNavInstalled=true;"+
    "var style=document.createElement('style');style.id='sb-android-native-nav-css';"+
    "style.textContent='html.sb-android-native-nav #nav{display:none!important}';document.head.appendChild(style);"+
    "function sync(){var enabled=!nav.classList.contains('hidden');"+
    "document.documentElement.classList.toggle('sb-android-native-nav',enabled);"+
    "if(!window.DrixNative)return;DrixNative.setNativeTabsVisible(enabled);"+
    "var which=['live','slip','roi','profile'].find(function(n){var e=document.getElementById('tab-'+n);return e&&e.classList.contains('active')});"+
    "if(which)DrixNative.setNativeTabActive(which)}"+
    "var previous=tab;window.tab=function(){var value=previous.apply(this,arguments);sync();return value;};"+
    "new MutationObserver(sync).observe(nav,{attributes:true,attributeFilter:['class']});sync();"+
    "}catch(e){}})();";
  static final String NATIVE_ADMIN_ENTRY_SCRIPT="(function(){try{if(!window.DrixNative||typeof DrixNative.openAdminConsole!=='function')return;var profile=document.getElementById('profile');if(!profile||document.getElementById('sbNativeAdminEntry'))return;var b=document.createElement('button');b.id='sbNativeAdminEntry';b.textContent='🛡 ADMIN · LICENȚE & SISTEM';b.style.cssText='display:block;width:100%;margin:5px 0 15px;padding:14px;border:1px solid #87354d;border-radius:13px;background:#4b1830;color:white;font-weight:800;font-size:13px';b.addEventListener('click',function(){DrixNative.openAdminConsole()});profile.insertBefore(b,profile.firstChild);}catch(e){}})();";
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
        if(url!=null&&url.startsWith(BASE+"/app")){
          if(gravitySensor!=null)view.evaluateJavascript(NATIVE_TILT_GUARD_SCRIPT,null);
          view.evaluateJavascript(NATIVE_NAV_SCRIPT,null);
          view.evaluateJavascript(NATIVE_ADMIN_ENTRY_SCRIPT,null);
          // A slow page may finish its JS setup after the HTML load event.
          view.postDelayed(()->{
            if(!isFinishing()&&web==view)view.evaluateJavascript(NATIVE_NAV_SCRIPT,null);
          },380);
          view.postDelayed(()->{
            if(!isFinishing()&&web==view)view.evaluateJavascript(NATIVE_NAV_SCRIPT,null);
          },1150);
          // If native navigation arrived from Admin, the destination document is
          // new. Its tab handler must select the requested screen after load.
          String requested=null;
          try{requested=Uri.parse(url).getQueryParameter("tab");}catch(Exception ignored){}
          String destination=null;
          for(String option:NATIVE_ROUTES)if(option.equals(requested)){destination=option;break;}
          if(destination!=null){
            final String selected=destination;
            view.postDelayed(()->{
              if(!isFinishing()&&web==view&&isAppWebPage(view.getUrl())){
                view.evaluateJavascript("try{if(typeof tab==='function')tab('"+selected+"')}catch(e){}",null);
              }
            },450);
          }
        }
        hideNativeSplash();
      }
      @Override public void onReceivedError(WebView view,WebResourceRequest req,WebResourceError e){if(req.isForMainFrame())showOffline();}
      @Override public void onReceivedHttpError(WebView view,WebResourceRequest req,WebResourceResponse resp){if(req.isForMainFrame()&&resp.getStatusCode()>=500)showOffline();}
    });
    nativeSurface=new FrameLayout(this);
    nativeSurface.setBackgroundColor(0xff101719);
    nativeSurface.addView(web,new FrameLayout.LayoutParams(-1,-1));
    buildNativeSplash();
    root.addView(nativeSurface,new LinearLayout.LayoutParams(-1,0,1f));
    buildNativeTabs();
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
  private int dp(float value){return Math.round(value*getResources().getDisplayMetrics().density);}

  private GradientDrawable nativeBackground(int fill,int outline,int radius){
    GradientDrawable bg=new GradientDrawable();
    bg.setColor(fill);
    bg.setCornerRadius(dp(radius));
    if(outline!=0)bg.setStroke(dp(1),outline);
    return bg;
  }

  private void buildNativeSplash(){
    nativeSplash=new LinearLayout(this);
    nativeSplash.setOrientation(LinearLayout.VERTICAL);
    nativeSplash.setGravity(Gravity.CENTER);
    nativeSplash.setBackgroundColor(0xff0c111a);
    TextView symbol=new TextView(this);
    symbol.setText("◎");symbol.setTextSize(56);
    symbol.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
    symbol.setTextColor(0xfff12c53);
    symbol.setGravity(Gravity.CENTER);
    nativeSplash.addView(symbol,new LinearLayout.LayoutParams(-1,dp(72)));
    TextView title=new TextView(this);
    title.setText("SB RADAR");
    title.setTextSize(25);title.setLetterSpacing(.13f);
    title.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
    title.setTextColor(0xfff7f2f5);title.setGravity(Gravity.CENTER);
    nativeSplash.addView(title,new LinearLayout.LayoutParams(-1,dp(46)));
    TextView subtitle=new TextView(this);
    subtitle.setText("FOTBAL LIVE  •  ALERTE  •  STATISTICI");
    subtitle.setTextSize(10);subtitle.setLetterSpacing(.11f);
    subtitle.setTextColor(0xffbbaebc);subtitle.setGravity(Gravity.CENTER);
    nativeSplash.addView(subtitle,new LinearLayout.LayoutParams(-1,dp(27)));
    ProgressBar spinner=new ProgressBar(this,null,android.R.attr.progressBarStyleSmall);
    spinner.setIndeterminateTintList(android.content.res.ColorStateList.valueOf(0xfff13f62));
    LinearLayout.LayoutParams spin=new LinearLayout.LayoutParams(dp(26),dp(26));
    spin.topMargin=dp(24);spin.gravity=Gravity.CENTER_HORIZONTAL;
    nativeSplash.addView(spinner,spin);
    nativeSurface.addView(nativeSplash,new FrameLayout.LayoutParams(-1,-1));
  }

  private void hideNativeSplash(){
    if(nativeSplash==null||nativeSplash.getVisibility()!=View.VISIBLE)return;
    LinearLayout splash=nativeSplash;
    splash.animate().cancel();
    splash.animate().alpha(0f).setDuration(180).withEndAction(()->{
      if(splash==nativeSplash)splash.setVisibility(View.GONE);
    }).start();
  }

  private void buildNativeTabs(){
    nativeBottomTabs=new LinearLayout(this);
    nativeBottomTabs.setOrientation(LinearLayout.HORIZONTAL);
    nativeBottomTabs.setGravity(Gravity.CENTER_VERTICAL);
    nativeBottomTabs.setPadding(dp(8),dp(5),dp(8),dp(5));
    // Cinematic native glass-style navigation: one lightweight gradient layer.
    GradientDrawable navGlass=new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
      new int[]{0xef221b2d,0xff11141e});
    navGlass.setStroke(dp(1),0x664d6271);
    nativeBottomTabs.setBackground(navGlass);
    nativeBottomTabs.setElevation(dp(10));
    for(int i=0;i<NATIVE_ROUTES.length;i++){
      final int n=i;
      LinearLayout cell=new LinearLayout(this);
      cell.setOrientation(LinearLayout.VERTICAL);
      cell.setGravity(Gravity.CENTER);
      cell.setPadding(dp(2),dp(5),dp(2),dp(5));
      cell.setClickable(true);cell.setFocusable(true);
      cell.setContentDescription(NATIVE_LABELS[i]);
      TextView symbol=new TextView(this);
      symbol.setText(NATIVE_GLYPHS[i]);
      symbol.setTextSize(24);symbol.setGravity(Gravity.CENTER);
      cell.addView(symbol,new LinearLayout.LayoutParams(-1,dp(29)));
      TextView label=new TextView(this);
      label.setText(NATIVE_LABELS[i]);
      label.setTextSize(10);label.setLetterSpacing(.04f);
      label.setTypeface(Typeface.DEFAULT,Typeface.BOLD);label.setGravity(Gravity.CENTER);
      cell.addView(label,new LinearLayout.LayoutParams(-1,dp(20)));
      LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(0,dp(60),1f);
      cp.setMargins(dp(2),0,dp(2),0);
      nativeBottomTabs.addView(cell,cp);
      nativeTabCells[i]=cell;nativeTabGlyphs[i]=symbol;nativeTabLabels[i]=label;
      cell.setOnClickListener(v->{
        v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY);
        selectNativeTab(NATIVE_ROUTES[n]);
      });
    }
    nativeBottomTabs.setVisibility(View.GONE);
    root.addView(nativeBottomTabs,new LinearLayout.LayoutParams(-1,dp(70)));
    renderNativeTabState();
  }

  private void renderNativeTabState(){
    for(int i=0;i<NATIVE_ROUTES.length;i++){
      boolean active=NATIVE_ROUTES[i].equals(nativeActiveRoute);
      if(nativeTabCells[i]==null)continue;
      boolean changed=nativeTabCells[i].isSelected()!=active;
      nativeTabCells[i].setBackground(nativeBackground(active?0xff5b233f:0xff1d1c2a,
          active?0xffa44b75:0x55445564,14));
      if(changed)nativeTabCells[i].animate().scaleX(active?1.025f:1f).scaleY(active?1.025f:1f).setDuration(180).start();
      int tint=active?0xfff9f2f5:0xffb6a6b7;
      nativeTabGlyphs[i].setTextColor(tint);
      nativeTabLabels[i].setTextColor(tint);
      nativeTabCells[i].setSelected(active);
    }
  }

  private boolean isAppWebPage(String url){
    if(url==null)return false;
    try{
      Uri u=Uri.parse(url);
      return "https".equals(u.getScheme())&&
        "ghost-equal-alert-v1.drix-beast-xray.workers.dev".equals(u.getHost())&&
        "/app".equals(u.getPath());
    }catch(Exception ignored){return false;}
  }

  /**
   * Always route native tabs to the SB Radar app. Admin /chrome-bridge and
   * /admin are separate HTML documents and do not define window.tab(...).
   * Simply calling tab() on them changes the native highlight but not the
   * WebView page, leaving Admin stuck over Radar/Slip/ROI.
   */
  private void selectNativeTab(String route){
    boolean valid=false;
    for(String candidate:NATIVE_ROUTES)if(candidate.equals(route)){valid=true;break;}
    if(!valid||web==null)return;
    nativeActiveRoute=route;
    renderNativeTabState();
    if(!isAppWebPage(web.getUrl())){
      // A real navigation restores the entire radar document and its listeners.
      web.loadUrl(BASE+"/app?tab="+route);
      return;
    }
    // Normal in-app transitions stay instant and do not reload WebView.
    web.evaluateJavascript(
      "try{if(typeof tab==='function'){tab('"+route+"')}"+
      "else{location.assign('/app?tab="+route+"')}}catch(e){location.assign('/app?tab="+route+"')}",null);
  }

  private void showNativeTabs(boolean enabled){
    nativeTabsVisible=enabled;
    if(nativeBottomTabs!=null)
      nativeBottomTabs.setVisibility(enabled?View.VISIBLE:View.GONE);
  }

  private void selectNativeTabFromWeb(String route){
    for(String candidate:NATIVE_ROUTES)if(candidate.equals(route)){
      nativeActiveRoute=route;renderNativeTabState();return;
    }
  }

  private void showOffline(){
    String page="<!doctype html><html lang='ro'><meta name='viewport' content='width=device-width,initial-scale=1'><body style='background:#101719;color:#f3f4f7;font:16px system-ui;padding:34px;text-align:center'><div style='font-size:50px'>📡</div><h2>SB Radar este offline</h2><p>Nu putem încărca datele acum. Verifică Wi-Fi sau datele mobile.</p><button style='padding:13px 25px;border:0;border-radius:12px;background:#ed2944;color:white' onclick='DrixNative.retry()'>Reîncearcă</button></body></html>";
    showNativeTabs(false);
    hideNativeSplash();
    web.loadDataWithBaseURL(BASE+"/app",page,"text/html","UTF-8",null);
  }
  private void openIntent(Intent intent){
    String tab="live",id=null,bet=null;
    Uri u=intent==null?null:intent.getData();
    if(u!=null){tab="slip".equals(u.getQueryParameter("tab"))?"slip":"live";id=u.getQueryParameter("event_id");bet=u.getQueryParameter("bet_id");}
    String path="/app?tab="+tab;
    if(id!=null&&id.matches("[0-9]{1,16}"))path+="&event_id="+id;
    if(bet!=null&&bet.matches("[0-9]{1,16}"))path+="&bet_id="+bet;
    showNativeTabs(false);
    web.loadUrl(BASE+path);
  }
  private void acknowledgeAlert(Intent i){
    int id=i==null?0:i.getIntExtra("sb_alert_id",0);
    if(id>0)AlertService.dismiss(this,id);
    else AlertService.silence(this);
  }
  @Override protected void onNewIntent(Intent i){super.onNewIntent(i);setIntent(i);acknowledgeAlert(i);if(web!=null)openIntent(i);}
  @Override public void onBackPressed(){
    if(web!=null&&web.getUrl()!=null&&web.getUrl().startsWith(BASE)&&!isAppWebPage(web.getUrl())){
      // Android back from Chrome/Admin returns to the profile in the SB Radar app.
      selectNativeTab("profile");
    }else if(web!=null&&web.canGoBack())web.goBack();
    else super.onBackPressed();
  }
  @Override protected void onResume(){
    super.onResume();
    appForeground=true;
    pulseTimer.removeCallbacks(pulseTick);
    pulseTimer.post(pulseTick);
    tiltCalSamples=0;tiltSumP=0;tiltSumW=0;
    tiltFilteredP=Float.NaN;tiltFilteredW=Float.NaN;
    tiltTargetP=48f;tiltTargetW=-12f;
    tiltSmoothP=48f;tiltSmoothW=-12f;
    tiltPublishedP=Float.NaN;tiltPublishedW=Float.NaN;lastTiltFrameMs=0;
    if(tiltSensorManager!=null&&gravitySensor!=null)
      tiltSensorManager.registerListener(this,gravitySensor,SensorManager.SENSOR_DELAY_GAME);
  }
  @Override protected void onPause(){
    appForeground=false;
    pulseTimer.removeCallbacks(pulseTick);
    SystemPulse.heartbeat(this,false);
    if(tiltSensorManager!=null)tiltSensorManager.unregisterListener(this);
    super.onPause();
  }
  @Override public void onAccuracyChanged(Sensor sensor,int accuracy){}
  @Override public void onSensorChanged(SensorEvent e){
    if(e.sensor!=gravitySensor||web==null||e.values.length<3||!web.isShown())return;
    if(nativeTabsVisible&&!"live".equals(nativeActiveRoute))return;
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
    @JavascriptInterface public void setNativeTabsVisible(boolean enabled){
      runOnUiThread(()->showNativeTabs(enabled));
    }
    @JavascriptInterface public void setNativeTabActive(String route){
      runOnUiThread(()->selectNativeTabFromWeb(route));
    }
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
    @JavascriptInterface public void openAdminConsole(){runOnUiThread(()->startActivity(new Intent(MainActivity.this,AdminConsoleActivity.class)));}
    @JavascriptInterface public void autoTicketPlaced(String ticketId,String fixture,double stake){runOnUiThread(()->AutoTicketNotifier.post(MainActivity.this,ticketId,fixture,"",stake));}
    @JavascriptInterface public void setupFullScreenAlerts(){runOnUiThread(()->openFullScreenSettings());}
  }
}