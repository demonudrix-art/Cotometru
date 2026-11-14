package ro.drix.pulse;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;

/** Urgent SB Radar attention is vibration-only, independent of the alarm volume. */
final class AlertAttention {
  private static final Handler HANDLER=new Handler(Looper.getMainLooper());
  private static final long MAX_ATTENTION_MS=45000;
  private static Vibrator vibrator;
  private static Runnable timeout;

  static synchronized void start(Context context) {
    stop();
    try {
      vibrator=(Vibrator)context.getApplicationContext().getSystemService(Context.VIBRATOR_SERVICE);
      if(vibrator!=null&&vibrator.hasVibrator()) {
        // Finite, noticeable vibration pulses without audio playback.
        vibrator.vibrate(VibrationEffect.createWaveform(new long[]{0,700,220,700,220,700,320,700},-1));
      }
    }catch(Exception ignored){}
    timeout=AlertAttention::stop;
    HANDLER.postDelayed(timeout,MAX_ATTENTION_MS);
  }
  static synchronized void stop() {
    if(timeout!=null){HANDLER.removeCallbacks(timeout);timeout=null;}
    if(vibrator!=null){try{vibrator.cancel();}catch(Exception ignored){}vibrator=null;}
  }
}
