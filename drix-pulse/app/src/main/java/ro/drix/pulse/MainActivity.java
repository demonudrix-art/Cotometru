package ro.drix.pulse;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.content.SharedPreferences;
import android.widget.Toast;
import org.json.JSONObject;
import java.net.URL;
import java.net.HttpURLConnection;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.UUID;

public class MainActivity extends Activity {
    static final String BASE="https://ghost-equal-alert-v1.drix-beast-xray.workers.dev";
    static final String PREF="drix_pulse";
    private static final int NOTIFY_REQ=3610;
    private WebView web;
    private SharedPreferences prefs;

    private static String readSmall(java.io.InputStream in) throws java.io.IOException {
        java.io.ByteArrayOutputStream b=new java.io.ByteArrayOutputStream();byte[] a=new byte[4096];int n;
        while((n=in.read(a))!=-1&&b.size()<100000)b.write(a,0,n);
        return new String(b.toByteArray(),StandardCharsets.UTF_8);
    }
    @Override public void onCreate(Bundle s) {
        super.onCreate(s);
        getWindow().setStatusBarColor(Color.rgb(13,21,27));
        getWindow().setNavigationBarColor(Color.rgb(17,27,34));
        prefs=getSharedPreferences(PREF,MODE_PRIVATE);
        final FrameLayout layout=new FrameLayout(this);
        layout.setBackgroundColor(Color.rgb(13,21,27));
        TextView loading=new TextView(this);
        loading.setGravity(Gravity.CENTER);
        loading.setTextColor(Color.WHITE);
        loading.setTextSize(20);
        loading.setText("✕\n\nSB Radar\n\nConectare securizată…");
        layout.addView(loading,new FrameLayout.LayoutParams(-1,-1));
        setContentView(layout);
        new Thread(()->{
            String device=prefs.getString("device","");
            String token=prefs.getString("token","");
            if(device.isEmpty()){device=UUID.randomUUID().toString();prefs.edit().putString("device",device).apply();}
            if(token.isEmpty()){
                byte[] key=new byte[32];new SecureRandom().nextBytes(key);
                token=Base64.encodeToString(key,Base64.NO_WRAP|Base64.URL_SAFE|Base64.NO_PADDING);
                prefs.edit().putString("token",token).apply();
            }
            try {
                JSONObject request=new JSONObject().put("device_id",device).put("token",token).put("model",android.os.Build.MANUFACTURER+" "+android.os.Build.MODEL).put("os_version",android.os.Build.VERSION.RELEASE).put("app_version","2.2.0");
                HttpURLConnection cn=(HttpURLConnection)new URL(BASE+"/api/mobile/claim").openConnection();
                cn.setRequestMethod("POST");cn.setConnectTimeout(12000);cn.setReadTimeout(12000);
                cn.setDoOutput(true);cn.setRequestProperty("Content-Type","application/json");
                try(OutputStream os=cn.getOutputStream()){os.write(request.toString().getBytes(StandardCharsets.UTF_8));}
                int code=cn.getResponseCode();String response="";if(code==200){try(java.io.InputStream in=cn.getInputStream()){response=readSmall(in);}}cn.disconnect();
                final boolean licensed=code==200 && new JSONObject(response).optJSONObject("license")!=null && new JSONObject(response).getJSONObject("license").optBoolean("active",false);
                if(code!=200)throw new IllegalStateException(code==409?"Identitatea telefonului diferă de cea înregistrată.":"Serverul nu acceptă instalarea: "+code);
                runOnUiThread(()->{
                    web=new WebView(this);
                    web.setBackgroundColor(Color.rgb(13,21,27));
                    WebSettings st=web.getSettings();
                    st.setJavaScriptEnabled(true);
                    st.setDomStorageEnabled(true);
                    st.setAllowFileAccess(false);
                    st.setAllowContentAccess(false);
                    st.setJavaScriptCanOpenWindowsAutomatically(false);
                    st.setAllowUniversalAccessFromFileURLs(false);
                    st.setAllowFileAccessFromFileURLs(false);
                    st.setSupportMultipleWindows(false);
                    st.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
                    web.addJavascriptInterface(new Bridge(),"DrixNative");
                    web.setWebChromeClient(new WebChromeClient());
                    web.setWebViewClient(new WebViewClient(){
                        @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest req){
                            Uri uri=req.getUrl();
                            if(uri.getScheme().equals("https") && uri.getHost()!=null && uri.getHost().equals("ghost-equal-alert-v1.drix-beast-xray.workers.dev")
                               && uri.getPath()!=null && uri.getPath().equals("/app"))return false;
                            if(uri.getScheme().equals("https")){
                                try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception e){Toast.makeText(MainActivity.this,"Nu pot deschide meciul",Toast.LENGTH_SHORT).show();}
                            }
                            return true;
                        }
                    });
                    layout.removeAllViews();layout.addView(web,new FrameLayout.LayoutParams(-1,-1));
                    web.loadUrl(BASE+"/app");
                    if(licensed){
                       if(Build.VERSION.SDK_INT<33 || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED)startNativeMonitor();
                       else requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},NOTIFY_REQ);
                    }
                });
            }catch(Exception e){
                final String message=e.getMessage();
                runOnUiThread(()->loading.setText("SB Radar\n\nConectare imposibilă\n"+message+"\n\nÎnchide și redeschide aplicația pentru reîncercare."));
            }
        }).start();
    }
    @Override public void onRequestPermissionsResult(int code,String[] names,int[] grants){
        super.onRequestPermissionsResult(code,names,grants);
        if(code==NOTIFY_REQ && grants.length>0 && grants[0]==PackageManager.PERMISSION_GRANTED)startNativeMonitor();
        else if(code==NOTIFY_REQ)Toast.makeText(this,"Activează notificările în setările Android pentru alerte pe ecran blocat.",Toast.LENGTH_LONG).show();
    }
    void startNativeMonitor(){
        if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},NOTIFY_REQ);return;
        }
        prefs.edit().putBoolean("monitor",true).apply();
        try{Intent i=new Intent(this,AlertService.class);i.setAction("START");startForegroundService(i);}
        catch(Exception e){Toast.makeText(this,"Serviciul de monitorizare nu a pornit: "+e.getMessage(),Toast.LENGTH_LONG).show();}
    }
    void stopNativeMonitor(){prefs.edit().putBoolean("monitor",false).apply();stopService(new Intent(this,AlertService.class));}
    public class Bridge {
        @JavascriptInterface public String getToken(){return prefs.getString("token","");}
        @JavascriptInterface public String isMonitoring(){return String.valueOf(prefs.getBoolean("monitor",false));}
        @JavascriptInterface public void startMonitor(){runOnUiThread(()->startNativeMonitor());}
        @JavascriptInterface public void stopMonitor(){runOnUiThread(()->stopNativeMonitor());}
        @JavascriptInterface public void testNotification(){runOnUiThread(()->AlertService.showAlert(MainActivity.this,"SB Radar • TEST","Sunetul și vibrația sunt active. Acesta nu este un semnal de pariere.",BASE+"/app","test-"+System.currentTimeMillis(),true));}
    }
    @Override public void onBackPressed(){
        if(web!=null&&web.canGoBack()){web.goBack();return;}
        super.onBackPressed();
    }
    @Override protected void onDestroy(){
        if(web!=null){web.removeJavascriptInterface("DrixNative");web.destroy();}
        super.onDestroy();
    }
}
