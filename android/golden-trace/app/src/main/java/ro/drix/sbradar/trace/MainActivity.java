package ro.drix.sbradar.trace;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONObject;
import java.util.List;

public final class MainActivity extends Activity {
    private TextView info,trace,licenseFeedback,recorderFeedback,missingStages,touchDiagnostics;
    private boolean expandedTouchDiagnostics=false;
    private EditText url,stake,limit,daily;
    private CheckBox actual;
    @Override public void onCreate(Bundle saved){super.onCreate(saved);
        Backend.credentials(this);
        if(Build.VERSION.SDK_INT>=33)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},8);
        ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(22,30,22,30);root.setBackgroundColor(0xff101014);scroll.addView(root);
        text(root,"⚡ SB RADAR",24,0xffffce61);
        text(root,"GOLDEN TICKET · RECORDER DE TRASEU",15,Color.WHITE);
        text(root,"Separat de SB Radar v2.2 · comunică cu același Worker Cloudflare. Nu înlocuiește APK-ul instalat.",12,0xffb8b8be);
        text(root,"PAS 1 · Autorizează companionul",16,0xffffce61);
        String device=RouteStore.prefs(this).getString("device_id","-");
        text(root,"ID dispozitiv: "+device,12,0xffc2c2c2);
        button(root,"Înregistrează dispozitiv în Cloudflare",()->network(()->Backend.claim(this)));
        button(root,"Verifică licența",()->network(()->{
            Backend.claim(this); // idempotent: ensure registration before checking license
            return Backend.api(this,"/api/mobile/license",null);
        }));
        licenseFeedback=text(root,"● LICENȚĂ NEVERIFICATĂ\nApasă «Verifică licența».",16,0xffffce61);
        text(root,"Dacă statusul este PENDING, aprobă acest telefon în panoul Administrator → Licențiază, apoi verifică din nou.",12,0xffb8b8be);
        button(root,"Deschide panoul Administrator (autorizare)",()->{
            try{
                Intent intent=new Intent(Intent.ACTION_VIEW,android.net.Uri.parse(RouteStore.BACKEND+"/admin"));
                startActivity(intent);
            }catch(Exception e){show("Nu pot deschide panoul: "+e.getMessage());}
        });
        button(root,"Activează serviciul Android Accessibility",()->startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)));
        text(root,"PAS 2 · Înregistrează traseul o singură dată",16,0xffffce61);
        text(root,"MOD CAPTURĂ TOUCH: în Chrome apare banda roșie REC. Atingerile sunt preluate și retransmise către pagină. Derularea este înregistrată. Dacă o atingere nu are etichetă, pasul rămâne diagnostic și nu va fi reprodus automat.",12,0xffb8b8be);
        text(root,"Deschidem un meci Superbet în Chrome. Atinge piața 1X2 → X → miza → butonul final. Ultimul click făcut manual POATE PLASA UN PARIU REAL. Pentru înregistrare folosește o situație de test permisă de operator.",12,0xffdfcfc6);
        url=field(root,"https://superbet.ro/cote/fotbal/…",
             "https://superbet.ro/cote/fotbal/deportivo-pereira-vs-jaguares-de-cordoba-15217680?mdt=o");
        button(root,"● PORNEȘTE ÎNREGISTRAREA + CHROME",()->{
            GoldenAccessibility a=GoldenAccessibility.instance;
            if(a==null){
                String msg="REC NU A PORNIT · Activează serviciul Accessibility, apoi revino.";
                show(msg);android.widget.Toast.makeText(this,msg,android.widget.Toast.LENGTH_LONG).show();return;
            }
            a.beginRecording(url.getText().toString().trim());
            show(GoldenAccessibility.statusText(this));
            refresh();
        });
        button(root,"■ OPREȘTE + SALVEAZĂ TRASEUL",()->{
            GoldenAccessibility a=GoldenAccessibility.instance;
            if(a==null){
                RouteStore.prefs(this).edit().putBoolean("rec_active",false).apply();
                show("Accessibility inactiv · pașii salvați până acum se păstrează.");
            }else a.endRecording();
            refresh();
        });
        button(root,"Șterge ultimul pas înregistrat",()->{
            List<RouteStore.Step> steps=RouteStore.read(this);
            if(!steps.isEmpty()){steps.remove(steps.size()-1);try{RouteStore.save(this,steps);}catch(Exception ignored){}}
            refresh();
        });
        recorderFeedback=text(root,"DIAGNOSTIC REC · nu a pornit",14,0xffffce61);
        missingStages=text(root,"VERIFICĂ ETAPELE: X / MIZĂ / FINAL",13,0xffffa56b);
        trace=text(root,"",12,0xffe5deca);
        button(root,"🔎 Arată / ascunde detalii atingeri (X, miză)",()->{
            expandedTouchDiagnostics=!expandedTouchDiagnostics;
            refresh();
        });
        touchDiagnostics=text(root,"",11,0xffb8d6fd);
        touchDiagnostics.setVisibility(View.GONE);
        text(root,"PAS 3 · Configurează limitele",16,0xffffce61);
        text(root,"MIZĂ PE PARIU (LEI)",14,0xffffce61);
        text(root,"0 = test, fără execuție reală. Introdu suma numai după ce recorderul funcționează.",12,0xffb8b8be);
        stake=field(root,"Miza în lei",String.valueOf(RouteStore.prefs(this).getInt("stake",0)));
        stake.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
        text(root,"PLAFON MAXIM PER PARIU (LEI)",14,0xffffce61);
        limit=field(root,"Maximum lei per bilet",String.valueOf(RouteStore.prefs(this).getInt("max_stake",50)));
        limit.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
        text(root,"MAXIMUM ÎNCERCĂRI GOLDEN TICKET / ZI",14,0xffffce61);
        daily=field(root,"Încercări pe zi (1–20)",String.valueOf(RouteStore.prefs(this).getInt("daily_limit",5)));
        daily.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
        actual=new CheckBox(this);actual.setText("ARMAT: permite ultimul click REAL când apare Golden Ticket");
        actual.setTextColor(0xffffc5ab);actual.setChecked(RouteStore.prefs(this).getBoolean("real",false));root.addView(actual);
        button(root,"Salvează miza și armarea",()->{
            int s=parse(stake.getText().toString()),m=parse(limit.getText().toString()),d=parse(daily.getText().toString());
            if(m<=0||m>5000||s<0||s>m||d<1||d>20){show("Limite invalide: miză 0..plafon; plafon max 5000");return;}
            RouteStore.prefs(this).edit().putInt("stake",s).putInt("max_stake",m)
                    .putInt("daily_limit",d).putBoolean("real",actual.isChecked() && s>0).apply();
            show("Setări salvate · click real: "+(actual.isChecked()&&s>0?"ARMAT":"OPRIT"));
        });
        text(root,"PAS 4 · Test de reluare a traseului v1.0.3",16,0xffffce61);
        text(root,"Testul apasă toate controalele recunoscute, inclusiv butonul final. Poate plasa un pariu REAL. Necesită un traseu complet, ARMAT și miză în plafon. Nu încearcă din nou clickul final.",12,0xffffc5ab);
        button(root,"⚡ TEST TRASEU COMPLET · INCLUDE PARIU REAL",()->{
            String savedUrl=RouteStore.prefs(this).getString("recorded_url","");
            if(savedUrl.isEmpty()){
                show("Înregistrează din nou traseul: nu există un meci asociat.");return;
            }
            List<RouteStore.Step> steps=RouteStore.read(this);
            if(!RouteStore.isComplete(steps)){
                show("TEST NEDISPONIBIL: traseul este INCOMPLET. Trebuie înregistrate X, câmpul mizei și ultimul buton.");
                return;
            }
            int m=RouteStore.prefs(this).getInt("stake",0);
            int max=RouteStore.prefs(this).getInt("max_stake",50);
            if(m<=0||m>max||!RouteStore.prefs(this).getBoolean("real",false)){
                show("Activează ARMAT și salvează o miză pozitivă care nu depășește plafonul.");
                return;
            }
            if(GoldenAccessibility.instance==null){
                show("Activează Accessibility înainte de reluarea traseului.");return;
            }
            new android.app.AlertDialog.Builder(this)
                .setTitle("Confirmare test cu pariu REAL")
                .setMessage("Meci din traseul salvat:\n"+savedUrl+"\n"+
                            "Selecție: X\nMiză: "+m+" lei\n"+
                            "Testul poate apăsa ultimul buton Pariază și debita bani reali. Nu este simulare. Continui?")
                .setNegativeButton("Anulează",null)
                .setPositiveButton("EXECUTĂ TRASEUL COMPLET",(dialog,which)->{
                    boolean started=GoldenAccessibility.manualReplay(savedUrl);
                    if(!started)show("Accessibility nu este disponibil pentru test.");
                    else show("Test solicitat. Verifică statusul ACCESS pentru progres; un click trimis nu dovedește acceptarea pariului.");
                })
                .show();
        });
        text(root,"PAS 5 · Monitorizare Golden Ticket",16,0xffffce61);
        button(root,"▶ PORNEȘTE MONITORUL GOLDEN",()->{
            Intent i=new Intent(this,GoldenMonitor.class);i.setAction(GoldenMonitor.START);
            try{startForegroundService(i);show("Monitor pornit; consultă notificarea permanentă");}
            catch(Exception e){show("Nu s-a putut porni: "+e.getMessage());}
        });
        button(root,"■ OPREȘTE MONITORUL",()->{
            Intent i=new Intent(this,GoldenMonitor.class);i.setAction(GoldenMonitor.STOP);startService(i);show("Monitor oprit");
        });
        button(root,"STOP DE URGENȚĂ · dezarmează și anulează",()->{
            RouteStore.prefs(this).edit().putBoolean("real",false).apply();actual.setChecked(false);
            if(GoldenAccessibility.instance!=null)GoldenAccessibility.instance.abort("Oprire manuală");
            Intent i=new Intent(this,GoldenMonitor.class);i.setAction(GoldenMonitor.STOP);startService(i);show("STOP și DEZARMAT");
        });
        info=text(root,"",12,0xffb3dfc3);
        button(root,"Actualizează starea",this::refresh);
        setContentView(scroll);refresh();
    }
    private int parse(String s){try{return Integer.parseInt(s.trim());}catch(Exception e){return -1;}}
    private interface Work{JSONObject run() throws Exception;}
    private void network(Work w){
        if(licenseFeedback!=null){
            licenseFeedback.setText("⏳ Se conectează la Cloudflare…");
            licenseFeedback.setTextColor(0xffffce61);
        }
        new Thread(()->{
            JSONObject answer=null;
            String error=null;
            try{answer=w.run();}
            catch(Exception e){error=e.getMessage()==null?e.toString():e.getMessage();}
            final JSONObject result=answer;
            final String problem=error;
            runOnUiThread(()->{
                refresh();
                if(problem!=null){
                    String details="❌ VERIFICARE EȘUATĂ\n"+problem;
                    if(problem.contains("401"))details+="\nReînregistrează telefonul și verifică din nou.";
                    if(problem.contains("403"))details+="\nVerifică licența în panoul Administrator.";
                    if(licenseFeedback!=null){
                        licenseFeedback.setText(details);
                        licenseFeedback.setTextColor(0xffff8383);
                    }
                    show(details);
                }else{
                    displayLicense(result);
                    show("Răspuns Cloudflare: "+result.toString());
                }
            });
        }).start();
    }
    private void displayLicense(JSONObject response){
        if(licenseFeedback==null)return;
        JSONObject lic=response.optJSONObject("license");
        if(lic==null){
            licenseFeedback.setText("✅ Dispozitiv înregistrat. Acum apasă Verifică licența.");
            licenseFeedback.setTextColor(0xffb3dfc3);
            return;
        }
        boolean active=lic.optBoolean("active",false);
        String status=lic.optString("status","UNKNOWN");
        String text;
        if(active)text="✅ LICENȚĂ ACTIVE\nGolden Trace este autorizat pe server.";
        else if("PENDING".equals(status))text="⏳ LICENȚĂ PENDING\nÎn panoul Administrator găsește acest telefon → Licențiază → Revino aici.";
        else text="⚠️ LICENȚĂ "+status+"\nIntră în panoul Administrator pentru autorizare.";
        String expires=lic.optString("expires_utc","");
        if(active&&!expires.isEmpty()&&!expires.equals("null"))text+="\nExpiră: "+expires;
        licenseFeedback.setText(text);
        licenseFeedback.setTextColor(active?0xff9bebad:0xffffce61);
    }
    private TextView text(LinearLayout parent,String value,int size,int color){
        TextView t=new TextView(this);t.setText(value);t.setTextSize(size);t.setTextColor(color);
        t.setPadding(0,12,0,10);parent.addView(t);return t;
    }
    private EditText field(LinearLayout parent,String hint,String value){
        EditText f=new EditText(this);f.setText(value);f.setHint(hint);f.setTextColor(Color.WHITE);
        f.setHintTextColor(0xffa4a4ac);f.setSingleLine(true);parent.addView(f);return f;
    }
    private void button(LinearLayout parent,String title,Runnable r){
        Button b=new Button(this);b.setAllCaps(false);b.setText(title);b.setOnClickListener(v->r.run());parent.addView(b);
    }
    private void show(String message){if(info!=null)info.setText(message);}
    private void refresh(){
        if(info==null)return;
        List<RouteStore.Step> steps=RouteStore.read(this);
        StringBuilder sb=new StringBuilder("Traseu · "+steps.size()+" pași · "+(RouteStore.isComplete(steps)?"COMPLET":"INCOMPLET")+"\n");
        for(int i=0;i<steps.size();i++)sb.append(i+1).append(". ").append(steps.get(i).summary()).append('\n');
        if(trace!=null)trace.setText(sb);
        if(touchDiagnostics!=null){
            touchDiagnostics.setVisibility(expandedTouchDiagnostics?View.VISIBLE:View.GONE);
            if(expandedTouchDiagnostics){
                StringBuilder details=new StringBuilder("DIAGNOSTIC LOCAL · C=clickabil E=editabil\n");
                for(int i=0;i<steps.size();i++){
                    RouteStore.Step st=steps.get(i);
                    details.append("PAS ").append(i+1).append(" · ").append(st.summary())
                        .append(" (").append(Math.round(st.x*100)).append("%, ")
                        .append(Math.round(st.y*100)).append("%)\n")
                        .append(st.diagnostic.isEmpty()?"Diagnostic lipsă: reînregistrează traseul":st.diagnostic)
                        .append("\n\n");
                }
                touchDiagnostics.setText(details);
            }
        }
        if(missingStages!=null){
            String reasons=RouteStore.missingReasons(steps);
            String draw=RouteStore.hasX(steps)?"X ACCESIBIL · confirmat":
                RouteStore.hasVisualX(steps)?"X VIZUAL OCR · identificat, dar nu redabil automat":
                "X · neidentificat";
            String bet=RouteStore.hasEditableStake(steps)?"MIZĂ · câmp editabil capturat":
                "MIZĂ · câmpul nu a fost capturat";
            String finish=(!steps.isEmpty() && RouteStore.isFinal(steps.get(steps.size()-1)))?
                "BUTON FINAL · identificat":"BUTON FINAL · neidentificat";
            missingStages.setText("VALIDARE TRASEU: "+(RouteStore.isComplete(steps)?"COMPLET":"INCOMPLET")+
                "\n"+draw+"\n"+bet+"\n"+finish+"\n"+reasons);
            missingStages.setTextColor(RouteStore.isComplete(steps)?0xff9bebad:0xffffa56b);
        }
        android.content.SharedPreferences p=RouteStore.prefs(this);
        boolean recording=p.getBoolean("rec_active",false);
        int events=p.getInt("rec_chrome_events",0),clicks=p.getInt("rec_clicks",0),unnamed=p.getInt("rec_unlabelled",0),windows=p.getInt("rec_chrome_windows",0);
        int touch=p.getInt("rec_overlay_taps",0),swipe=p.getInt("rec_overlay_swipes",0),forwardFailed=p.getInt("rec_forward_failed",0);
        String last=p.getString("rec_last_package","-");
        String diagnostic=(recording?"🔴 REC ACTIV":"REC OPRIT")+
            " · Chrome: "+events+" click/text · "+windows+" schimbări fereastră · clicuri: "+clicks+
            " · fără etichetă: "+unnamed+
            "\nTouch capturat: "+touch+" · derulări: "+swipe+
            " · retransmiteri anulate: "+forwardFailed+
            "\nUltima aplicație detectată: "+last+
            "\n"+GoldenAccessibility.statusText(this);
        if(recorderFeedback!=null){
            recorderFeedback.setText(diagnostic);
            recorderFeedback.setTextColor(events>0?0xff9bebad:0xffffce61);
        }
        info.setText("ACCESS: "+GoldenAccessibility.statusText(this)+"\nMONITOR: "+p.getString("monitor_status","Oprit"));
    }
    @Override protected void onResume(){super.onResume();if(info!=null)refresh();}
}
