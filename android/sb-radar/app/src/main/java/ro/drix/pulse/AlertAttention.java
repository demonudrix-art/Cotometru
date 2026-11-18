package ro.drix.pulse;

import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;

/** Quiet original nature tones + vibration. Never touches system volume or uses ALARM audio. */
final class AlertAttention {
  private static final Handler HANDLER=new Handler(Looper.getMainLooper());
  private static final long MAX_ATTENTION_MS=45000;
  private static Vibrator vibrator;
  private static Runnable timeout;
  private static volatile int soundGeneration=0;
  private static final int SAMPLE_RATE=22050;
  private static final float QUIET_VOLUME=0.085f; // unchanged for Golden/GAP
  private static final float ML_WIND_VOLUME=0.42f; // only ML wind; never overrides silent/DND

  static synchronized void start(Context context) {
    start(context,"GENERIC"); // legacy RING_FCM stage: vibration only, no duplicate sound
  }
  static synchronized void start(Context context,String category) {
    stop();
    try{
      vibrator=(Vibrator)context.getApplicationContext().getSystemService(Context.VIBRATOR_SERVICE);
      if(vibrator!=null&&vibrator.hasVibrator()) {
        vibrator.vibrate(VibrationEffect.createWaveform(new long[]{0,360,180,360,250,420},-1));
      }
    }catch(Exception ignored){}
    int generation=soundGeneration;
    if(shouldPlay(context,category)){
      final Context app=context.getApplicationContext();
      final String kind=category;
      Thread sound=new Thread(()->playNatureTone(app,kind,generation),"SB-Radar-Nature-Tone");
      sound.setDaemon(true);
      sound.start();
    }
    timeout=AlertAttention::stop;
    HANDLER.postDelayed(timeout,MAX_ATTENTION_MS);
  }
  private static boolean shouldPlay(Context ctx,String category){
    if(category==null||"GENERIC".equalsIgnoreCase(category))return false;
    try{
      AudioManager audio=(AudioManager)ctx.getSystemService(Context.AUDIO_SERVICE);
      NotificationManager nm=(NotificationManager)ctx.getSystemService(Context.NOTIFICATION_SERVICE);
      if(audio==null||audio.getRingerMode()!=AudioManager.RINGER_MODE_NORMAL)return false;
      if(audio.getStreamVolume(AudioManager.STREAM_NOTIFICATION)==0)return false;
      // DND, priority-only, silent and vibrate modes are respected, not overridden.
      if(nm!=null&&nm.getCurrentInterruptionFilter()!=NotificationManager.INTERRUPTION_FILTER_ALL)return false;
      return true;
    }catch(Exception ignored){return false;}
  }
  private static void playNatureTone(Context ctx,String category,int generation){
    AudioTrack track=null;
    try{
      final short[] pcm=createNaturePcm(category);
      final AudioAttributes attributes=new AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
      final AudioFormat format=new AudioFormat.Builder()
        .setSampleRate(SAMPLE_RATE).setEncoding(AudioFormat.ENCODING_PCM_16BIT)
        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build();
      track=new AudioTrack.Builder().setAudioAttributes(attributes).setAudioFormat(format)
        .setTransferMode(AudioTrack.MODE_STATIC).setBufferSizeInBytes(pcm.length*2).build();
      if(track.getState()!=AudioTrack.STATE_INITIALIZED||generation!=soundGeneration)return;
      if(track.write(pcm,0,pcm.length)<pcm.length||generation!=soundGeneration)return;
      final String upper=category.toUpperCase(java.util.Locale.ROOT);
      final boolean mlWind=!upper.contains("GOLD")&&!upper.contains("GAP")&&!upper.contains("NAVY");
      track.setVolume(mlWind?ML_WIND_VOLUME:QUIET_VOLUME);
      track.play();
      Thread.sleep(pcm.length*1000L/SAMPLE_RATE+120L);
    }catch(Exception ignored){
      // Notification and vibration must remain available even when playback is restricted.
    }finally{
      if(track!=null){
        try{track.stop();}catch(Exception ignored){}
        try{track.release();}catch(Exception ignored){}
      }
    }
  }
  private static short[] createNaturePcm(String category){
    final String audioType=category.toUpperCase(java.util.Locale.ROOT);
    final double duration=(audioType.contains("GOLD")||audioType.contains("GAP")||audioType.contains("NAVY"))?0.88:1.72;
    final int n=(int)(SAMPLE_RATE*duration);
    final short[] out=new short[n];
    final String type=category.toUpperCase(java.util.Locale.ROOT);
    final boolean gap=type.contains("GAP")||type.contains("NAVY");
    final boolean golden=type.contains("GOLD");
    long seed=117673; // deterministic gentle breeze; no random permissions or external samples
    double phase=0;
    for(int i=0;i<n;i++){
      double t=(double)i/SAMPLE_RATE;
      double v=0;
      if(golden){
        // Three small songbird chirps: rising/falling notes with soft attack and decay.
        for(int k=0;k<3;k++){
          double u=t-(0.09+k*0.23);
          if(u>=0&&u<0.15){
            double env=Math.sin(Math.PI*u/0.15);
            double hz=1320+620*Math.sin(Math.PI*u/0.15)+170*k;
            v+=0.65*env*env*Math.sin(2*Math.PI*(hz*u));
          }
        }
      }else if(gap){
        // Two water droplets: a gentle descending, round plink.
        for(int k=0;k<2;k++){
          double u=t-(0.11+k*0.36);
          if(u>=0&&u<0.28){
            double env=Math.exp(-17*u)*(1-Math.exp(-150*u));
            v+=0.8*env*(Math.sin(2*Math.PI*(750*u-380*u*u))+
                          0.22*Math.sin(2*Math.PI*(1100*u-550*u*u)));
          }
        }
      }else{
        // ML: a quiet airy leaf/breeze wash, slightly pitched and without sharp alarms.
        seed=(seed*1664525L+1013904223L)&0xffffffffL;
        double noise=((seed>>>12)&0xffff)/32768.0-1.0;
        double env=Math.pow(Math.max(0,Math.sin(Math.PI*t/duration)),1.7);
        double gust=0.78+0.22*Math.sin(2*Math.PI*t*1.65-0.8);
        phase+=(2*Math.PI*(305+28*Math.sin(2*Math.PI*t*1.5)))/SAMPLE_RATE;
        v=env*gust*(0.32*Math.sin(phase)+0.13*Math.sin(phase*1.51)+0.095*noise);
      }
      // PCM amplitude stays low even before per-track quiet gain.
      out[i]=(short)(Math.max(-1,Math.min(1,v))*16500);
    }
    return out;
  }
  static synchronized void stop(){
    soundGeneration++;
    if(timeout!=null){HANDLER.removeCallbacks(timeout);timeout=null;}
    if(vibrator!=null){try{vibrator.cancel();}catch(Exception ignored){}vibrator=null;}
  }
}
