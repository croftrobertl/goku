import numpy as np, pathlib
from PIL import Image
from scipy import ndimage as ndi
ns={}; exec(open('cut2.py').read().split('meta = {}')[0], ns); unwhite, square = ns['unwhite'], ns['square']
OUT=pathlib.Path('/Users/rob/goku/tools/review/renders/chars')
src=np.asarray(Image.open('/Users/rob/goku/tools/review/renders/raw/12.webp').convert('RGB')).astype(int)
rgba, fg = unwhite('/Users/rob/goku/tools/review/renders/raw/12.webp'); H,W=fg.shape; fg[560:]=False
rough=[(197,378),(541,364),(889,366),(1236,361),(1580,377)]
dark=(src.max(2)<95)
yy,xx=np.mgrid[:H,:W]; fits=[]
for cx,cy in rough:
    # the dark outline ring in the lower half, within 140-190 px of the rough center
    d=np.hypot(xx-cx,yy-cy); band=dark&(d>140)&(d<190)&(yy>cy+40)&(yy<560)
    ey,ex=np.nonzero(band); A=np.c_[2*ex,2*ey,np.ones(len(ex))]; b=ex**2.+ey**2.
    fx,fy,c=np.linalg.lstsq(A,b,rcond=None)[0]; fits.append((fx,fy,np.sqrt(c+fx**2+fy**2)))
print([tuple(round(v,1) for v in f) for f in fits])
FACES=['goku','gokusleep','vegeta','piccolo','roshi']
for k,(cx,cy,r) in enumerate(fits):
    R=r+2.5  # include the outline itself
    others=np.zeros_like(fg)
    for j,(ox,oy,orr) in enumerate(fits):
        if j!=k: others|=np.hypot(xx-ox,yy-oy)<orr+6
    d=np.hypot(xx-cx,yy-cy); disc=d<R
    out=fg&~disc&(yy<cy)&~others&(np.abs(xx-cx)<r+45)
    lab,n=ndi.label(out); sizes=ndi.sum(out,lab,range(1,n+1))
    touch=set(np.unique(lab[ndi.binary_dilation(disc,iterations=2)&out]))
    keep=np.isin(lab,[i for i in range(1,n+1) if sizes[i-1]>300 and i in touch])
    a=np.clip(R-d+.5,0,1)
    alpha=np.where(keep,rgba[...,3],rgba[...,3]*a)*fg
    part=rgba.copy(); part[...,3]=alpha.astype(np.uint8); square(part).save(OUT/f'face-{FACES[k]}.png')
    clip=rgba.copy(); clip[...,3]=(rgba[...,3]*a*fg).astype(np.uint8); square(clip).save(OUT/f'face-{FACES[k]}-circle.png')
c=Image.new('RGBA',(10*150,160),(11,15,26,255))
for k,n in enumerate(FACES):
    for v,suf in enumerate(['','-circle']):
        im=Image.open(OUT/f'face-{n}{suf}.png'); im.thumbnail((140,140)); c.alpha_composite(im,((2*k+v)*150+5,10))
c.convert('RGB').save('faces-dark.png')
