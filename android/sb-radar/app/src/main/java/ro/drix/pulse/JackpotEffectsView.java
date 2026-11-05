package ro.drix.pulse;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.view.View;
import android.view.animation.LinearInterpolator;

/** GPU-friendly animated neon energy field for the fullscreen cinematic alert.
 * Drawn ONLY while AlertScreenActivity is visible; not part of Firebase or the monitor. */
public final class JackpotEffectsView extends View {
  private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final int accent;
  private final float density;
  private ValueAnimator animator;
  private float phase;

  public JackpotEffectsView(Context context, int color) {
    super(context);
    accent=color;
    density=getResources().getDisplayMetrics().density;
    setClickable(false);
    setFocusable(false);
    setLayerType(View.LAYER_TYPE_HARDWARE,null);
  }
  private int rgba(int alpha) {
    return Color.argb(Math.max(0,Math.min(255,alpha)),
      Color.red(accent),Color.green(accent),Color.blue(accent));
  }
  @Override protected void onAttachedToWindow() {
    super.onAttachedToWindow();
    if(animator!=null)return;
    animator=ValueAnimator.ofFloat(0f,1f);
    animator.setInterpolator(new LinearInterpolator());
    animator.setDuration(1900);
    animator.setRepeatCount(ValueAnimator.INFINITE);
    animator.addUpdateListener(a->{
      phase=(Float)a.getAnimatedValue();
      invalidate();
    });
    animator.start();
  }
  @Override protected void onDetachedFromWindow() {
    if(animator!=null){animator.cancel();animator=null;}
    super.onDetachedFromWindow();
  }

  @Override protected void onDraw(Canvas canvas) {
    super.onDraw(canvas);
    float w=getWidth(), h=getHeight();
    if(w<=0||h<=0)return;
    float cx=w*.5f, cy=h*.45f, unit=Math.min(w,h);
    float wave=(float)(.5+.5*Math.sin(2*Math.PI*phase));
    float breath=1f+.10f*wave;
    int r=Color.red(accent),g=Color.green(accent),b=Color.blue(accent);

    // Broad, layered atmospheric backlight behind the card.
    p.setStyle(Paint.Style.FILL);
    p.setShader(new RadialGradient(cx,cy,unit*.90f,
      new int[]{rgba(155+(int)(65*wave)),rgba(84),rgba(6),Color.TRANSPARENT},
      new float[]{0f,.27f,.66f,1f},Shader.TileMode.CLAMP));
    canvas.drawCircle(cx,cy,unit*.90f,p);
    p.setShader(null);

    // Moving light waves: growing bright rings with trails.
    p.setStyle(Paint.Style.STROKE);
    for(int i=0;i<5;i++) {
      float t=(phase+i*.2f)%1f;
      float radius=unit*(.17f+.60f*t)*breath;
      float strength=1f-t;
      p.setColor(rgba((int)(110*strength)));
      p.setStrokeWidth((14f+7f*strength)*density);
      canvas.drawCircle(cx,cy,radius,p);
      p.setColor(rgba((int)(230*strength)));
      p.setStrokeWidth((2f+4f*strength)*density);
      canvas.drawCircle(cx,cy,radius,p);
    }

    // An electric iris around the central card, spinning very slowly.
    for(int i=0;i<3;i++) {
      float radius=unit*(.42f+i*.07f);
      p.setColor(rgba(180-i*37));
      p.setStrokeWidth((3f-i*.4f)*density);
      float angle=phase*75f+i*121f;
      canvas.drawArc(cx-radius,cy-radius,cx+radius,cy+radius,angle,190f,false,p);
      canvas.drawArc(cx-radius,cy-radius,cx+radius,cy+radius,angle+212f,32f,false,p);
    }

    // Jackpot light streaks / energetic radial rays.
    for(int i=0;i<36;i++) {
      float angle=(float)(i*2*Math.PI/36+phase*.20);
      float sparkle=(float)(.5+.5*Math.sin(i*2.73+phase*Math.PI*2));
      float inside=unit*(.46f+.03f*sparkle);
      float outside=unit*(.65f+.12f*sparkle);
      p.setColor(rgba((int)(58+165*sparkle)));
      p.setStrokeWidth((1.3f+2f*sparkle)*density);
      float dx=(float)Math.cos(angle),dy=(float)Math.sin(angle);
      canvas.drawLine(cx+dx*inside,cy+dy*inside,cx+dx*outside,cy+dy*outside,p);
    }

    // Rising flame-like energy tongues along BOTH sides and beneath the alert.
    p.setStyle(Paint.Style.FILL);
    for(int side=0;side<2;side++) {
      float originX=side==0?w*.045f:w*.955f;
      float direction=side==0?1f:-1f;
      for(int i=0;i<10;i++) {
        float originY=h*(.24f+i*.074f);
        float rise=(float)(.5+.5*Math.sin(phase*Math.PI*2+i*.88+side*1.2));
        float length=unit*(.11f+.18f*rise);
        float width=unit*(.025f+.017f*rise);
        float tipX=originX+direction*(length*(.22f+.3f*rise));
        Path flame=new Path();
        flame.moveTo(originX,originY+width);
        flame.cubicTo(originX+direction*length*.65f,originY+width*.7f,
          tipX+direction*length*.06f,originY-length*.7f,tipX,originY-length);
        flame.cubicTo(tipX-direction*length*.2f,originY-length*.38f,
          originX-direction*width*.4f,originY-width*.4f,originX,originY-width);
        flame.close();
        p.setColor(rgba((int)(18+78*rise)));
        canvas.drawPath(flame,p);
        p.setColor(Color.argb((int)(12+55*rise),255,240,218));
        canvas.drawCircle(tipX,originY-length,Math.max(1.5f,3.2f*rise)*density,p);
      }
    }
    // Rising gold-white sparks and motes in distinct depth layers.
    for(int i=0;i<54;i++) {
      float xx=(float)(((i*73.7)%101)/101.0*w);
      float yy=(float)((((i*43.1)%101)/101.0+phase*(.15+i%4*.025))%1.0*h);
      float shimmer=(float)(.5+.5*Math.sin(i*1.64+phase*Math.PI*2));
      p.setColor(i%5==0?Color.argb((int)(75+155*shimmer),255,238,204):
        rgba((int)(55+145*shimmer)));
      float radius=(i%5==0?2.2f:1.1f)+1.7f*shimmer;
      canvas.drawCircle(xx,yy,radius*density,p);
      if(i%7==0){
        p.setStrokeWidth(.8f*density);
        p.setStyle(Paint.Style.STROKE);
        canvas.drawLine(xx-7*density,yy,xx+7*density,yy,p);
        canvas.drawLine(xx,yy-7*density,xx,yy+7*density,p);
        p.setStyle(Paint.Style.FILL);
      }
    }
  }
}
