package ro.drix.pulse;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
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

public class MainActivity extends Activity {
  static final String BASE="https://ghost-equal-alert-v1.drix-beast-xray.workers.dev";
  static final String APP_VERSION="2.3.0";
  static final String PREF_NAME="drix_pulse";
  WebView web;
  TextView footer;
  LinearLayout root;
  SharedPreferences prefs;

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
    enrollAndOpen();
  }
  private void enrollAndOpen(){
    new Thread(()->{
      try{
        JSONObject j=new JSONObject();
        j.put("device_id",prefs.getString("device_id",""));j.put("token",token(this));
        j.put("model",Build.MANUFACTURER+" "+Build.MODEL);j.put("os_version",Build.VERSION.RELEASE);j.put("app_version",APP_VERSION);
        readHttp(BASE+"/api/mobile/claim",null,j.toString());
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
  @Override protected void onNewIntent(Intent i){super.onNewIntent(i);setIntent(i);if(web!=null)openIntent(i);}
  @Override public void onBackPressed(){if(web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();}
  private void startRadar(){
    prefs.edit().putBoolean("monitor",true).apply();
    Intent i=new Intent(this,AlertService.class);i.setAction("START");
    try{if(Build.VERSION.SDK_INT>=26)startForegroundService(i);else startService(i);}catch(Exception e){Toast.makeText(this,"Monitorul nu a pornit. Verifică permisiunile.",Toast.LENGTH_LONG).show();}
  }
  private void stopRadar(){prefs.edit().putBoolean("monitor",false).apply();stopService(new Intent(this,AlertService.class));}
  public class NativeBridge{
    @JavascriptInterface public String getToken(){return token(MainActivity.this);}
    @JavascriptInterface public String getAppVersion(){return APP_VERSION;}
    @JavascriptInterface public String isMonitoring(){return prefs.getBoolean("monitor",false)?"true":"false";}
    @JavascriptInterface public void startMonitor(){runOnUiThread(()->startRadar());}
    @JavascriptInterface public void stopMonitor(){runOnUiThread(()->stopRadar());}
    @JavascriptInterface public void retry(){runOnUiThread(()->enrollAndOpen());}
    @JavascriptInterface public void testNotification(){runOnUiThread(()->AlertService.testAlert(MainActivity.this));}
  }
}