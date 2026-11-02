package ro.drix.pulse;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;

/** User-requested, time-bounded audible alert for real Golden Ticket and ML signals. */
final class AlertAttention {
  private static final Handler HANDLER=new Handler(Looper.getMainLooper());
  private static final long MAX_RING_MS=45000;
  private static MediaPlayer player;
  private static Vibrator vibrator;
  private static Runnable timeout;

  static synchronized void start(Context context) {
    stop();
    Context app=context.getApplicationContext();
    try {
      Uri tone=RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
      if(tone==null)tone=RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
      if(tone==null)tone=RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
      if(tone!=null) {
        MediaPlayer p=new MediaPlayer();
        p.setDataSource(app,tone);
        p.setAudioAttributes(new AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        p.setLooping(true);
        p.prepare();
        p.start();
        player=p;
      }
    }catch(Exception error) {
      android.util.Log.w("SB_Radar","Attention sound unavailable");
      if(player!=null){try{player.release();}catch(Exception ignored){} player=null;}
    }
    try {
      vibrator=(Vibrator)app.getSystemService(Context.VIBRATOR_SERVICE);
      if(vibrator!=null&&vibrator.hasVibrator()) {
        // Finite, noticeable triple pulse: no runaway vibration after a notification is dismissed.
        vibrator.vibrate(VibrationEffect.createWaveform(new long[]{0,700,220,700,220,700,320,700},-1));
      }
    }catch(Exception ignored){}
    timeout=AlertAttention::stop;
    HANDLER.postDelayed(timeout,MAX_RING_MS);
  }
  static synchronized void stop() {
    if(timeout!=null){HANDLER.removeCallbacks(timeout);timeout=null;}
    if(player!=null){
      try{if(player.isPlaying())player.stop();}catch(Exception ignored){}
      try{player.release();}catch(Exception ignored){}
      player=null;
    }
    if(vibrator!=null){try{vibrator.cancel();}catch(Exception ignored){}vibrator=null;}
  }
}
