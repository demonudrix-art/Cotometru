package ro.drix.pulse;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Invoked ONLY by a user's tap on a Chrome dialog notification action.
 * No automatic approval. Uses the registered Android device's bearer token;
 * server authorizes the owner and checks the exact single-use, unexpired request.
 */
public final class ChromeDialogApprovalReceiver extends BroadcastReceiver {
    static final String TAG = "SB_Radar_Dialog";
    static final String ENDPOINT = MainActivity.BASE + "/api/mobile/chrome-dialog-action";

    @Override public void onReceive(Context context, Intent intent) {
        if(intent==null)return;
        final String id=intent.getStringExtra("request_id");
        final String operation=intent.getStringExtra("operation");
        final String route=intent.getAction();
        if(id==null||!id.matches("[a-zA-Z0-9-]{32,64}")
             ||(!"approve".equals(operation)&&!"reject".equals(operation))
             ||!("approve".equals(operation)?"ro.drix.pulse.CHROME_DIALOG_APPROVE":"ro.drix.pulse.CHROME_DIALOG_REJECT").equals(route))return;
        final PendingResult pending=goAsync();
        final Context app=context.getApplicationContext();
        new Thread(()->{
            String response;
            boolean ok=false;
            try {
                String token=MainActivity.token(app);
                if(token==null||token.isEmpty())throw new IllegalStateException("Telefon neautentificat în SB Radar");
                HttpURLConnection c=(HttpURLConnection)new URL(ENDPOINT).openConnection();
                try {
                    c.setConnectTimeout(4000);
                    c.setReadTimeout(4500);
                    c.setRequestMethod("POST");
                    c.setDoOutput(true);
                    c.setRequestProperty("Content-Type","application/json");
                    c.setRequestProperty("Accept","application/json");
                    c.setRequestProperty("Authorization","Bearer "+token);
                    JSONObject body=new JSONObject();
                    body.put("request_id",id);
                    body.put("action",operation);
                    try(OutputStream out=c.getOutputStream()){
                        out.write(body.toString().getBytes(StandardCharsets.UTF_8));
                    }
                    int status=c.getResponseCode();
                    InputStream stream=status>=200&&status<300?c.getInputStream():c.getErrorStream();
                    StringBuilder received=new StringBuilder();
                    if(stream!=null)try(BufferedReader reader=new BufferedReader(new InputStreamReader(stream,StandardCharsets.UTF_8))){
                        String line;while((line=reader.readLine())!=null)received.append(line);
                    }
                    JSONObject result=new JSONObject(received.length()==0?"{}":received.toString());
                    if(status<200||status>=300)throw new IllegalStateException(result.optString("error","HTTP "+status));
                    if(!result.optBoolean("ok",false))throw new IllegalStateException("Aprobarea nu a fost acceptată de server");
                    ok=true;
                    response="approve".equals(operation)
                        ?"✓ OK autorizat. Chrome verifică și apasă doar dacă popup-ul este încă același."
                        :"Cerere respinsă. Chrome nu va apăsa pe popup.";
                } finally {c.disconnect();}
            } catch(Exception e) {
                Log.w(TAG,"Owner approval was not accepted",e);
                response="⚠️ Nu s-a trimis aprobarea: "+String.valueOf(e.getMessage())+
                    ". Deschide SB Radar → Radar sau Admin.";
            }
            try {postResult(app,id,ok,response);}
            catch(Exception e){Log.w(TAG,"Could not show approval status",e);}
            finally{pending.finish();}
        },"SBR-Chrome-dialog-approval").start();
    }

    private static void postResult(Context ctx,String id,boolean ok,String status) {
        NotificationManager nm=(NotificationManager)ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if(nm==null)return;
        Intent open=new Intent(ctx,MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPi=PendingIntent.getActivity(ctx,(id+"open").hashCode()&0x7fffffff,open,
            PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        boolean night;
        try {int h=java.time.ZonedDateTime.now(java.time.ZoneId.of("Europe/Bucharest")).getHour();night=h>=22||h<5;}
        catch(Exception ignored){night=false;}
        String channel=night?"sbr_chrome_dialog_quiet_v1":"sbr_chrome_dialog_alert_v1";
        Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(ctx,channel):new Notification.Builder(ctx);
        b.setSmallIcon(android.R.drawable.ic_dialog_info)
          .setContentTitle(ok?"SB Radar · confirmare înregistrată":"SB Radar · confirmare nereușită")
          .setContentText(status).setStyle(new Notification.BigTextStyle().bigText(status))
          .setAutoCancel(true).setContentIntent(openPi);
        nm.notify(id.hashCode()&0x7fffffff,b.build());
    }
}
