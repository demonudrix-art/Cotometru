package ro.drix.pulse;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.view.View;
import android.view.animation.LinearInterpolator;

/**
 * SB Radar Cinematic v2: flame ribbons, intense color blooms, aurora light,
 * shockwaves and gold-white sparks. Decorative only; no FCM or audio logic.
 */
public final class JackpotEffectsView extends View {
  private final Paint brush=new Paint(Paint.ANTI_ALIAS_FLAG);
  private final Path flame=new Path();
  private final int accent;
  private final float dp;
  private ValueAnimator animation;
  private float phase;

  public JackpotEffectsView(Context c,int color){
    super(c); accent=color;dp=getResources().getDisplayMetrics().density;
    setClickable(false);setFocusable(false);
    setLayerType(View.LAYER_TYPE_HARDWARE,null);
  }
  private int color(int alpha){
    return Color.argb(Math.max(0,Math.min(255,alpha)),
      Color.red(accent),Color.green(accent),Color.blue(accent));
  }
  private int gold(int alpha){return Color.argb(Math.max(0,Math.min(255,alpha)),255,225,159);}
  @Override protected void onAttachedToWindow(){
    super.onAttachedToWindow();
    if(animation!=null)return;
    animation=ValueAnimator.ofFloat(0f,1f);
    animation.setDuration(2400);
    animation.setRepeatCount(ValueAnimator.INFINITE);
    animation.setInterpolator(new LinearInterpolator());
    animation.addUpdateListener(a->{phase=(Float)a.getAnimatedValue();invalidate();});
    animation.start();
  }
  @Override protected void onDetachedFromWindow(){
    if(animation!=null){animation.cancel();animation=null;}
    super.onDetachedFromWindow();
  }
  private void bloom(Canvas c,float x,float y,float radius,int alpha){
    brush.setStyle(Paint.Style.FILL);
    brush.setShader(new RadialGradient(x,y,radius,
      new int[]{gold((int)(alpha*.36f)),color(alpha),color((int)(alpha*.32f)),Color.TRANSPARENT},
      new float[]{0f,.14f,.46f,1f},Shader.TileMode.CLAMP));
    c.drawCircle(x,y,radius,brush);brush.setShader(null);
  }
  @Override protected void onDraw(Canvas c){
    float w=getWidth(),h=getHeight();
    if(w<1||h<1)return;
    final float cx=w*.5f,cy=h*.48f,u=Math.min(w,h);
    final float twinkle=(float)(.5+.5*Math.sin(phase*Math.PI*2));
    final float breathe=1f+.085f*twinkle;
    // Atmospheric glows are layered, with bright white-gold center cores.
    bloom(c,cx,cy,u*.91f,185+(int)(40*twinkle));
    bloom(c,cx,cy+h*.12f,u*.66f,106+(int)(50*twinkle));
    bloom(c,cx-w*.28f,cy-h*.09f,u*.44f,105);
    bloom(c,cx+w*.28f,cy-h*.06f,u*.44f,105);
    // Fire columns curling inward along the left / right sides of the panel.
    // Each ribbon receives its own moving gradient and pointed flame silhouette.
    for(int side=0;side<2;side++){
      float sign=side==0?1f:-1f;
      for(int i=0;i<17;i++){
        float seed=i*.71f+side*.93f;
        float move=(float)Math.sin(phase*Math.PI*2+seed);
        float flicker=.5f+.5f*move;
        float x=side==0?w*.017f:w*.983f;
        x+=sign*((i%4)*dp*3f);
        float y=h*(.30f+i*.037f);
        float height=u*(.22f+.13f*flicker);
        float bend=u*(.07f+.085f*flicker);
        float width=u*(.024f+.016f*flicker);
        float tipX=x+sign*(bend+(float)Math.sin(seed+phase*6.28)*u*.023f);
        float tipY=y-height;
        flame.reset();
        flame.moveTo(x-sign*width,y);
        flame.cubicTo(x-sign*width*.4f,y-height*.40f,
          tipX-sign*width*.9f,tipY+height*.32f,tipX,tipY);
        flame.cubicTo(tipX+sign*width*.8f,tipY+height*.40f,
          x+sign*width*.9f,y-height*.19f,x+sign*width,y);
        flame.close();
        int a=(int)(68+128*flicker);
        brush.setStyle(Paint.Style.FILL);
        brush.setShader(new LinearGradient(x,y,tipX,tipY,
          new int[]{color(a),color((int)(a*.86f)),gold((int)(a*.53f)),Color.TRANSPARENT},
          new float[]{0f,.40f,.72f,1f},Shader.TileMode.CLAMP));
        c.drawPath(flame,brush);
        brush.setShader(null);
        // Bright narrow inner flame, adds perceived heat instead of a flat shape.
        brush.setColor(gold((int)(23+65*flicker)));
        brush.setStrokeWidth((1.3f+2.7f*flicker)*dp);
        brush.setStyle(Paint.Style.STROKE);
        flame.reset();flame.moveTo(x,y);
        flame.quadTo(x+sign*(bend*.80f),y-height*.58f,tipX,tipY+height*.09f);
        c.drawPath(flame,brush);
      }
    }
    // Spreading shockwaves, gold accents and bright additive-looking contours.
    brush.setStyle(Paint.Style.STROKE);
    for(int i=0;i<4;i++){
      float progress=(phase+i*.25f)%1f;
      float radius=u*(.21f+.62f*progress)*breathe;
      float strength=1f-progress;
      brush.setColor(color((int)(110*strength)));brush.setStrokeWidth((15f+4f*strength)*dp);
      c.drawCircle(cx,cy,radius,brush);
      brush.setColor(gold((int)(205*strength)));brush.setStrokeWidth((2f+3f*strength)*dp);
      c.drawCircle(cx,cy,radius,brush);
    }
    // Split golden arcs rather than the old thin HUD radial spokes.
    for(int i=0;i<2;i++){
      float radius=u*(.52f+i*.15f);
      float angle=(phase*96f+i*171f);
      brush.setColor(color(200-i*50));brush.setStrokeWidth((5f-i*1.4f)*dp);
      c.drawArc(cx-radius,cy-radius,cx+radius,cy+radius,angle,118f,false,brush);
      brush.setColor(gold(160-i*32));brush.setStrokeWidth(1.8f*dp);
      c.drawArc(cx-radius,cy-radius,cx+radius,cy+radius,angle+132f,77f,false,brush);
    }
    brush.setStyle(Paint.Style.FILL);
    // Rising embers, gold diamonds and short trails.
    for(int i=0;i<110;i++){
      float xi=(float)(((i*67.79)%101)/101f);
      float yi=(float)(((i*43.71)%101)/101f);
      float rise=(phase*(.22f+(i%4)*.051f)+yi)%1f;
      float x=xi*w+(float)Math.sin(phase*7.4+i)*4f*dp;
      float y=(1f-rise)*h;
      float flick=(float)(.5+.5*Math.sin(i*1.83f+phase*13.3f));
      int opacity=(int)(60+175*flick);
      brush.setColor(i%4==0?gold(opacity):color(opacity));
      float radius=(i%8==0?2.4f:1.15f)+(1.9f*flick);
      c.drawCircle(x,y,radius*dp,brush);
      if(i%11==0){
        brush.setStyle(Paint.Style.STROKE);brush.setStrokeWidth(1.05f*dp);
        c.drawLine(x-8*dp,y,x+8*dp,y,brush);
        c.drawLine(x,y-8*dp,x,y+8*dp,brush);
        brush.setStyle(Paint.Style.FILL);
      }
    }
    // Massive cinematic white-gold lens flare behind the title.
    float flareY=h*.26f;
    float flareAlpha=.40f+.60f*twinkle;
    bloom(c,cx,flareY,u*.16f,(int)(190*flareAlpha));
    brush.setColor(gold((int)(100*flareAlpha)));
    brush.setStrokeWidth(1.4f*dp);
    brush.setStyle(Paint.Style.STROKE);
    c.drawLine(cx-u*.29f,flareY,cx+u*.29f,flareY,brush);
    c.drawLine(cx,flareY-u*.10f,cx,flareY+u*.10f,brush);
  }
}
