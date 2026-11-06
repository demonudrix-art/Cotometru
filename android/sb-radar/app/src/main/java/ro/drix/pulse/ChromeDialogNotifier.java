package ro.drix.pulse;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import java.time.ZoneId;
import java.time.ZonedDateTime;

/**
 * One notification per Superbet dialog, data-only FCM.
 * Tapping OPENS authenticated Admin review; it never clicks the bookmaker itself.
 */
public final class ChromeDialogNotifier {
  private ChromeDialogNotifier(){}
  public static void post(Context context,String id,String device,String body,boolean canApprove){
    if(id==null||!id.matches("[a-zA-Z0-9-]{32,64}"))return;
    NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
    if(manager==null)return;
    boolean night;
    try{int h=ZonedDateTime.now(ZoneId.of("Europe/Bucharest")).getHour();night=h>=22||h<5;}catch(Exception ignored){night=false;}
    String channelId=night?"sbr_chrome_dialog_quiet_v1":"sbr_chrome_dialog_alert_v1";
    if(Build.VERSION.SDK_INT>=26){
      NotificationChannel channel=new NotificationChannel(channelId,
        night?"SB Radar · Confirmări Chrome (noapte)":"SB Radar · Confirmări Chrome",
        NotificationManager.IMPORTANCE_HIGH);
      channel.enableVibration(true);
      if(night)channel.setSound(null,null);
      manager.createNotificationChannel(channel);
    }
    String text=(body==null?"":body.trim());
    if(text.length()>400)text=text.substring(0,400);
    String title="⚠️ Superbet · "+(device==null?"PC":device);
    String message=text+(canApprove?"\nDeschide pentru a aproba OK în Chrome.":"\nNecesită verificare pe calculator.");
    Intent open=new Intent(context,AdminConsoleActivity.class)
      .putExtra("SBR_OPEN_DIALOGS",true)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent intent=PendingIntent.getActivity(context,id.hashCode()&0x7fffffff,open,
      PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    Notification.Builder builder=Build.VERSION.SDK_INT>=26?
      new Notification.Builder(context,channelId):new Notification.Builder(context);
    builder.setSmallIcon(android.R.drawable.ic_dialog_alert)
      .setContentTitle(title).setContentText(message)
      .setStyle(new Notification.BigTextStyle().bigText(message))
      .setAutoCancel(true).setContentIntent(intent)
      .setCategory(Notification.CATEGORY_REMINDER)
      .setPriority(Notification.PRIORITY_HIGH);
    try{manager.notify(id.hashCode()&0x7fffffff,builder.build());}
    catch(SecurityException e){android.util.Log.w("SBR_Dialog","Notification permission denied",e);}
  }
}
