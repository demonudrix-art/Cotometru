package ro.drix.sbradar.trace;

import android.content.Context;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.UUID;

final class Backend {
    static void credentials(Context c){
        if(!RouteStore.prefs(c).contains("token")){
            byte[] raw=new byte[48];new SecureRandom().nextBytes(raw);
            String token=android.util.Base64.encodeToString(raw,android.util.Base64.URL_SAFE|android.util.Base64.NO_WRAP|android.util.Base64.NO_PADDING);
            RouteStore.prefs(c).edit().putString("token",token)
                .putString("device_id",UUID.randomUUID().toString()).apply();
        }
    }
    static JSONObject api(Context c,String path,JSONObject post) throws Exception {
        credentials(c);
        URL u=new URL(RouteStore.BACKEND+path);
        HttpURLConnection conn=(HttpURLConnection)u.openConnection();
        try {
            conn.setConnectTimeout(6000);conn.setReadTimeout(7000);
            conn.setRequestProperty("Accept","application/json");
            conn.setRequestProperty("Authorization","Bearer "+RouteStore.prefs(c).getString("token",""));
            if(post!=null){
                conn.setRequestMethod("POST");conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type","application/json");
                byte[] bytes=post.toString().getBytes(StandardCharsets.UTF_8);
                conn.getOutputStream().write(bytes);
            }
            int code=conn.getResponseCode();
            InputStream in=code<400?conn.getInputStream():conn.getErrorStream();
            if(in==null)throw new Exception("API HTTP "+code);
            ByteArrayOutputStream out=new ByteArrayOutputStream();
            byte[] buffer=new byte[8192];int n,total=0;
            while((n=in.read(buffer))!=-1){total+=n;if(total>160000)throw new Exception("Răspuns prea mare");out.write(buffer,0,n);}
            byte[] b=out.toByteArray();
            JSONObject o=new JSONObject(new String(b,StandardCharsets.UTF_8));
            if(code>=400)throw new Exception("HTTP "+code+": "+o.optString("error","eroare"));
            return o;
        } finally{conn.disconnect();}
    }
    static JSONObject claim(Context c) throws Exception {
        credentials(c);
        JSONObject request=new JSONObject();
        request.put("device_id",RouteStore.prefs(c).getString("device_id",""));
        request.put("token",RouteStore.prefs(c).getString("token",""));
        request.put("model",android.os.Build.MANUFACTURER+" "+android.os.Build.MODEL);
        request.put("os_version",android.os.Build.VERSION.RELEASE);
        request.put("app_version","GoldenTrace-1.0");
        return api(c,"/api/mobile/claim",request);
    }
}
