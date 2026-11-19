package ro.drix.pulse;

import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.VibrationEffect;
import android.os.Vibrator;

/** Repeating natural alert tones until dismissed. Honors user media/silent/DND settings. */
final class AlertAttention {
  private static final int SAMPLE_RATE=22050;
  // Higher native gain, never modifies the device's actual notification volume.
  private static final float NATURE_VOLUME=0.82f;
  private static final long BETWEEN_TONES_MS=1650L;
  private static volatile int soundGeneration=0;
  private static volatile AudioTrack activeTrack;
  private static Thread soundThread;
  private static Vibrator vibrator;

  static synchronized void start(Context context) {
    start(context,"GENERIC"); // Legacy vibration-only path.
  }

  static synchronized void start(Context context,String category) {
    stop();
    final Context app=context.getApplicationContext();
    try{
      vibrator=(Vibrator)app.getSystemService(Context.VIBRATOR_SERVICE);
      if(vibrator!=null&&vibrator.hasVibrator()) {
        // Three vibration pulses followed by a pause; repeats until dismissed.
        vibrator.vibrate(VibrationEffect.createWaveform(
          new long[]{0,460,210,460,260,460,2050},0));
      }
    }catch(Exception ignored){}
    if(category==null||"GENERIC".equalsIgnoreCase(category))return;
    final int generation=soundGeneration;
    final String kind=category;
    soundThread=new Thread(()->playNatureLoop(app,kind,generation),"SB-Radar-Nature-Loop");
    soundThread.setDaemon(true);
    soundThread.start();
  }

  private static boolean shouldPlay(Context ctx,String category){
    if(category==null||"GENERIC".equalsIgnoreCase(category))return false;
    try{
      AudioManager audio=(AudioManager)ctx.getSystemService(Context.AUDIO_SERVICE);
      NotificationManager nm=(NotificationManager)ctx.getSystemService(Context.NOTIFICATION_SERVICE);
      if(audio==null||audio.getRingerMode()!=AudioManager.RINGER_MODE_NORMAL)return false;
      if(audio.getStreamVolume(AudioManager.STREAM_NOTIFICATION)==0)return false;
      // Never bypass Do Not Disturb or force ringer or notification volume.
      if(nm!=null&&nm.getCurrentInterruptionFilter()!=NotificationManager.INTERRUPTION_FILTER_ALL)return false;
      return true;
    }catch(Exception ignored){return false;}
  }

  private static boolean pauseUntilNext(long millis,int generation){
    final long end=android.os.SystemClock.uptimeMillis()+millis;
    while(generation==soundGeneration&&!Thread.currentThread().isInterrupted()){
      long remain=end-android.os.SystemClock.uptimeMillis();
      if(remain<=0)return true;
      try{Thread.sleep(Math.min(remain,120L));}
      catch(InterruptedException e){Thread.currentThread().interrupt();return false;}
    }
    return false;
  }

  private static void playNatureLoop(Context ctx,String category,int generation){
    final short[] pcm=createNaturePcm(category);
    final AudioAttributes attributes=new AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
    final AudioFormat format=new AudioFormat.Builder()
      .setSampleRate(SAMPLE_RATE).setEncoding(AudioFormat.ENCODING_PCM_16BIT)
      .setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build();
    while(generation==soundGeneration&&!Thread.currentThread().isInterrupted()){
      if(!shouldPlay(ctx,category)){
        if(!pauseUntilNext(400L,generation))break;
        continue;
      }
      AudioTrack track=null;
      try{
        track=new AudioTrack.Builder().setAudioAttributes(attributes).setAudioFormat(format)
          .setTransferMode(AudioTrack.MODE_STATIC).setBufferSizeInBytes(pcm.length*2).build();
        if(track.getState()!=AudioTrack.STATE_INITIALIZED)break;
        if(track.write(pcm,0,pcm.length)<pcm.length)break;
        synchronized(AlertAttention.class){
          if(generation!=soundGeneration)break;
          activeTrack=track;
        }
        track.setVolume(NATURE_VOLUME);
        track.play();
        if(!pauseUntilNext(pcm.length*1000L/SAMPLE_RATE+120L,generation))break;
      }catch(Exception ignored){
        if(!pauseUntilNext(900L,generation))break;
      }finally{
        synchronized(AlertAttention.class){if(activeTrack==track)activeTrack=null;}
        if(track!=null){
          try{track.stop();}catch(Exception ignored){}
          try{track.release();}catch(Exception ignored){}
        }
      }
      if(!pauseUntilNext(BETWEEN_TONES_MS,generation))break;
    }
  }

  static synchronized void stop(){
    soundGeneration++;
    if(soundThread!=null){soundThread.interrupt();soundThread=null;}
    AudioTrack track=activeTrack;activeTrack=null;
    if(track!=null){try{track.pause();track.flush();track.stop();}catch(Exception ignored){}}
    if(vibrator!=null){try{vibrator.cancel();}catch(Exception ignored){}vibrator=null;}
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
}
