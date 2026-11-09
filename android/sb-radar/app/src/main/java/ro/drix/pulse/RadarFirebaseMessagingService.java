package ro.drix.pulse;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;
import java.util.Locale;

public class RadarFirebaseMessagingService extends FirebaseMessagingService {
  @Override public void onNewToken(String token){
    super.onNewToken(token);
    FirebaseBootstrap.registerToken(getApplicationContext(),token);
  }
  @Override public void onMessageReceived(RemoteMessage message){
    super.onMessageReceived(message);
    Map<String,String> d=message.getData();
    getSharedPreferences(MainActivity.PREF_NAME,MODE_PRIVATE).edit()
      .putLong("fcm_last_received_ms",System.currentTimeMillis())
      .putString("fcm_last_signal",d.getOrDefault("signal_label",""))
      .putString("fcm_last_priority",message.getPriority()==RemoteMessage.PRIORITY_HIGH?"HIGH":"NORMAL")
      .apply();
    if("CHROME_DIALOG_REQUEST".equals(d.get("stage"))){
      ChromeDialogNotifier.post(this,d.getOrDefault("request_id",""),d.getOrDefault("device_name","Calculator"),d.getOrDefault("body",""),d.getOrDefault("button_label","OK"),"true".equalsIgnoreCase(d.getOrDefault("clickable","false")));
      return;
    }
    if("OVER05_WATCH".equals(d.get("stage"))){
      // Separate Over 0.5 information only; never enters BET_NOW or automatic betting.
      try{GoalWatchNotifier.post(this,d);}
      catch(Exception e){android.util.Log.w("SB_Radar_GoalWatch","Native alert unavailable",e);}
      return;
    }
    if("AUTO_TICKET_PLACED".equals(d.get("stage"))){
      try{
        String ticket=d.getOrDefault("ticket_id","");
        double stake=Double.parseDouble(d.getOrDefault("stake_lei","0"));
        AutoTicketNotifier.post(this,ticket,d.getOrDefault("fixture","Meci"),d.getOrDefault("signal_type",""),stake);
      }catch(Exception e){android.util.Log.w("SB_Radar_FCM","Auto ticket receipt invalid",e);}
      return;
    }
    if(!"BET_NOW".equals(d.get("stage")))return;
    boolean isTest="true".equalsIgnoreCase(d.getOrDefault("test","false"));
    String label=d.getOrDefault("signal_label","").toUpperCase(Locale.ROOT).trim();
    String type=d.getOrDefault("signal_type","").toUpperCase(Locale.ROOT).trim();
    String priority=d.getOrDefault("priority_code","").toUpperCase(Locale.ROOT).trim();
    String model=d.getOrDefault("model_version","").toUpperCase(Locale.ROOT);
    String combined=label+" "+type+" "+priority+" "+model;
    boolean purple=combined.contains("STRONG + SILVER")||combined.contains("STRONG_SILVER")||combined.contains("STRONG-SILVER");
    boolean red=!purple&&combined.contains("STRONG");
    String category=purple?"STRONG + SILVER":red?"STRONG":"GOLDEN TICKET".equals(label)?"GOLDEN TICKET":
      isTest&&"ML".equals(label)?"ML":"";
    if(category.isEmpty())return; // Removed ML, Gold Rush and Silver-only never raise active alerts.
    try{
      long event=Long.parseLong(d.getOrDefault("event_id","0"));
      if(event<=0)return;
      String fixture=d.getOrDefault("fixture","Meci");
      int minute=Integer.parseInt(d.getOrDefault("minute","0"));
      String px=d.getOrDefault("px","-");
      String score=d.getOrDefault("home_score","-")+"–"+d.getOrDefault("away_score","-");
      String tier57=d.getOrDefault("gold_category_label","");
      String heading=purple?"🟣 STRONG + SILVER • 75 LEI":red?"🔴 STRONG • 50 LEI":
        isTest?"TEST FCM • NU PARIA":"GOLDEN TICKET";
      String body=fixture+"\n"+heading+
        (tier57.isEmpty()?"":"\nREPER X57: "+tier57)+
        "\n⏱ MINUTUL "+minute+" • SCOR "+score+
        "\n🎯 PARIU: EGAL (X) • COTĂ "+px+
        "\nDESCHIDE SB RADAR ȘI VERIFICĂ PREȚUL";
      boolean high=message.getPriority()==RemoteMessage.PRIORITY_HIGH;
      AlertService.postFromFcm(this,category,event,fixture,body,
        "/app?tab=live&event_id="+event,high,model+" "+priority);
      // FCM was historically not acknowledged by the APK; acknowledge only real delivered alerts.
      // Keep the test queue isolated from the user's betting and signal history.
      if(!isTest){
        final long eventId=event;
        new Thread(()->{
          try{
            String auth=MainActivity.token(getApplicationContext());
            if(auth.isEmpty())return;
            org.json.JSONObject ack=new org.json.JSONObject();
            ack.put("event_id",eventId);
            ack.put("stage","BET_NOW");
            MainActivity.readHttp(MainActivity.BASE+"/api/mobile/ack",auth,ack.toString());
          }catch(Exception e){android.util.Log.w("SB_Radar_FCM","Receipt pending",e);}
        },"SB-Radar-FCM-receipt").start();
      }
    }catch(Exception e){
      android.util.Log.w("SB_Radar_FCM","Unable to display urgent alert",e);
    }
  }
}
