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
    if(!"BET_NOW".equals(d.get("stage")))return;
    String category=d.getOrDefault("signal_label","").toUpperCase(Locale.ROOT).trim();
    if("GOLD_RUSH".equals(d.getOrDefault("signal_type",""))||d.getOrDefault("model_version","").contains("GOLD_RUSH"))category="GOLD RUSH";
    if(!"GOLDEN TICKET".equals(category)&&!"GOLD RUSH".equals(category))return;
    try{
      long event=Long.parseLong(d.getOrDefault("event_id","0"));
      if(event<=0)return;
      String fixture=d.getOrDefault("fixture","Meci");
      int min=Integer.parseInt(d.getOrDefault("minute","0"));
      String px=d.getOrDefault("px","-");
      String score=d.getOrDefault("home_score","-")+"–"+d.getOrDefault("away_score","-");
      String body="⚽ "+fixture+"\n⏱ MINUTUL "+min+" • SCOR "+score+"\n🎯 PARIU: EGAL (X) • COTĂ "+px+("GOLD RUSH".equals(category)?"\n💰 GOLD RUSH • MIZĂ SUGERATĂ 20 LEI":"")+"\nDESCHIDE SB RADAR ȘI VERIFICĂ PREȚUL";
      boolean high=message.getPriority()==RemoteMessage.PRIORITY_HIGH;
      AlertService.postFromFcm(this,category,event,fixture,body,"/app?tab=live&event_id="+event,high,d.getOrDefault("model_version",""));
    }catch(Exception ignored){}
  }
}
