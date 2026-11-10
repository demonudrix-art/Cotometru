package ro.drix.pulse;
import android.app.*;
import android.content.*;
import android.net.Uri;
import android.os.Build;
import java.time.ZonedDateTime;
import java.time.ZoneId;
import android.media.RingtoneManager;
import android.media.AudioAttributes;
/** SB Radar automatic bookmaker-confirmed ticket notification; no notifications for prepared or uncertain bets. */
public final class AutoTicketNotifier{
 private AutoTicketNotifier(){}
 public static void post(Context context,String ticketId,String fixture,String category,double stake){
  if(ticketId==null||!ticketId.matches("[A-Za-z0-9_-]{5,100}"))return;
  SharedPreferences prefs=context.getSharedPreferences(MainActivity.PREF_NAME,Context.MODE_PRIVATE);
  String key="auto_ticket_notice_"+ticketId;
  if(prefs.getBoolean(key,false))return;
  NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
  if(manager==null)return;
  int hour=ZonedDateTime.now(ZoneId.of("Europe/Bucharest")).getHour();
  boolean quiet=hour>=22||hour<5;
  String channelId=quiet?"sbr_auto_ticket_quiet_v1":"sbr_auto_ticket_normal_v1";
  if(Build.VERSION.SDK_INT>=26){
   NotificationChannel channel=new NotificationChannel(channelId,quiet?"SB Radar · Bilete (noapte)":"SB Radar · Bilete automate",NotificationManager.IMPORTANCE_HIGH);
   channel.enableVibration(true);
   if(quiet)channel.setSound(null,null);
   else channel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build());
   manager.createNotificationChannel(channel);
  }
  String color="strong-silver".equals(category)?"🟣 ":"strong".equals(category)?"🔴 ":"";
  String title="✅ BILET PLASAT AUTOMAT";
  String message=color+String.valueOf(fixture==null?"Meci":fixture)+" • "+String.format(java.util.Locale.ROOT,"%.2f",stake)+" lei • #"+ticketId;
  Intent open=new Intent(context,MainActivity.class).setData(Uri.parse(MainActivity.BASE+"/app?tab=slip"));
  open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
  PendingIntent click=PendingIntent.getActivity(context,(ticketId.hashCode()&0x7fffffff),open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  Notification.Builder n=Build.VERSION.SDK_INT>=26?new Notification.Builder(context,channelId):new Notification.Builder(context);
  n.setSmallIcon(R.drawable.sbr_status_ticket).setColor(0xff32bfa8).setContentTitle(title).setContentText(message).setStyle(new Notification.BigTextStyle().bigText(message)).setAutoCancel(true).setContentIntent(click).setCategory(Notification.CATEGORY_STATUS);
  try{manager.notify(ticketId.hashCode()&0x7fffffff,n.build());prefs.edit().putBoolean(key,true).apply();}catch(Exception ignored){}
 }
}
