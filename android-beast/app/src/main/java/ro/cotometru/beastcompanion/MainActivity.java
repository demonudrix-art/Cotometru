package ro.cotometru.beastcompanion;
import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.graphics.Color;
import android.text.InputType;
import android.view.View;
import android.widget.*;

public final class MainActivity extends Activity {
  EditText keyField,matchField;
  TextView status;
  int dp(int a){return (int)(a*getResources().getDisplayMetrics().density);}
  TextView label(LinearLayout box,String s,int size){
    TextView t=new TextView(this);t.setText(s);t.setTextColor(Color.WHITE);t.setTextSize(size);t.setPadding(0,dp(8),0,dp(8));box.addView(t);return t;
  }
  void button(LinearLayout box,String s,View.OnClickListener l){
    Button b=new Button(this);b.setAllCaps(false);b.setText(s);box.addView(b);b.setOnClickListener(l);
  }
  @Override public void onCreate(Bundle state){
    super.onCreate(state);
    if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=getPackageManager().PERMISSION_GRANTED)
      requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},40);
    ScrollView scroll=new ScrollView(this);scroll.setBackgroundColor(Color.rgb(17,17,23));
    LinearLayout box=new LinearLayout(this);box.setOrientation(1);box.setPadding(dp(18),dp(18),dp(18),dp(18));scroll.addView(box);
    label(box,"BEAST X-RAY · Android v1.1",23);
    label(box,"Monitorizare SSE timp de 120 minute. La gol, aplicația apasă automat ținta salvată pe ecran (inclusiv peste un buton din Chrome). Confirmă personal ce face site-ul în urma atingerii.",14);
    label(box,"Cheie BEAST · salvare criptată",14);
    keyField=new EditText(this);keyField.setSingleLine(true);keyField.setTextColor(Color.WHITE);
    keyField.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
    keyField.setText(SecretStore.get(this));box.addView(keyField);
    label(box,"Linkul meciului LIVE",14);
    matchField=new EditText(this);matchField.setSingleLine(true);matchField.setTextColor(Color.WHITE);
    matchField.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_URI);
    matchField.setHint("https://superbet.ro/cote/fotbal/...-12345678");
    matchField.setText(getPreferences(0).getString("match",""));box.addView(matchField);
    status=label(box,"Gata pentru conectare.",15);
    TextView savedTarget=label(box,TapService.hasTarget(this)
      ? "Țintă salvată: x="+getSharedPreferences(TapService.PREFS,0).getInt("x",0)+
        " y="+getSharedPreferences(TapService.PREFS,0).getInt("y",0)
      : "Țintă nesetată: mută bula peste buton.",14);
    button(box,"Pornește SSE 120 minute",v->{
      String key=keyField.getText().toString().trim(),match=matchField.getText().toString().trim();
      if(key.length()!=48){status.setText("Cheia BEAST trebuie să conțină 48 caractere.");return;}
      if(!match.matches("https://superbet\\.ro/cote/fotbal/[A-Za-z0-9-]+-[0-9]{6,12}")){
        status.setText("Linkul trebuie să fie al unui meci Superbet.");return;
      }
      try{
        SecretStore.save(this,key);getPreferences(0).edit().putString("match",match).apply();
        Intent i=new Intent(this,MonitorService.class);i.setAction(MonitorService.START);i.putExtra("match",match);
        startForegroundService(i);status.setText("Monitorizarea SSE pornește. Verifică notificarea BEAST.");
      }catch(Exception e){status.setText("Eroare: "+e.getMessage());}
    });
    button(box,"Oprește SSE",v->{Intent i=new Intent(this,MonitorService.class);i.setAction(MonitorService.STOP);startService(i);status.setText("Monitorizare oprită.");});
    label(box,"ATINGERE AUTOMATĂ · SSE → CHROME",18);
    label(box,"1. Activează BEAST în Accesibilitate. 2. Afișează bula peste butonul din Chrome și mut-o exact pe țintă. 3. Revino aici, pornește SSE și lasă Chrome deschis, cu ecranul deblocat. La orice gol SSE se trimite automat o atingere reală către coordonatele salvate.",14);
    CheckBox autoTap=new CheckBox(this);
    autoTap.setText("ATUNCI CÂND VINE GOLUL SSE: ATINGERE AUTOMATĂ");
    autoTap.setTextColor(Color.rgb(178,255,135));
    autoTap.setChecked(getSharedPreferences(TapService.PREFS,0).getBoolean("enabled",true));
    autoTap.setOnCheckedChangeListener((b,checked)->{
      getSharedPreferences(TapService.PREFS,0).edit().putBoolean("enabled",checked).apply();
      status.setText(checked?"Atingere automată activată.":"Atingere automată dezactivată.");
    });
    box.addView(autoTap);
    button(box,"Execută acum atingerea la ținta aleasă",v->{
      if(TapService.active==null){status.setText("Activează serviciul BEAST din Accesibilitate.");return;}
      TapService.active.manualTap();
      status.setText("Atingere Android trimisă către țintă.");
    });
    button(box,"Deschide setările Accesibilitate",v->startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)));
    button(box,"Arată / ascunde bula BEAST",v->{
      if(TapService.active==null)status.setText("Activează BEAST în Accesibilitate înainte.");
      else {TapService.active.toggle();status.setText("Bulă BEAST comutată. Mută bula peste buton și ridică degetul pentru salvarea coordonatelor.");}
    });
    setContentView(scroll);
  }
}
