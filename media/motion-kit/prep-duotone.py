from PIL import Image, ImageOps, ImageFilter
import numpy as np
INK=np.array([0x18,0x22,0x1c],float); PAPER=np.array([255,255,255],float)
def duo(im, lo, hi, gamma=1.0, white=True):
    g=np.asarray(im.convert('L'),float)/255
    g=np.clip((g-lo)/(hi-lo),0,1)**gamma
    out=INK*(1-g[...,None])+PAPER*g[...,None]
    return Image.fromarray(out.astype('uint8'))
def pct(im,a,b):
    g=np.asarray(im.convert('L'),float)/255; return np.percentile(g,a),np.percentile(g,b)
voc=Image.open('img/voc1606.jpg')
lo,hi=pct(voc,1,55); print('voc',lo,hi)
d=duo(voc,lo,hi*0.97,1.3)
d.crop((180,150,1900,1117)).resize((1920,1080),Image.LANCZOS).save('assets/voc.png')
d.resize((960,1346),Image.LANCZOS).save('assets/voc_full.png')
d.crop((520,860,1260,1080)).save('assets/voc_date.png')
d.crop((1150,980,1900,1300)).save('assets/voc_sig.png')
d.crop((380,170,1100,420)).save('assets/voc_head.png')
s=Image.open('img/vocsep.jpg'); lo,hi=pct(s,1,55); duo(s,lo,hi*0.97,1.3).save('assets/vocsep.png')
e=Image.open('img/edison.jpg'); duo(e,0.0,0.93,0.9).resize((1200,1484),Image.LANCZOS).save('assets/edison.png')
f=Image.open('img/stockexchange.jpg'); lo,hi=pct(f,2,98); duo(f,lo,hi,1.0).resize((1920,1305),Image.LANCZOS).save('assets/floor.png')
p=Image.open('img/pittsburgh.jpg'); lo,hi=pct(p,2,98); duo(p.crop((80,60,1840,2340)),lo,hi,1.0).resize((1100,1425),Image.LANCZOS).save('assets/street.png')
c=Image.open('img/coffee1889.jpg'); lo,hi=pct(c,2,98); duo(c,lo,hi,1.0).save('assets/coffee.png')
