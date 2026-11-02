package ro.drix.pulse;
import android.app.NotificationManager;
import android.content.*;
public class AlertDismissReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context c,Intent i){
   int id=i==null?0:i.getIntExtra("notification_id",0);
   AlertService.dismiss(c,id);
 }
}
