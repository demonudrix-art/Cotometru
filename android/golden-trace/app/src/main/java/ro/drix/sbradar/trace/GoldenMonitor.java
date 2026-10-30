package ro.drix.sbradar.trace;

import android.app.Service;
import android.content.Context;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;
import android.net.Uri;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Locale;
import java.text.Normalizer;
import java.util.Calendar;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class GoldenMonitor extends Service {
    static final String START="golden.START",STOP="golden.STOP";
    static final String CH="golden_monitor_v1",ALERT="golden_ticket_v1";
    static final long TEST_ID=1999000168L;
    static final String TEST_URL="https://superbet.ro/cote/fotbal/deportivo-pereira-vs-jaguares-de-cordoba-15217680?mdt=o";
    private volatile boolean running=false;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private int failures=0;
    static final class Signal {
        long eventId, timestamp;
        String fixture="",home="",away="",url="";
        double x;
        boolean already,simulation;
        boolean valid(){
            return eventId>0 && timestamp>0 && System.currentTimeMillis()-timestamp>=0 &&
                    System.currentTimeMillis()-timestamp<100_000 && !already && !simulation &&
                    x>1 && home.length()>=3 && away.length()>=3 && url.startsWith("https://superbet.ro/cote/fotbal/");
        }
        boolean validTest(){
            return simulation && eventId==TEST_ID && TEST_URL.equals(url) &&
                   home.equals("Deportivo Pereira") && away.equals("Jaguares de Cordoba");
        }
        static Signal test(){
            Signal s=new Signal();
            s.eventId=TEST_ID;s.timestamp=System.currentTimeMillis();s.simulation=true;
            s.fixture="Deportivo Pereira · Jaguares de Cordoba";
            s.home="Deportivo Pereira";s.away="Jaguares de Cordoba";
            s.url=TEST_URL;s.x=0;return s;
        }
        static Signal fromTest(JSONObject j){
            return j.optBoolean("is_test",false) && j.optLong("event_id",0)==TEST_ID?test():null;
        }
        static Signal from(JSONObject j){
            if(!"BET_NOW".equals(j.optString("stage"))||
               !"BETA_A_LOW30".equals(j.optString("beta_group"))||
               j.optBoolean("is_test",false)||j.optBoolean("already_in_slip",false))return null;
            Signal s=new Signal();s.eventId=j.optLong("event_id",0);s.simulation=j.optBoolean("is_test",false);
            s.already=j.optBoolean("already_in_slip",false);s.x=j.optDouble("px",0);
            s.timestamp=parseUtc(j.optString("triggered_utc"));
            s.fixture=j.optString("fixture","").replaceAll("\\[[^]]+\\]\\s*","").trim();
            String[] parts=s.fixture.split("[·•|]",-1);
            if(parts.length!=2)return null;
            s.home=parts[0].trim();s.away=parts[1].trim();
            if(s.home.length()<3||s.away.length()<3)return null;
            s.url="https://superbet.ro/cote/fotbal/"+slug(s.home)+"-vs-"+slug(s.away)+"-"+s.eventId;
            return s.valid()?s:null;
        }
        static long parseUtc(String input){try{return java.time.Instant.parse(input).toEpochMilli();}catch(Exception e){return 0;}}
        static String slug(String s){return Normalizer.normalize(s,Normalizer.Form.NFD)
                 .replaceAll("\\p{M}","").toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+","-")
                 .replaceAll("(^-|-$)","");}
    }
    @Override public void onCreate(){super.onCreate();
        NotificationManager n=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        n.createNotificationChannel(new NotificationChannel(CH,"SB Radar · monitor",NotificationManager.IMPORTANCE_LOW));
        NotificationChannel a=new NotificationChannel(ALERT,"Golden Ticket · urgent",NotificationManager.IMPORTANCE_HIGH);
        a.enableVibration(true);n.createNotificationChannel(a);
    }
    @Override public int onStartCommand(Intent i,int flags,int startId){
        if(i!=null&&STOP.equals(i.getAction())){running=false;stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();return START_NOT_STICKY;}
        if(!running){running=true;startForeground(7041,notification(CH,"Monitor Golden Ticket","Verific semnalele",null,7041));worker.execute(this::loop);}
        return START_STICKY;
    }
    private Notification notification(String channel,String title,String body,String url,int id){
        Intent tap;
        if(url==null){tap=new Intent(this,MainActivity.class);}
        else{tap=new Intent(Intent.ACTION_VIEW,Uri.parse(url));tap.setPackage(RouteStore.CHROME);}
        tap.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent p=PendingIntent.getActivity(this,id,tap,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        return new Notification.Builder(this,channel).setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title).setContentText(body).setContentIntent(p)
                .setAutoCancel(url!=null).setOngoing(url==null).build();
    }
    private void status(String text){RouteStore.prefs(this).edit().putString("monitor_status",text).apply();
        ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(7041,notification(CH,"Golden Trace",text,null,7041));}
    private void loop(){
        while(running){
            long t=SystemClock.elapsedRealtime();int seconds=15;
            try{
                JSONObject lic=Backend.api(this,"/api/mobile/license",null).optJSONObject("license");
                if(lic==null||!lic.optBoolean("active",false)){
                    status("Licență "+(lic==null?"indisponibilă":lic.optString("status","PENDING"))+" · aprobă dispozitivul");
                    seconds=35;
                }else{
                    JSONArray alerts=Backend.api(this,"/api/mobile/alerts",null).optJSONArray("alerts");
                    int total=alerts==null?0:alerts.length();
                    for(int idx=0;idx<total;idx++){
                        JSONObject item=alerts.getJSONObject(idx);
                        Signal t=Signal.fromTest(item);
                        if(t!=null){processTest(t);continue;}
                        Signal sig=Signal.from(item);
                        if(sig!=null)process(sig);
                    }
                    failures=0;status("Golden activ · "+total+" mesaje recente · "+new java.util.Date());
                }
            }catch(Exception e){failures++;seconds=Math.min(90,15*(1<<Math.min(3,failures)));
                status("Conexiune: "+e.getClass().getSimpleName()+" · retry "+seconds+"s");}
            long remaining=seconds*1000L-(SystemClock.elapsedRealtime()-t);
            while(running&&remaining>0){try{Thread.sleep(Math.min(1000,remaining));}catch(InterruptedException e){Thread.currentThread().interrupt();running=false;break;}
                remaining=seconds*1000L-(SystemClock.elapsedRealtime()-t);}
        }stopSelf();
    }
    static void localTest(Context c){
        Signal t=Signal.test();
        NotificationManager n=(NotificationManager)c.getSystemService(NOTIFICATION_SERVICE);
        if(Build.VERSION.SDK_INT>=26){
            NotificationChannel channel=new NotificationChannel(ALERT,"Golden Ticket · urgent",
                NotificationManager.IMPORTANCE_HIGH);
            channel.enableVibration(true);n.createNotificationChannel(channel);
        }
        Intent open=new Intent(Intent.ACTION_VIEW,Uri.parse(TEST_URL));
        open.setPackage(RouteStore.CHROME);open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent p=PendingIntent.getActivity(c,9019,open,
            PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        Notification notification=new Notification.Builder(c,ALERT)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("⚡ GOLDEN TICKET · TEST (fără pariu real)")
            .setContentText(t.fixture+" · test X și miză, fără click final")
            .setContentIntent(p).setAutoCancel(true).build();
        n.notify(9019,notification);
        if(RouteStore.isComplete(RouteStore.read(c)) &&
            RouteStore.prefs(c).getInt("stake",0)>0){
            GoldenAccessibility.replay(t,true);
        }
    }
    private void processTest(Signal t){
        if(RouteStore.prefs(this).getBoolean("seen_test_"+t.eventId,false))return;
        RouteStore.prefs(this).edit().putBoolean("seen_test_"+t.eventId,true).apply();
        localTest(this);
        try{
            JSONObject ack=new JSONObject();ack.put("event_id",t.eventId);
            ack.put("stage","BET_NOW");
            Backend.api(this,"/api/mobile/ack",ack);
            status("TEST Golden Ticket primit pentru Pereira-Jaguares · fără confirmare finală");
        }catch(Exception e){
            status("TEST primit; confirmare server indisponibilă");
        }
    }
    private void process(Signal s){
        String key="seen_"+s.eventId;
        if(RouteStore.prefs(this).getBoolean(key,false))return;
        RouteStore.prefs(this).edit().putBoolean(key,true).apply();
        NotificationManager n=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        n.notify((int)(8000+s.eventId%20000),notification(ALERT,"⚡ GOLDEN TICKET · X "+s.x,
                s.fixture+" · intră pe meci",s.url,(int)(8000+s.eventId%20000)));
        boolean real=RouteStore.prefs(this).getBoolean("real",false);
        int stake=RouteStore.prefs(this).getInt("stake",0), max=RouteStore.prefs(this).getInt("max_stake",50);
        long today=System.currentTimeMillis()/86400000L;
        String daily="count_"+today;
        int count=RouteStore.prefs(this).getInt(daily,0);
        if(real && stake>0 && stake<=max && count<RouteStore.prefs(this).getInt("daily_limit",5) && RouteStore.isComplete(RouteStore.read(this))){
            // This is a dispatch ATTEMPT, not proof of an accepted wager.
            RouteStore.prefs(this).edit().putInt(daily,count+1).apply();
            boolean queued=GoldenAccessibility.replay(s,false);
            if(!queued)status("Golden Ticket · accesibilitatea nu este pornită; deschide notificarea");
        }else status("Golden Ticket detectat · execuție reală nearmată sau plafon atins");
    }
    @Override public void onDestroy(){running=false;worker.shutdownNow();super.onDestroy();}
    @Override public IBinder onBind(Intent i){return null;}
}
